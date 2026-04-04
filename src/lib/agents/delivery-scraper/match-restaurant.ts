/**
 * Fuzzy restaurant matching for delivery platforms.
 *
 * Uses Dice coefficient on bigrams for name similarity (handles
 * "Joe's Pizza" vs "Joes Pizza") + address street number/name matching.
 *
 * Composite score: nameSimilarity * 0.6 + addressSimilarity * 0.4
 * Accept matches above 0.7 confidence.
 */

/** Generate character bigrams from a string. */
function bigrams(str: string): Set<string> {
  const s = str.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const bg = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) {
    bg.add(s.slice(i, i + 2));
  }
  return bg;
}

/** Dice coefficient: 2 * |A ∩ B| / (|A| + |B|). Returns 0-1. */
function diceCoefficient(a: string, b: string): number {
  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);
  if (bigramsA.size === 0 && bigramsB.size === 0) return 1;
  if (bigramsA.size === 0 || bigramsB.size === 0) return 0;

  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }
  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

/** Extract street number and street name from an address. */
function parseStreet(address: string): { number: string; name: string } {
  const clean = address.toLowerCase().trim();
  const match = clean.match(/^(\d+)\s+(.+?)(?:,|$)/);
  if (match) {
    return { number: match[1], name: match[2].trim() };
  }
  return { number: "", name: clean.split(",")[0].trim() };
}

/**
 * Compare two addresses. Checks street number match (exact) and
 * street name similarity (substring check + Dice coefficient).
 */
function addressSimilarity(addr1: string, addr2: string): number {
  if (!addr1 || !addr2) return 0;

  const s1 = parseStreet(addr1);
  const s2 = parseStreet(addr2);

  let score = 0;

  // Street number match (exact) — strong signal
  if (s1.number && s2.number) {
    if (s1.number === s2.number) {
      score += 0.5;
    } else {
      return 0; // Different street numbers = definitely different place
    }
  }

  // Street name similarity
  const nameSim = diceCoefficient(s1.name, s2.name);
  score += nameSim * 0.5;

  return Math.min(1, score);
}

export interface MatchCandidate {
  name: string;
  address: string | null;
  url: string;
}

export interface MatchScore {
  candidate: MatchCandidate;
  nameScore: number;
  addressScore: number;
  compositeScore: number;
}

const MATCH_THRESHOLD = 0.7;

/**
 * Find the best matching restaurant from a list of candidates.
 *
 * @param targetName - Our restaurant name from Google Places
 * @param targetAddress - Our restaurant address
 * @param candidates - Search results from the delivery platform
 * @returns Best match above threshold, or null
 */
export function findBestMatch(
  targetName: string,
  targetAddress: string,
  candidates: MatchCandidate[]
): MatchScore | null {
  if (candidates.length === 0) return null;

  const scores: MatchScore[] = candidates.map((candidate) => {
    const nameScore = diceCoefficient(targetName, candidate.name);
    const addrScore = candidate.address
      ? addressSimilarity(targetAddress, candidate.address)
      : 0;
    const compositeScore = nameScore * 0.6 + addrScore * 0.4;

    return { candidate, nameScore, addressScore: addrScore, compositeScore };
  });

  // Sort by composite score descending
  scores.sort((a, b) => b.compositeScore - a.compositeScore);

  const best = scores[0];
  if (best.compositeScore >= MATCH_THRESHOLD) return best;

  return null;
}

/**
 * Fuzzy-match a scraped item name to existing dish names.
 * Uses Dice coefficient with a lower threshold (0.6) since
 * delivery platforms often truncate or rephrase dish names.
 */
export function matchItemToDish(
  scrapedName: string,
  dishNames: { id: string; name: string }[]
): { id: string; name: string; score: number } | null {
  let bestMatch: { id: string; name: string; score: number } | null = null;

  for (const dish of dishNames) {
    const score = diceCoefficient(scrapedName, dish.name);
    if (score > (bestMatch?.score ?? 0.6)) {
      bestMatch = { id: dish.id, name: dish.name, score };
    }
  }

  return bestMatch;
}
