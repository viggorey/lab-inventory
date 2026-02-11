import { supabase } from './supabase';

export type StorageBucket = 'equipment-manuals' | 'publications';

interface UploadResult {
  path: string;
  filename: string;
  size: number;
}

/**
 * Upload a PDF file to Supabase storage
 */
export async function uploadPDF(
  file: File,
  bucket: StorageBucket,
  userId: string
): Promise<UploadResult> {
  // Validate file type
  if (file.type !== 'application/pdf') {
    throw new Error('Only PDF files are allowed');
  }

  // Generate unique filename
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `${userId}/${timestamp}_${sanitizedName}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
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
 * Delete a PDF file from Supabase storage
 */
export async function deletePDF(
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
 * Get a signed URL for downloading/viewing a PDF
 */
export async function getPDFUrl(
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
 * Get a public URL for a PDF (if bucket is public)
 */
export function getPublicPDFUrl(
  path: string,
  bucket: StorageBucket
): string {
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return data.publicUrl;
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
