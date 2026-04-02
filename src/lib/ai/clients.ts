/**
 * Centralized AI model clients for all agents.
 *
 * Model strategy (April 2026):
 * - Gemini 2.5 Flash: Vision tasks, OCR, HTML extraction (best accuracy/cost for vision)
 * - Claude Sonnet 4.6: Safety-critical dietary analysis + client-facing review summaries
 * - GPT-4.1 nano: Simple ingredient matching (cheapest option for trivial tasks)
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

// ─── Gemini (Vision, OCR, HTML extraction) ──────────────
let _gemini: GoogleGenerativeAI | null = null;
export function getGeminiClient(): GoogleGenerativeAI {
  if (!_gemini) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is required for vision/OCR tasks");
    _gemini = new GoogleGenerativeAI(key);
  }
  return _gemini;
}

/** Gemini 2.5 Flash — best vision-per-dollar, 94% OCR accuracy */
export const GEMINI_FLASH = "gemini-2.5-flash";

// ─── Claude (Safety-critical + client-facing) ───────────
let _anthropic: Anthropic | null = null;
export function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic();
  }
  return _anthropic;
}

/** Claude Sonnet 4.6 — best for dietary safety + natural review writing */
export const CLAUDE_SONNET = "claude-sonnet-4-6-20260204";

// ─── OpenAI (Cheap utility tasks) ───────────────────────
let _openai: OpenAI | null = null;
export function getOpenAIClient(): OpenAI {
  if (!_openai) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is required for USDA matching");
    _openai = new OpenAI({ apiKey: key });
  }
  return _openai;
}

/** GPT-4.1 nano — cheapest model, good for simple string matching tasks */
export const GPT_NANO = "gpt-4.1-nano";
