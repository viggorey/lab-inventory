/**
 * Suggests which inventory items a manuals archive covers, by reading the
 * index document.
 *
 * This is plain string matching — no model, no network call. The same index
 * always produces the same suggestions.
 *
 * Three signals, in order of confidence:
 *
 *  1. An explicit marker naming an inventory item exactly:
 *
 *       <!-- equipment: Femto Oxygen Plasma Cleaner -->
 *       <!-- equipment: Basler acA2040; Photron SA-Z -->
 *
 *  2. A keyword block listing aliases, one rig per line, separated by "|":
 *
 *       <!-- lab-system:keywords
 *       Plasma cleaner | Diener Zepto | Femto oxygen plasma cleaner
 *       Air compressor | PTA513 | Jun Air 64 | compressed air
 *       -->
 *
 *     Each alias is scored independently against every inventory item and the
 *     best score per item wins. Short aliases are what make the scoring work:
 *     the phrase-coverage term divides by the phrase's own word count, so a
 *     long list of synonyms crammed into one string dilutes itself, while
 *     "Diener Zepto" on its own is a clean two-word signal.
 *
 *  3. Section headings — only when no keyword block is present, so indexes
 *     written before this existed still produce suggestions.
 *
 * Markdown comments do not render, so both marker forms stay invisible to
 * readers: the visible document is written for people, the comments for the
 * matcher, and neither has to compromise for the other.
 *
 * Nothing is linked automatically. These are proposals for an admin to accept.
 */

export type SuggestionReason = 'explicit' | 'keyword' | 'heading';

export interface EquipmentItem {
  id: string;
  name: string;
  category: string;
}

export interface Suggestion {
  item: EquipmentItem;
  reason: SuggestionReason;
  /** The alias, marker or heading the match came from, for display. */
  matchedOn: string;
}

const EXPLICIT_MARKER = /<!--\s*equipment:\s*([\s\S]*?)\s*-->/gi;
const KEYWORDS_BLOCK = /<!--\s*lab-system:keywords\s*([\s\S]*?)-->/gi;

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
    for (const part of match[1].split(/[;,\n]/)) {
      const name = part.trim();
      if (name) names.push(name);
    }
  }
  return names;
}

/**
 * Aliases from every lab-system:keywords block, flattened.
 * Line breaks and "|" both separate aliases; the line grouping is purely for
 * human readability and carries no meaning to the matcher.
 */
export function extractKeywords(markdown: string): string[] {
  const aliases: string[] = [];
  for (const match of markdown.matchAll(KEYWORDS_BLOCK)) {
    for (const part of match[1].split(/[|\n]/)) {
      const alias = part.trim();
      if (alias) aliases.push(alias);
    }
  }
  return aliases;
}

/**
 * Score an inventory item against one phrase — an alias or a heading.
 * Returns 0 when there is no meaningful overlap.
 */
function scoreAgainstPhrase(itemName: string, phrase: string): number {
  const itemTokens = tokens(itemName);
  const phraseTokens = tokens(phrase);
  if (itemTokens.length === 0 || phraseTokens.length === 0) return 0;

  const phraseSet = new Set(phraseTokens);
  const itemSet = new Set(itemTokens);

  const present = itemTokens.filter((t) => phraseSet.has(t));
  if (present.length === 0) return 0;

  // Two of the item's words appearing side by side in the phrase
  // ("plasma cleaner") is a much stronger signal than scattered single words.
  let contiguousBonus = 0;
  for (let i = 0; i < itemTokens.length - 1; i++) {
    for (let j = 0; j < phraseTokens.length - 1; j++) {
      if (itemTokens[i] === phraseTokens[j] && itemTokens[i + 1] === phraseTokens[j + 1]) {
        contiguousBonus = 0.4;
        break;
      }
    }
    if (contiguousBonus) break;
  }

  // Reward covering the phrase's own words too, so a one-word item name does
  // not match every phrase that happens to contain that word. This term is why
  // short aliases beat long headings: it divides by the phrase's word count.
  const phraseCoverage = phraseTokens.filter((t) => itemSet.has(t)).length / phraseTokens.length;
  const itemCoverage = present.length / itemTokens.length;

  return Math.min(1, itemCoverage * 0.5 + phraseCoverage * 0.4 + contiguousBonus);
}

const SCORE_THRESHOLD = 0.45;

const REASON_ORDER: Record<SuggestionReason, number> = {
  explicit: 0,
  keyword: 1,
  heading: 2,
};

export function suggestEquipment(
  indexText: string,
  equipment: EquipmentItem[]
): Suggestion[] {
  if (!indexText.trim() || equipment.length === 0) return [];

  const results = new Map<string, Suggestion>();

  // 1. Explicit markers win outright — an exact inventory name.
  const explicit = extractExplicitNames(indexText).map((n) => normalise(n));
  for (const item of equipment) {
    if (explicit.includes(normalise(item.name))) {
      results.set(item.id, { item, reason: 'explicit', matchedOn: item.name });
    }
  }

  // 2. Keyword aliases when the index provides them, headings otherwise.
  //    A keyword block is a deliberate statement of what the archive covers,
  //    so it replaces heading matching rather than adding to it.
  const keywords = extractKeywords(indexText);
  const phrases = keywords.length > 0 ? keywords : extractHeadings(indexText);
  const reason: SuggestionReason = keywords.length > 0 ? 'keyword' : 'heading';

  for (const item of equipment) {
    if (results.has(item.id)) continue;

    let best = { score: 0, phrase: '' };
    for (const phrase of phrases) {
      const score = scoreAgainstPhrase(item.name, phrase);
      if (score > best.score) best = { score, phrase };
    }

    if (best.score >= SCORE_THRESHOLD) {
      results.set(item.id, { item, reason, matchedOn: best.phrase });
    }
  }

  // Most confident first, then alphabetical.
  return [...results.values()].sort((a, b) => {
    const byReason = REASON_ORDER[a.reason] - REASON_ORDER[b.reason];
    return byReason !== 0 ? byReason : a.item.name.localeCompare(b.item.name);
  });
}
