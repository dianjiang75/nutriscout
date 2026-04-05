/**
 * Menu Pipeline Evaluation Runner
 *
 * Runs scraper and classifier evaluators against the live DB and prints a report.
 *
 * Usage: npx tsx scripts/run-evaluations.ts [--scraper-only] [--classifier-only]
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { evaluateAllScrapers } from "../src/lib/agents/menu-scraper/evaluator";
import { evaluateClassifier } from "../src/lib/agents/menu-classifier/evaluator";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});
const prisma = new PrismaClient({ adapter });

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

async function runScraperEval() {
  console.log("=== SCRAPER EVALUATION ===\n");

  const results = await evaluateAllScrapers(prisma);

  if (results.length === 0) {
    console.log(
      "  No ground truth restaurants found in DB. Seed restaurants first.\n"
    );
    return;
  }

  for (const r of results) {
    console.log(
      `  ${r.restaurantName}: ${r.actualItemCount}/${r.expectedItemCount} items (recall: ${pct(r.recall)})`
    );

    if (r.missedItems.length > 0) {
      console.log(`    Missed (${r.missedItems.length}):`);
      for (const item of r.missedItems) {
        console.log(`      - ${item}`);
      }
    }

    if (r.falseItems.length > 0) {
      console.log(`    False positives (${r.falseItems.length}):`);
      for (const item of r.falseItems) {
        console.log(`      - "${item}"`);
      }
    }
  }

  // Summary
  const totalExpected = results.reduce(
    (s, r) => s + r.expectedItemCount,
    0
  );
  const totalActual = results.reduce((s, r) => s + r.actualItemCount, 0);
  const avgRecall =
    results.length > 0
      ? results.reduce((s, r) => s + r.recall, 0) / results.length
      : 0;

  console.log(`\n  Summary: ${totalActual}/${totalExpected} total items`);
  console.log(`  Average recall: ${pct(avgRecall)}`);
  console.log();
}

async function runClassifierEval() {
  console.log("=== CLASSIFIER EVALUATION ===\n");

  const result = await evaluateClassifier(prisma);

  if (result.totalEvaluated === 0) {
    console.log(
      "  No ground truth items found in DB. Run a crawl first.\n"
    );
    if (result.notFound.length > 0) {
      console.log(
        `  (${result.notFound.length} ground truth items not in DB)`
      );
    }
    return;
  }

  console.log(
    `  Accuracy: ${result.correctCount}/${result.totalEvaluated} (${pct(result.accuracy)})`
  );

  // Per-type breakdown
  const types = Object.keys(result.byType).sort();
  if (types.length > 0) {
    console.log("\n  By type:");
    for (const type of types) {
      const { correct, total } = result.byType[type];
      const typePct = total > 0 ? pct(correct / total) : "N/A";
      console.log(`    ${type}: ${correct}/${total} (${typePct})`);
    }
  }

  // Errors
  if (result.errors.length > 0) {
    console.log(`\n  Errors (${result.errors.length}):`);
    for (const err of result.errors) {
      console.log(
        `    "${err.name}" -- expected: ${err.expected}, got: ${err.actual}`
      );
    }
  }

  // Not found
  if (result.notFound.length > 0) {
    console.log(`\n  Not found in DB (${result.notFound.length}):`);
    for (const name of result.notFound.slice(0, 10)) {
      console.log(`    - ${name}`);
    }
    if (result.notFound.length > 10) {
      console.log(`    ... and ${result.notFound.length - 10} more`);
    }
  }

  console.log();
}

async function main() {
  const args = process.argv.slice(2);
  const scraperOnly = args.includes("--scraper-only");
  const classifierOnly = args.includes("--classifier-only");

  console.log("\nFoodClaw Menu Pipeline Evaluation\n");
  console.log("─".repeat(50) + "\n");

  if (!classifierOnly) {
    await runScraperEval();
  }

  if (!scraperOnly) {
    await runClassifierEval();
  }

  console.log("─".repeat(50));
  console.log("Done.\n");
}

main()
  .catch((err) => {
    console.error("[eval] Fatal:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
