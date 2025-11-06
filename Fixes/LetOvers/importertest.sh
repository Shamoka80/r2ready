# 1) Create the importer at server/tools/import-questions.ts
cd ~/workspace
mkdir -p server/tools
cat > server/tools/import-questions.ts <<'TS'
import "dotenv/config";
import fs from "fs";
import { parse as parseSync } from "csv-parse/sync";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const HEADER_SYNONYMS: Record<string, string[]> = {
  question_id: ["question_id","id","qid","q_id","QuestionID","Question Id","Question_ID"],
  clause_ref: ["clause_ref","clause","requirement","citation","Clause","R2 Clause"],
  text: ["text","question","prompt","Question Text","Question"],
  response_type: ["response_type","type","answer_type","input_type","Response Type","Type"],
  required: ["required","is_required","mandatory","Required"],
  evidence_required: ["evidence_required","requires_evidence","Evidence Required","Evidence"],
  appendix: ["appendix","Appendix","scope","Scope"],
  weight: ["weight","score_weight","Weight","scoring_weight"],
  help_text: ["help_text","help","guidance","Help Text","Guidance"]
};

function pick(row: any, keys: string[]) {
  const cols = Object.keys(row);
  for (const k of keys) {
    const hit = cols.find(c => c.trim().toLowerCase() === k.trim().toLowerCase());
    if (hit) return row[hit];
  }
  return undefined;
}

function classifyClause(ref?: string) {
  if (!ref) return "UNSPECIFIED";
  const u = ref.toUpperCase().replace(/\s+/g, "");
  const m = u.match(/CR(\d+)/);
  if (m) return `CR${m[1]}`;
  const m2 = u.match(/\b(?:APPENDIX|APP)?([A-G])\b/);
  if (m2) return `APP-${m2[1]}`;
  return "OTHER";
}

function detectDelimiter(sample: string): string {
  const cands = [",",";","\t","|"];
  let best = { d: ",", n: 0 };
  for (const d of cands) {
    const n = (sample.match(new RegExp("\\" + d, "g")) || []).length;
    if (n > best.n) best = { d, n };
  }
  return best.n > 0 ? best.d : ",";
}

async function main() {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) {
    console.error("Usage: ts-node server/tools/import-questions.ts <path-to-csv>");
    process.exit(2);
  }

  const std = await prisma.standardVersion.upsert({
    where: { code: "R2V3_1" },
    update: {},
    create: { code: "R2V3_1", name: "R2 v3.1", isActive: true }
  });

  const raw = fs.readFileSync(file, "utf8");
  const firstLine = raw.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);

  const records: any[] = parseSync(raw, {
    columns: true,
    skip_empty_lines: true,
    delimiter
  });

  const counts: Record<string, number> = {};
  const missingClause: string[] = [];
  const seenQIDs = new Set<string>();
  let duplicates = 0;
  let total = 0;

  for (const row of records) {
    total++;

    const qid = String(pick(row, HEADER_SYNONYMS.question_id) ?? "").trim();
    const clauseRef = String(pick(row, HEADER_SYNONYMS.clause_ref) ?? "").trim();
    const text = String(pick(row, HEADER_SYNONYMS.text) ?? "").trim();
    const responseType = String(pick(row, HEADER_SYNONYMS.response_type) ?? "yes_no").trim();
    const required = String(pick(row, HEADER_SYNONYMS.required) ?? "true").toLowerCase().startsWith("t");
    const evidenceRequired = String(pick(row, HEADER_SYNONYMS.evidence_required) ?? "false").toLowerCase().startsWith("t");
    const appendixRaw = String(pick(row, HEADER_SYNONYMS.appendix) ?? "").trim().toUpperCase();
    const appendix = appendixRaw && "ABCDEFG".includes(appendixRaw) ? appendixRaw : null;
    const weight = Number(pick(row, HEADER_SYNONYMS.weight) ?? 1);
    const helpText = String(pick(row, HEADER_SYNONYMS.help_text) ?? "");

    if (!clauseRef) missingClause.push(qid || text.slice(0, 50));

    // Clause upsert (fallback ref for missing)
    const clauseRefKey = clauseRef || `UNSPEC:${qid || text.slice(0, 16)}`;
    const clause = await prisma.clause.upsert({
      where: { ref: clauseRefKey },
      update: { title: clauseRef || "Unspecified", stdId: std.id },
      create: { ref: clauseRefKey, title: clauseRef || "Unspecified", stdId: std.id }
    });

    if (qid && seenQIDs.has(qid)) duplicates++;
    if (qid) seenQIDs.add(qid);

    await prisma.question.upsert({
      where: { questionId: qid || `${clause.id}-${total}` },
      update: {
        clauseId: clause.id, text, responseType, required, evidenceRequired, appendix, weight, helpText
      },
      create: {
        questionId: qid || `${clause.id}-${total}`,
        clauseId: clause.id, text, responseType, required, evidenceRequired, appendix, weight, helpText
      }
    });

    const bucket = classifyClause(clauseRef);
    counts[bucket] = (counts[bucket] || 0) + 1;
  }

  const keys = ["CR1","CR2","CR3","CR4","CR5","CR6","CR7","CR8","CR9","CR10","APP-A","APP-B","APP-C","APP-D","APP-E","APP-F","APP-G","UNSPECIFIED","OTHER"];
  console.log("=== Coverage ===");
  for (const k of keys) console.log(`${k.padEnd(10)} : ${counts[k] || 0}`);
  console.log("Missing clause refs:", missingClause.length);
  console.log("Duplicate explicit question_ids:", duplicates);
  console.log("Total imported:", total);
}

main().then(()=>process.exit(0)).catch(e=>{ console.error(e); process.exit(1); });
TS