import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const photo = formData.get('photo') as File | null;

  if (!photo) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const ext = photo.name.split('.').pop() ?? 'jpg';
  const path = `photos/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await photo.arrayBuffer());

  const { error } = await getAdminClient().storage
    .from('site-photos')
    .upload(path, buffer, { contentType: photo.type, upsert: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ path });
}
