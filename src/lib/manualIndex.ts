import JSZip from 'jszip';

/**
 * Pulls the index document out of an uploaded manuals archive so it can be
 * shown on the page without anyone having to paste it in separately. Keeping
 * the index inside the archive means the two can never drift apart.
 *
 * Candidates are matched case-insensitively against the base filename, in this
 * order of preference. Files at the archive root win over nested ones.
 */
const INDEX_CANDIDATES = [
  'manual index.md',
  'manual-index.md',
  'manual_index.md',
  'index.md',
  'readme.md',
  'manifest.txt',
];

export interface ExtractedIndex {
  /** Name of the file the text came from, for display. */
  filename: string;
  text: string;
}

function baseName(path: string): string {
  return path.split('/').pop() ?? path;
}

function depth(path: string): number {
  return path.split('/').length - 1;
}

/**
 * Read the index out of a ZIP file in the browser.
 * Returns null when the archive contains no recognisable index document.
 */
export async function extractIndexFromZip(file: File): Promise<ExtractedIndex | null> {
  const zip = await JSZip.loadAsync(file);

  const entries = Object.values(zip.files).filter((entry) => !entry.dir);

  let best: { entry: JSZip.JSZipObject; rank: number; depth: number } | null = null;

  for (const entry of entries) {
    const rank = INDEX_CANDIDATES.indexOf(baseName(entry.name).toLowerCase());
    if (rank === -1) continue;

    const candidate = { entry, rank, depth: depth(entry.name) };
    if (
      !best ||
      candidate.rank < best.rank ||
      (candidate.rank === best.rank && candidate.depth < best.depth)
    ) {
      best = candidate;
    }
  }

  if (!best) return null;

  const text = await best.entry.async('string');
  return { filename: baseName(best.entry.name), text };
}

/** Names looked for, for use in help text. */
export const INDEX_CANDIDATE_LABEL = INDEX_CANDIDATES.slice(0, 4).join(', ');
