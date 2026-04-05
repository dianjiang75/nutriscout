import { prisma } from "@/lib/db/client";
import type { ArchiveReason } from "@/generated/prisma/client";

/**
 * Soft-archive a menu item by setting archivedAt and archivedReason.
 * Does not delete the row — it remains queryable with an archive timestamp.
 */
export async function archiveMenuItem(
  id: string,
  reason: ArchiveReason
): Promise<void> {
  await prisma.menuItem.update({
    where: { id },
    data: { archivedAt: new Date(), archivedReason: reason },
  });
}

/**
 * Restore an archived menu item by clearing archivedAt and archivedReason.
 */
export async function restoreMenuItem(id: string): Promise<void> {
  await prisma.menuItem.update({
    where: { id },
    data: { archivedAt: null, archivedReason: null },
  });
}

/** Minimum days an item must be archived before hard-delete is allowed. */
const HARD_DELETE_MIN_ARCHIVE_DAYS = 7;

/** Minimum audit confidence required for hard-delete. */
const HARD_DELETE_MIN_CONFIDENCE = 0.9;

/**
 * Hard-delete a menu item. Enforced rules:
 * - archivedReason must be 'junk_detected'
 * - auditConfidence >= 0.9
 * - archivedAt at least 7 days old
 * Throws if any rule is not met.
 */
export async function hardDeleteMenuItem(id: string): Promise<void> {
  const item = await prisma.menuItem.findUniqueOrThrow({
    where: { id },
    select: {
      archivedAt: true,
      archivedReason: true,
      auditConfidence: true,
    },
  });

  if (item.archivedReason !== "junk_detected") {
    throw new Error(
      `Hard-delete refused: archivedReason is "${item.archivedReason}", must be "junk_detected"`
    );
  }

  const confidence = item.auditConfidence
    ? Number(item.auditConfidence)
    : 0;
  if (confidence < HARD_DELETE_MIN_CONFIDENCE) {
    throw new Error(
      `Hard-delete refused: auditConfidence is ${confidence}, must be >= ${HARD_DELETE_MIN_CONFIDENCE}`
    );
  }

  if (!item.archivedAt) {
    throw new Error("Hard-delete refused: item is not archived (archivedAt is null)");
  }

  const ageMs = Date.now() - item.archivedAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays < HARD_DELETE_MIN_ARCHIVE_DAYS) {
    throw new Error(
      `Hard-delete refused: archived ${ageDays.toFixed(1)} days ago, must be >= ${HARD_DELETE_MIN_ARCHIVE_DAYS} days`
    );
  }

  // Bypass the soft-delete extension by using $executeRawUnsafe
  // (the $extends middleware would convert a normal delete to a soft-delete)
  await prisma.$executeRawUnsafe(
    `DELETE FROM menu_items WHERE id = $1`,
    id
  );
}

// ---- Name normalization for deduplication ----

/** Parenthetical dietary/descriptor tags to strip (case-insensitive). */
const PAREN_TAG_PATTERN =
  /\(\s*(?:v|vg|gf|df|nf|spicy|new|hot|small|large|regular)\s*\)/gi;

/** Trailing size modifiers after a dash or in parentheses. */
const SIZE_MODIFIER_PATTERN =
  /\s*-\s*(?:small|large|regular|medium)\s*$/i;

/** Footnote markers. */
const FOOTNOTE_PATTERN = /[*\u2020\u2021]+/g; // *, †, ‡

/**
 * Normalize a dish name for deduplication.
 * Lowercase, strip dietary annotations, size modifiers, special chars,
 * collapse whitespace, and trim.
 */
export function normalizeName(name: string): string {
  let n = name.toLowerCase();

  // Strip parenthetical dietary/descriptor tags: (V), (GF), (spicy), etc.
  n = n.replace(PAREN_TAG_PATTERN, "");

  // Strip trailing size modifiers: "- Small", "- Large"
  n = n.replace(SIZE_MODIFIER_PATTERN, "");

  // Strip footnote markers: *, †, ‡
  n = n.replace(FOOTNOTE_PATTERN, "");

  // Collapse whitespace and trim
  n = n.replace(/\s+/g, " ").trim();

  return n;
}
