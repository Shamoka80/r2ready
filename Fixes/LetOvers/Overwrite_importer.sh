# Overwrite importer with clause normalization from category_code/category/text
cat > ~/workspace/server/tools/import-questions.ts <<'TS'
import "dotenv/config";
import fs from "fs";
import { parse as parseSync } from "csv-parse/sync";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const HEADERS = {
  question_id: ["question_id","id","qid","q_id","QuestionID","Question Id","Question_ID"],
  clause_ref: ["clause_ref","clause","requirement","citation","Clause","R2 Clause","Clause Reference","Reference","Ref"],
  category_code: ["category_code","Category Code"],
  category: ["category","Category"],
  text: ["text","question","prompt","Question Text","Question"],
  response_type: ["response_type","type","answer_type","input_type","Response Type","Type"],
  required: ["required","is_required","mandatory","Required"],
  evidence_required: ["evidence_required","requires_evidence","Evidence Required","Evidence"],
  appendix: ["appendix","Appendix","scope","Scope"],
  weight: ["weight","score_weight","Weight","scoring_weight"],
  help_text: ["help_text","help","guidance","Help Text","Guidance","compliance_expectation","Compliance Expectation"]
};

function pick(row: any, keys: string[]) {
  const cols = Object.keys(row);
  for (const k of keys) {
    const hit = cols.find(c => c.trim().toLowerCase() === k.trim().toLowerCase());
    if (hit) return row[hit];
  }
  return undefined;
}

function normalizeClauseRef(src?: string|null): string|null {
  if (!src) return null;
  const s = String(src).trim().toUpperCase().replace(/\s+/g, " ");
  // CORE REQUIREMENT N → CRN
  let m = s.match(/^CORE\s+REQUIREMENT\s+(\d{1,2})/);
  if (m) return `CR${Number(m[1])}`;
  // CRN / CR N
  m = s.match(/^CR\W*\s*(\d{1,2})/);
  if (m) return `CR${Number(m[1])}`;
  // APPENDIX X
  m = s.match(/^APPENDIX\s+([A-G])/);
  if (m) return `APP-${m[1]}`;
  // APP X / APP-X
  m = s.match(/^APP(?:ENDIX)?\W*([A-G])/);
  if (m) return `APP-${m[1]}`;
  return null;
}

function deriveClause(row: any): string|null {
  const fromClause = normalizeClauseRef(pick(row, HEADERS.clause_ref));
  if (fromClause) return fromClause;
  const fromCode = normalizeClauseRef(pick(row, HEADERS.category_code));
  if (fromCode) return fromCode;
  const fromCat = normalizeClauseRef(pick(row, HEADERS.category));
  if (fromCat) return fromCat;
  // Last resort: scan question text
  const text = String(pick(row, HEADERS.text) ?? "").toUpperCase();
  let m = text.match(/\bCR\s*([0-9]{1,2})\b/);
  if (m) return `CR${Number(m[1])}`;
  m = text.match(/\bAPP(?:ENDIX)?\s*([A-G])\b/);
  if (m) return `APP-${m[1]}`;
  return null;
}

function classifyBucket(ref?: string|null) {
  if (!ref) return "UNSPECIFIED";
  const u = ref.toUpperCase();
  if (/^CR([1-9]|10)$/.test(u)) return u;
  const m = u.match(/^APP-([A-G])$/);
  if (m) return `APP-${m[1]}`;
  return "OTHER";
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
  const delim = (() => {
    const l = raw.split(/\r?\n/)[0] ?? "";
    const cand = [",",";","\t","|"].map(d => ({d, n: (l.match(new RegExp("\\"+d,"g"))||[]).length}));
    cand.sort((a,b)=>b.n-a.n);
    return (cand[0]?.n ?? 0) > 0 ? cand[0].d : ",";
  })();

  const records: any[] = parseSync(raw, { columns: true, skip_empty_lines: true, delimiter: delim });

  const counts: Record<string, number> = {};
  const missingClause: string[] = [];
  const seenQIDs = new Set<string>();
  let duplicates = 0, total = 0;

  for (const row of records) {
    total++;

    const qid = String(pick(row, HEADERS.question_id) ?? "").trim();
    const clauseRefNorm = deriveClause(row);
    const text = String(pick(row, HEADERS.text) ?? "").trim();
    const responseType = String(pick(row, HEADERS.response_type) ?? "yes_no").trim();
    const required = String(pick(row, HEADERS.required) ?? "true").toLowerCase().startsWith("t");
    const evidenceRequired = String(pick(row, HEADERS.evidence_required) ?? "false").toLowerCase().startsWith("t");
    const appendix = String(pick(row, HEADERS.appendix) ?? "").trim().toUpperCase() || null;
    const weight = Number(pick(row, HEADERS.weight) ?? 1);
    const helpText = String(pick(row, HEADERS.help_text) ?? "");

    if (!clauseRefNorm) missingClause.push(qid || text.slice(0,50));

    const clauseRefKey = clauseRefNorm || "UNSPEC"; // single UNSPEC clause
    const clause = await prisma.clause.upsert({
      where: { ref: clauseRefKey },
      update: { title: clauseRefNorm || "Unspecified", stdId: std.id },
      create: { ref: clauseRefKey, title: clauseRefNorm || "Unspecified", stdId: std.id }
    });

    if (qid) {
      if (seenQIDs.has(qid)) duplicates++;
      seenQIDs.add(qid);
    }

    await prisma.question.upsert({
      where: { questionId: qid || `${clause.id}-${total}` },
      update: { clauseId: clause.id, text, responseType, required, evidenceRequired, appendix, weight, helpText },
      create: { questionId: qid || `${clause.id}-${total}`, clauseId: clause.id, text, responseType, required, evidenceRequired, appendix, weight, helpText }
    });

    const bucket = classifyBucket(clauseRefNorm || undefined);
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

# Re-run the importer (updates existing Question rows by questionId)
cd ~/workspace/server
npx ts-node --project tsconfig.json tools/import-questions.ts ../questions.csv 2>&1 | tee ../importer.log
tail -n 40 ../importer.log