# FoodClaw A/B Model Test Report

**Date**: 2026-04-03
**Agents**: 25
**Dishes tested per agent**: 25 (of 50 fixtures, randomized)
**Review sets per agent**: 10 (of 20 fixtures, randomized)

## 1. Dietary Flag Analysis (Safety-Critical)

| Metric | Claude Sonnet 4.6 (baseline) | DeepSeek V4 | Qwen 3 |
|--------|--------|--------|--------|
| **Accuracy** | 100.0% | 96.8% | 94.9% |
| **Conservatism** (null preference) | 0.0% | 93.5% | 55.4% |
| **Avg Latency** | 800ms | 4195ms | 3485ms |
| **Total Cost** (all agents) | $2.7188 | $0.1144 | $0.0838 |
| **Cost per dish** | $0.0043 | $0.0002 | $0.0001 |
| **Safety Failures** | **0** | **10** | **36** |

### DeepSeek V4 Safety Failures (10)

- Bibimbap: nut_free expected=null got=true (UNSAFE ASSUMPTION)
- Chicken Tikka Masala: nut_free expected=null got=true (UNSAFE ASSUMPTION)
- Butter Chicken: nut_free expected=null got=true (UNSAFE ASSUMPTION)

### Qwen 3 Safety Failures (36)

- Bibimbap: nut_free expected=null got=true (UNSAFE ASSUMPTION)
- Falafel Wrap: nut_free expected=null got=true (UNSAFE ASSUMPTION)
- Chicken Tikka Masala: nut_free expected=null got=true (UNSAFE ASSUMPTION)
- Butter Chicken: nut_free expected=null got=true (UNSAFE ASSUMPTION)

## 2. Review Summarization (Client-Facing)

| Metric | Claude Sonnet 4.6 (baseline) | DeepSeek V4 | Qwen 3 |
|--------|--------|--------|--------|
| **Theme Coverage** | 100.0% | 86.6% | 92.0% |
| **Avg Latency** | 1200ms | 5736ms | 3902ms |
| **Total Cost** (all agents) | $1.5750 | $0.0681 | $0.0426 |
| **Cost per summary** | $0.0063 | $0.0003 | $0.0002 |

## 3. Cost Comparison (projected monthly)

Assuming 10,000 dishes/month + 5,000 review summaries/month:

- **Claude Sonnet 4.6 (baseline)**: $75.0000/month
- **DeepSeek V4**: $3.1909/month
- **Qwen 3**: $2.1926/month

## 4. Verdict

### Dietary Flags: KEEP Claude Sonnet

- DeepSeek V4 had **10 safety failure(s)** — false positives on allergen-critical flags. NOT safe for production.
- Qwen 3 had **36 safety failure(s)** — false positives on allergen-critical flags. NOT safe for production.
- Claude Sonnet had **0 safety failures**. Remains the safest choice for dietary analysis.

### Review Summaries:

- **Claude Sonnet 4.6 (baseline)**: 100.0% theme coverage
- **DeepSeek V4**: 86.6% theme coverage (-13.4% vs Claude, 95.7% cheaper)
- **Qwen 3**: 92.0% theme coverage (-8.0% vs Claude, 97.3% cheaper)

## 5. Per-Agent Raw Scores

| Agent | Claude Sonnet 4.6 (baseline) Acc | Claude Sonnet 4.6 (baseline) Safety | Claude Sonnet 4.6 (baseline) Review | DeepSeek V4 Acc | DeepSeek V4 Safety | DeepSeek V4 Review | Qwen 3 Acc | Qwen 3 Safety | Qwen 3 Review |
|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|
| #1 | 100.0% | 0 | 100.0% | 96.0% | 0 | 85.7% | 92.7% | 2 | 88.1% |
| #2 | 100.0% | 0 | 100.0% | 98.1% | 1 | 84.6% | 94.8% | 1 | 89.7% |
| #3 | 100.0% | 0 | 100.0% | 95.9% | 1 | 87.8% | 96.6% | 2 | 92.7% |
| #4 | 100.0% | 0 | 100.0% | 96.3% | 1 | 90.2% | 91.3% | 3 | 92.7% |
| #5 | 100.0% | 0 | 100.0% | 98.4% | 0 | 82.1% | 96.4% | 2 | 89.7% |
| #6 | 100.0% | 0 | 100.0% | 97.5% | 0 | 84.2% | 97.9% | 0 | 92.1% |
| #7 | 100.0% | 0 | 100.0% | 96.3% | 0 | 80.0% | 94.6% | 0 | 90.0% |
| #8 | 100.0% | 0 | 100.0% | 98.1% | 0 | 92.7% | 97.1% | 2 | 92.7% |
| #9 | 100.0% | 0 | 100.0% | 99.1% | 0 | 85.4% | 94.2% | 2 | 90.2% |
| #10 | 100.0% | 0 | 100.0% | 94.7% | 1 | 90.2% | 93.0% | 1 | 95.1% |
| #11 | 100.0% | 0 | 100.0% | 95.9% | 1 | 89.7% | 93.5% | 1 | 94.9% |
| #12 | 100.0% | 0 | 100.0% | 96.5% | 0 | 75.0% | 97.6% | 0 | 90.0% |
| #13 | 100.0% | 0 | 100.0% | 95.5% | 0 | 85.4% | 97.2% | 1 | 82.9% |
| #14 | 100.0% | 0 | 100.0% | 95.7% | 0 | 92.3% | 94.7% | 1 | 94.9% |
| #15 | 100.0% | 0 | 100.0% | 97.3% | 0 | 87.8% | 94.6% | 2 | 92.7% |
| #16 | 100.0% | 0 | 100.0% | 96.2% | 0 | 90.5% | 92.3% | 1 | 97.6% |
| #17 | 100.0% | 0 | 100.0% | 99.2% | 0 | 87.8% | 99.0% | 0 | 92.7% |
| #18 | 100.0% | 0 | 100.0% | 97.5% | 3 | 88.4% | 92.2% | 4 | 90.7% |
| #19 | 100.0% | 0 | 100.0% | 98.5% | 1 | 82.1% | 95.1% | 3 | 87.2% |
| #20 | 100.0% | 0 | 100.0% | 95.8% | 0 | 82.9% | 95.5% | 1 | 92.7% |
| #21 | 100.0% | 0 | 100.0% | 96.4% | 0 | 85.0% | 92.4% | 1 | 95.0% |
| #22 | 100.0% | 0 | 100.0% | 95.7% | 0 | 90.2% | 97.3% | 1 | 92.7% |
| #23 | 100.0% | 0 | 100.0% | 97.5% | 1 | 90.5% | 91.0% | 2 | 92.9% |
| #24 | 100.0% | 0 | 100.0% | 94.2% | 0 | 85.0% | 95.3% | 1 | 95.0% |
| #25 | 100.0% | 0 | 100.0% | 98.1% | 0 | 90.2% | 94.8% | 2 | 95.1% |

