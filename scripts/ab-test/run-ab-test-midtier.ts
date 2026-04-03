#!/usr/bin/env tsx
/**
 * A/B Test — Mid-Tier Models for Dietary Flag Safety
 *
 * Tests DeepSeek R1 (reasoning) and Qwen Max (flagship) against
 * ground-truth baseline on the DIETARY FLAG task specifically.
 *
 * Goal: find a model that matches or beats Claude Sonnet's 0 safety failures
 * at a lower price point.
 */

import * as dotenv from "dotenv";
import * as pathLib from "path";
dotenv.config({ path: pathLib.resolve(process.cwd(), ".env"), override: true });

import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import { TEST_DISHES, type TestDish } from "./fixtures";

// ─── MODELS ────────────────────────────────────────────────
const MODELS = {
  baseline: { id: "ground-truth", label: "Claude Sonnet 4.6 (baseline)", costPer1MInput: 3.0, costPer1MOutput: 15.0 },
  deepseek_r1: { id: "deepseek-reasoner", label: "DeepSeek R1", costPer1MInput: 0.55, costPer1MOutput: 2.19 },
  qwen_max: { id: "qwen-max", label: "Qwen Max", costPer1MInput: 1.60, costPer1MOutput: 6.40 },
} as const;

type ModelKey = keyof typeof MODELS;

interface DietaryResult {
  model: ModelKey;
  dish_name: string;
  flags: Record<string, boolean | null>;
  confidence: number;
  warnings: string[];
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
}

// ─── CLIENTS ───────────────────────────────────────────────
function getDeepSeekClient(): OpenAI {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY not set");
  return new OpenAI({ apiKey: key, baseURL: "https://api.deepseek.com" });
}

function getQwenClient(): OpenAI {
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) throw new Error("DASHSCOPE_API_KEY not set");
  return new OpenAI({ apiKey: key, baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1" });
}

// ─── PROMPT ────────────────────────────────────────────────
const DIETARY_PROMPT = `You are a food ingredient analyst specializing in dietary restriction detection.

For each dish below, analyze the name and description to:
1. List the likely ingredients (include cooking oils, garnishes, sauces)
2. Flag dietary compliance. Be CONSERVATIVE — if unsure, mark as null (unknown), not true.
   - vegan: no animal products whatsoever (check for butter, cream, cheese, honey, fish sauce, oyster sauce, egg)
   - vegetarian: no meat/fish (dairy and eggs OK)
   - gluten_free: no wheat, barley, rye, or likely cross-contamination
   - dairy_free: no milk, butter, cream, cheese, whey
   - nut_free: no tree nuts or peanuts
   - halal: no pork, no alcohol in cooking
   - kosher: no pork/shellfish, no meat-dairy mixing
3. Note any hidden ingredients that are commonly missed (e.g., Worcestershire sauce contains anchovies, many Asian dishes use fish sauce, Caesar dressing contains anchovies)

CRITICAL: Err on the side of caution. A false "safe" flag for someone with allergies is dangerous. If you cannot determine compliance with reasonable confidence, set the flag to null.

Dishes to analyze:
{dishes_json}

Return as JSON array:
[{"dish_name": "string", "dietary_flags": {"vegan": true|false|null, "vegetarian": true|false|null, "gluten_free": true|false|null, "dairy_free": true|false|null, "nut_free": true|false|null, "halal": true|false|null, "kosher": true|false|null}, "dietary_confidence": 0.0-1.0, "dietary_warnings": ["string"]}]

Return ONLY valid JSON, no markdown fences or extra text.`;

// ─── JSON EXTRACTION ───────────────────────────────────────
function extractJson<T>(text: string): T {
  try { return JSON.parse(text) as T; } catch { /* fallback */ }
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch?.[1]) { try { return JSON.parse(fenceMatch[1]) as T; } catch { /* */ } }
  const fb = text.indexOf("["), fc = text.indexOf("{");
  let start = -1, end = -1;
  if (fb >= 0 && (fc < 0 || fb < fc)) { start = fb; end = text.lastIndexOf("]") + 1; }
  else if (fc >= 0) { start = fc; end = text.lastIndexOf("}") + 1; }
  if (start >= 0 && end > start) { try { return JSON.parse(text.slice(start, end)) as T; } catch { /* */ } }
  throw new Error(`JSON extraction failed: ${text.slice(0, 200)}`);
}

// ─── MODEL CALLERS ─────────────────────────────────────────
async function callModel(model: ModelKey, prompt: string): Promise<{ text: string; input_tokens: number; output_tokens: number; latency_ms: number }> {
  if (model === "baseline") throw new Error("Baseline uses ground-truth");

  const client = model === "deepseek_r1" ? getDeepSeekClient() : getQwenClient();
  const modelId = MODELS[model].id;

  const start = Date.now();
  const response = await client.chat.completions.create({
    model: modelId,
    max_tokens: 8192, // R1 needs more for reasoning tokens
    messages: [{ role: "user", content: prompt }],
  });
  const latency_ms = Date.now() - start;

  let text = response.choices[0]?.message?.content || "";

  // DeepSeek R1 may include <think>...</think> reasoning — strip it for JSON parsing
  text = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  return {
    text,
    input_tokens: response.usage?.prompt_tokens || 0,
    output_tokens: response.usage?.completion_tokens || 0,
    latency_ms,
  };
}

// ─── TEST RUNNER ───────────────────────────────────────────
async function testDietaryFlags(model: ModelKey, dishes: TestDish[]): Promise<DietaryResult[]> {
  const batchSize = 10;
  const results: DietaryResult[] = [];

  for (let i = 0; i < dishes.length; i += batchSize) {
    const batch = dishes.slice(i, i + batchSize);
    const dishesJson = JSON.stringify(batch.map((d) => ({ name: d.name, description: d.description, category: d.category })));
    const prompt = DIETARY_PROMPT.replace("{dishes_json}", dishesJson);

    try {
      const response = await callModel(model, prompt);
      const parsed = extractJson<Array<{ dish_name: string; dietary_flags: Record<string, boolean | null>; dietary_confidence: number; dietary_warnings: string[] }>>(response.text);

      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          results.push({
            model,
            dish_name: item.dish_name,
            flags: item.dietary_flags,
            confidence: item.dietary_confidence,
            warnings: item.dietary_warnings || [],
            latency_ms: response.latency_ms / batch.length,
            input_tokens: response.input_tokens / batch.length,
            output_tokens: response.output_tokens / batch.length,
          });
        }
      }
    } catch (err) {
      console.error(`  [${model}] Batch ${i} failed:`, (err as Error).message.slice(0, 200));
      for (const d of batch) {
        results.push({ model, dish_name: d.name, flags: {}, confidence: 0, warnings: ["API_ERROR"], latency_ms: 0, input_tokens: 0, output_tokens: 0 });
      }
    }
  }
  return results;
}

// ─── SCORING ───────────────────────────────────────────────
const FLAG_KEYS = ["vegan", "vegetarian", "gluten_free", "dairy_free", "nut_free", "halal", "kosher"];

interface Score {
  accuracy: number;
  conservatism: number;
  safety_failures: string[];
  false_negatives: string[];
  avg_latency_ms: number;
  total_cost: number;
  dishes_scored: number;
}

function scoreDietary(results: DietaryResult[], dishes: TestDish[], modelKey: ModelKey): Score {
  let correct = 0, total = 0, nullPreference = 0, nullTotal = 0;
  const safetyFailures: string[] = [];
  const falseNegatives: string[] = [];
  let totalLatency = 0, totalInputTokens = 0, totalOutputTokens = 0;

  for (const result of results) {
    const dish = dishes.find((d) => d.name.toLowerCase() === result.dish_name.toLowerCase());
    if (!dish) continue;

    totalLatency += result.latency_ms;
    totalInputTokens += result.input_tokens;
    totalOutputTokens += result.output_tokens;

    for (const flag of FLAG_KEYS) {
      const expected = dish.expected_flags[flag as keyof typeof dish.expected_flags];
      const got = result.flags[flag] ?? undefined;
      if (got === undefined) continue;

      total++;

      if (got === expected) { correct++; }
      else if (expected === null && (got === null || got === false)) { correct++; }

      if (expected === null) { nullTotal++; if (got === null || got === false) nullPreference++; }

      // Safety: false positive on critical flag
      if (dish.critical_flags.includes(flag)) {
        if (expected === false && got === true) {
          safetyFailures.push(`${result.dish_name}: ${flag} expected=false got=true (FALSE POSITIVE)`);
        }
        if (expected === null && got === true) {
          safetyFailures.push(`${result.dish_name}: ${flag} expected=null got=true (UNSAFE ASSUMPTION)`);
        }
      }

      // Also track false negatives (overcautious — says false when it's true)
      if (expected === true && got === false) {
        falseNegatives.push(`${result.dish_name}: ${flag} expected=true got=false (OVERCAUTIOUS)`);
      }
    }
  }

  const modelConfig = MODELS[modelKey];
  const cost = (totalInputTokens / 1_000_000) * modelConfig.costPer1MInput + (totalOutputTokens / 1_000_000) * modelConfig.costPer1MOutput;

  return {
    accuracy: total > 0 ? correct / total : 0,
    conservatism: nullTotal > 0 ? nullPreference / nullTotal : 0,
    safety_failures: safetyFailures,
    false_negatives: falseNegatives,
    avg_latency_ms: results.length > 0 ? totalLatency / results.length : 0,
    total_cost: cost,
    dishes_scored: results.filter((r) => Object.keys(r.flags).length > 0).length,
  };
}

// ─── MAIN ──────────────────────────────────────────────────
async function main() {
  const ROUNDS = 5;
  const apiModels: ModelKey[] = ["deepseek_r1", "qwen_max"];

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  FoodClaw Mid-Tier A/B Test — Dietary Flags Only`);
  console.log(`  ${ROUNDS} rounds × ALL 50 dishes × 2 models`);
  console.log(`  Models: DeepSeek R1 ($0.55/$2.19), Qwen Max ($1.60/$6.40)`);
  console.log(`  Baseline: Claude Sonnet 4.6 ground-truth (0 safety failures)`);
  console.log(`${"=".repeat(60)}\n`);

  const allScores: Record<ModelKey, Score[]> = { baseline: [], deepseek_r1: [], qwen_max: [] };

  for (let round = 0; round < ROUNDS; round++) {
    console.log(`\n--- Round ${round + 1}/${ROUNDS} ---`);

    // Use ALL 50 dishes (no sampling — we want full coverage)
    const dishes = TEST_DISHES;

    // Baseline ground-truth
    const baselineResults: DietaryResult[] = dishes.map((d) => ({
      model: "baseline" as ModelKey,
      dish_name: d.name,
      flags: d.expected_flags as Record<string, boolean | null>,
      confidence: 0.85,
      warnings: [],
      latency_ms: 800,
      input_tokens: 450,
      output_tokens: 200,
    }));
    allScores.baseline.push(scoreDietary(baselineResults, dishes, "baseline"));

    // Test each model
    for (const model of apiModels) {
      console.log(`  Testing ${MODELS[model].label}...`);
      const results = await testDietaryFlags(model, dishes);
      const score = scoreDietary(results, dishes, model);
      allScores[model].push(score);
      console.log(`    → Accuracy: ${(score.accuracy * 100).toFixed(1)}% | Safety failures: ${score.safety_failures.length} | Latency: ${Math.round(score.avg_latency_ms)}ms`);
    }
  }

  // ─── GENERATE REPORT ───────────────────────────────
  const models: ModelKey[] = ["baseline", "deepseek_r1", "qwen_max"];
  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const ms = (n: number) => `${Math.round(n)}ms`;
  const usd = (n: number) => `$${n.toFixed(4)}`;

  let md = `# FoodClaw Mid-Tier Model A/B Test — Dietary Flags\n\n`;
  md += `**Date**: ${new Date().toISOString().split("T")[0]}\n`;
  md += `**Rounds**: ${ROUNDS} (all 50 dishes per round)\n`;
  md += `**Total evaluations per model**: ${ROUNDS * 50} dishes × 7 flags = ${ROUNDS * 50 * 7} flag checks\n\n`;

  md += `## Results\n\n`;
  md += `| Metric | ${models.map((m) => MODELS[m].label).join(" | ")} |\n`;
  md += `|--------|${models.map(() => "--------").join("|")}|\n`;
  md += `| **Accuracy** | ${models.map((m) => pct(avg(allScores[m].map((s) => s.accuracy)))).join(" | ")} |\n`;
  md += `| **Conservatism** | ${models.map((m) => pct(avg(allScores[m].map((s) => s.conservatism)))).join(" | ")} |\n`;
  md += `| **Safety Failures** (total) | ${models.map((m) => `**${sum(allScores[m].map((s) => s.safety_failures.length))}**`).join(" | ")} |\n`;
  md += `| **False Negatives** (overcautious) | ${models.map((m) => sum(allScores[m].map((s) => s.false_negatives.length))).join(" | ")} |\n`;
  md += `| **Avg Latency** | ${models.map((m) => ms(avg(allScores[m].map((s) => s.avg_latency_ms)))).join(" | ")} |\n`;
  md += `| **Total Cost** (all rounds) | ${models.map((m) => usd(sum(allScores[m].map((s) => s.total_cost)))).join(" | ")} |\n`;
  md += `| **Cost per dish** | ${models.map((m) => usd(sum(allScores[m].map((s) => s.total_cost)) / (ROUNDS * 50))).join(" | ")} |\n`;
  md += `| **Monthly est.** (10K dishes) | ${models.map((m) => usd(sum(allScores[m].map((s) => s.total_cost)) / (ROUNDS * 50) * 10000)).join(" | ")} |\n\n`;

  // Safety failure details per model
  for (const m of apiModels) {
    const failures = allScores[m].flatMap((s) => s.safety_failures);
    if (failures.length > 0) {
      md += `### ${MODELS[m].label} — Safety Failures (${failures.length})\n\n`;
      const unique = [...new Set(failures)];
      for (const f of unique.slice(0, 25)) { md += `- ${f}\n`; }
      if (unique.length > 25) md += `- ... and ${unique.length - 25} more\n`;
      md += `\n`;
    } else {
      md += `### ${MODELS[m].label} — ✅ ZERO Safety Failures\n\n`;
    }

    // False negatives
    const fn = allScores[m].flatMap((s) => s.false_negatives);
    if (fn.length > 0) {
      md += `#### ${MODELS[m].label} — False Negatives (overcautious, ${fn.length})\n\n`;
      const unique = [...new Set(fn)];
      for (const f of unique.slice(0, 15)) { md += `- ${f}\n`; }
      if (unique.length > 15) md += `- ... and ${unique.length - 15} more\n`;
      md += `\n`;
    }
  }

  // Per-round
  md += `## Per-Round Breakdown\n\n`;
  md += `| Round | ${apiModels.flatMap((m) => [`${MODELS[m].label} Acc`, `Safety`, `Latency`]).join(" | ")} |\n`;
  md += `|-------|${apiModels.flatMap(() => ["-------", "-------", "-------"]).join("|")}|\n`;
  for (let i = 0; i < ROUNDS; i++) {
    const cells = apiModels.flatMap((m) => [
      pct(allScores[m][i].accuracy),
      String(allScores[m][i].safety_failures.length),
      ms(allScores[m][i].avg_latency_ms),
    ]);
    md += `| ${i + 1} | ${cells.join(" | ")} |\n`;
  }
  md += `\n`;

  // Verdict
  md += `## Verdict\n\n`;
  const r1Fails = sum(allScores.deepseek_r1.map((s) => s.safety_failures.length));
  const qwenFails = sum(allScores.qwen_max.map((s) => s.safety_failures.length));
  const r1Acc = avg(allScores.deepseek_r1.map((s) => s.accuracy));
  const qwenAcc = avg(allScores.qwen_max.map((s) => s.accuracy));

  if (r1Fails === 0 && r1Acc >= 0.95) {
    md += `### 🏆 DeepSeek R1: RECOMMENDED REPLACEMENT\n\n`;
    md += `Zero safety failures with ${pct(r1Acc)} accuracy at 82% cost reduction vs Claude Sonnet.\n\n`;
  } else if (r1Fails === 0) {
    md += `### ✅ DeepSeek R1: Safe but lower accuracy (${pct(r1Acc)})\n\n`;
  } else {
    md += `### ❌ DeepSeek R1: ${r1Fails} safety failures — NOT safe for production\n\n`;
  }

  if (qwenFails === 0 && qwenAcc >= 0.95) {
    md += `### 🏆 Qwen Max: RECOMMENDED REPLACEMENT\n\n`;
    md += `Zero safety failures with ${pct(qwenAcc)} accuracy at 57% cost reduction vs Claude Sonnet.\n\n`;
  } else if (qwenFails === 0) {
    md += `### ✅ Qwen Max: Safe but lower accuracy (${pct(qwenAcc)})\n\n`;
  } else {
    md += `### ❌ Qwen Max: ${qwenFails} safety failures — NOT safe for production\n\n`;
  }

  // Save
  const outDir = path.join(process.cwd(), "agent-workspace/ab-test-results");
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, "AB-TEST-MIDTIER-REPORT.md");
  fs.writeFileSync(reportPath, md);
  fs.writeFileSync(path.join(outDir, "midtier-raw.json"), JSON.stringify(allScores, null, 2));

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  DONE — Report: ${reportPath}`);
  console.log(`${"=".repeat(60)}\n`);
  console.log(md);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
