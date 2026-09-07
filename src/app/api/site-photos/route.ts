import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, requireAdmin } from '@/lib/apiAuth';

const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'avif', 'bmp', 'tif', 'tiff'];

/**
 * Some devices (notably iPhones sending HEIC) report an empty MIME type, so
 * fall back to the extension rather than rejecting a legitimate photo.
 */
function isImage(file: File): boolean {
  if (file.type) return file.type.startsWith('image/');
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTENSIONS.includes(ext);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const formData = await request.formData();
  const photo = formData.get('photo') as File | null;

  if (!photo) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!isImage(photo)) {
    return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 });
  }

  if (photo.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: 'Image is too large (max 10 MB)' }, { status: 400 });
  }

  const ext = photo.name.split('.').pop() ?? 'jpg';
  const path = `photos/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await photo.arrayBuffer());

  const { error } = await getAdminClient().storage
    .from('site-photos')
    .upload(path, buffer, { contentType: photo.type || 'application/octet-stream', upsert: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ path });
}
