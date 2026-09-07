import { supabase } from './supabase';

export type StorageBucket = 'equipment-manuals' | 'publications';

/** Kinds of document the app knows how to store. */
export type FileKind = 'pdf' | 'zip';

/**
 * Free plan has a fixed 50 MB upload limit that cannot be raised.
 * Checked client-side so oversized files fail with a readable message
 * instead of an opaque network error.
 */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const KIND_BY_EXTENSION: Record<string, FileKind> = {
  pdf: 'pdf',
  zip: 'zip',
};

/**
 * Canonical content type per kind. Browsers disagree on what to report for
 * .zip (application/zip, application/x-zip-compressed, application/octet-stream,
 * or an empty string), so we always send our own value rather than file.type.
 * This also keeps a bucket-level MIME allowlist workable.
 */
const CONTENT_TYPE: Record<FileKind, string> = {
  pdf: 'application/pdf',
  zip: 'application/zip',
};

const KIND_LABEL: Record<FileKind, string> = {
  pdf: 'PDF',
  zip: 'ZIP archive',
};

/**
 * Determine the kind of a file from its extension.
 * Extension is authoritative because file.type is unreliable for archives.
 */
export function detectFileKind(filename: string): FileKind | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return KIND_BY_EXTENSION[ext] ?? null;
}

interface UploadResult {
  path: string;
  filename: string;
  size: number;
}

/**
 * Upload a document to Supabase storage.
 *
 * `allowed` is per call site on purpose: manuals accept PDFs and ZIP archives,
 * publications remain PDF-only.
 */
export async function uploadDocument(
  file: File,
  bucket: StorageBucket,
  userId: string,
  allowed: FileKind[] = ['pdf']
): Promise<UploadResult> {
  const kind = detectFileKind(file.name);

  if (!kind || !allowed.includes(kind)) {
    const expected = allowed.map((k) => KIND_LABEL[k]).join(' or ');
    throw new Error(`Only ${expected} files are allowed here.`);
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `File is too large (${formatFileSize(file.size)}). The maximum upload size is ${formatFileSize(MAX_UPLOAD_BYTES)}.`
    );
  }

  // Generate unique filename
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `${userId}/${timestamp}_${sanitizedName}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: CONTENT_TYPE[kind],
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  return {
    path,
    filename: file.name,
    size: file.size,
  };
}

/**
 * Delete a file from Supabase storage
 */
export async function deleteDocument(
  path: string,
  bucket: StorageBucket
): Promise<void> {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Get a signed URL for downloading/viewing a stored file
 */
export async function getFileUrl(
  path: string,
  bucket: StorageBucket,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) {
    throw new Error(`Failed to get file URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Get a signed URL that prompts a download rather than opening in the browser.
 * Used for archives, which cannot be previewed.
 */
export async function getDownloadUrl(
  path: string,
  bucket: StorageBucket,
  filename: string,
  expiresIn: number = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn, { download: filename });

  if (error) {
    throw new Error(`Failed to get file URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}
