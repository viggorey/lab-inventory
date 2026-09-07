/**
 * Suggests which inventory items a manuals archive covers, by reading the
 * index document.
 *
 * Two signals, in order of confidence:
 *
 *  1. An explicit marker anywhere in the index:
 *
 *       <!-- equipment: Femto Oxygen Plasma Cleaner -->
 *       <!-- equipment: Basler acA2040; Photron SA-Z -->
 *
 *     Markdown comments do not render, so these stay invisible to readers.
 *     Names are matched case-insensitively against the inventory.
 *
 *  2. Section headings. Index headings name the equipment a section covers
 *     ("## Plasma cleaner (Diener Zepto)"), so inventory items are scored
 *     against heading text rather than the whole document — matching the body
 *     produces far too much noise.
 *
 * Nothing is linked automatically. These are proposals for an admin to accept.
 */

export type SuggestionReason = 'explicit' | 'heading';

export interface EquipmentItem {
  id: string;
  name: string;
  category: string;
}

export interface Suggestion {
  item: EquipmentItem;
  reason: SuggestionReason;
  /** The heading or marker the match came from, for display. */
  matchedOn: string;
}

const EXPLICIT_MARKER = /<!--\s*equipment:\s*([^>]*?)\s*-->/gi;

/** Words too generic to carry a match on their own. */
const WEAK_TOKENS = new Set([
  'the', 'and', 'for', 'with', 'system', 'unit', 'set', 'kit', 'lab',
  'new', 'old', 'small', 'large', 'box', 'type', 'model', 'general',
]);

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Crude singularisation so "Cameras" and "Camera" match. */
function singular(token: string): string {
  if (token.length > 4 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.length > 3 && token.endsWith('es') && !token.endsWith('ses')) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

function tokens(text: string): string[] {
  return normalise(text)
    .split(' ')
    .filter((t) => t.length > 2 && !WEAK_TOKENS.has(t))
    .map(singular);
}

/** Headings of any level, plus bold-only lines used as pseudo-headings. */
export function extractHeadings(markdown: string): string[] {
  const out: string[] = [];
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      out.push(heading[1].replace(/[*_`]/g, '').trim());
      continue;
    }
    const bold = line.match(/^\*\*(.+?)\*\*:?$/);
    if (bold) out.push(bold[1].trim());
  }
  return out.filter(Boolean);
}

export function extractExplicitNames(markdown: string): string[] {
  const names: string[] = [];
  for (const match of markdown.matchAll(EXPLICIT_MARKER)) {
    for (const part of match[1].split(/[;,]/)) {
      const name = part.trim();
      if (name) names.push(name);
    }
  }
  return names;
}

/**
 * Score an inventory item against one heading.
 * Returns 0 when there is no meaningful overlap.
 */
function scoreAgainstHeading(itemName: string, heading: string): number {
  const itemTokens = tokens(itemName);
  const headingTokens = tokens(heading);
  if (itemTokens.length === 0 || headingTokens.length === 0) return 0;

  const headingSet = new Set(headingTokens);
  const itemSet = new Set(itemTokens);

  const present = itemTokens.filter((t) => headingSet.has(t));
  if (present.length === 0) return 0;

  // Two of the item's words appearing side by side in the heading
  // ("plasma cleaner") is a much stronger signal than scattered single words.
  let contiguousBonus = 0;
  for (let i = 0; i < itemTokens.length - 1; i++) {
    for (let j = 0; j < headingTokens.length - 1; j++) {
      if (itemTokens[i] === headingTokens[j] && itemTokens[i + 1] === headingTokens[j + 1]) {
        contiguousBonus = 0.4;
        break;
      }
    }
    if (contiguousBonus) break;
  }

  // Reward covering the heading's own words too, so a one-word item name does
  // not match every heading that happens to contain that word.
  const headingCoverage = headingTokens.filter((t) => itemSet.has(t)).length / headingTokens.length;
  const itemCoverage = present.length / itemTokens.length;

  return Math.min(1, itemCoverage * 0.5 + headingCoverage * 0.4 + contiguousBonus);
}

const SCORE_THRESHOLD = 0.45;

export function suggestEquipment(
  indexText: string,
  equipment: EquipmentItem[]
): Suggestion[] {
  if (!indexText.trim() || equipment.length === 0) return [];

  const results = new Map<string, Suggestion>();

  // 1. Explicit markers win outright.
  const explicit = extractExplicitNames(indexText).map((n) => normalise(n));
  for (const item of equipment) {
    const name = normalise(item.name);
    const hit = explicit.find((e) => e === name);
    if (hit) {
      results.set(item.id, { item, reason: 'explicit', matchedOn: item.name });
    }
  }

  // 2. Heading matches for anything not already matched explicitly.
  const headings = extractHeadings(indexText);
  for (const item of equipment) {
    if (results.has(item.id)) continue;

    let best = { score: 0, heading: '' };
    for (const heading of headings) {
      const score = scoreAgainstHeading(item.name, heading);
      if (score > best.score) best = { score, heading };
    }

    if (best.score >= SCORE_THRESHOLD) {
      results.set(item.id, { item, reason: 'heading', matchedOn: best.heading });
    }
  }

  // Explicit first, then alphabetical.
  return [...results.values()].sort((a, b) => {
    if (a.reason !== b.reason) return a.reason === 'explicit' ? -1 : 1;
    return a.item.name.localeCompare(b.item.name);
  });
}
