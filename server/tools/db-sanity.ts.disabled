import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const stds = await prisma.standardVersion.findMany({ select: { id: true, code: true, name: true } });
  console.log("Standards:", stds);

  // Pick R2V3_1 (or first available)
  const std = stds.find(s => s.code === "R2V3_1") ?? stds[0];
  if (!std) { console.log("No StandardVersion rows."); return; }
  console.log("Using standard:", std);

  const clauseCount = await prisma.clause.count({ where: { stdId: std.id } });
  const qTotal = await prisma.question.count();
  const qForStd = await prisma.question.count({
    where: { clause: { stdId: std.id } }
  });
  console.log(`Clauses for std: ${clauseCount}`);
  console.log(`Questions total: ${qTotal}`);
  console.log(`Questions for std: ${qForStd}`);

  // Show a few clause refs + question counts
  const clauses = await prisma.clause.findMany({
    where: { stdId: std.id },
    select: { ref: true, _count: { select: { questions: true } } },
    orderBy: { ref: "asc" },
    take: 10
  });
  console.log("Clause counts (first 10):", clauses);

  // Sample the first few questionIds so we know what to POST in /batch
  const sampleQs = await prisma.question.findMany({
    where: { clause: { stdId: std.id } },
    select: { questionId: true, text: true },
    take: 5,
    orderBy: { questionId: "asc" }
  });
  console.log("Sample questionIds:", sampleQs.map(q => q.questionId));
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
