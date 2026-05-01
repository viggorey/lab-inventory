import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const storagePath = path.join('/');

  const { error } = await getAdminClient().storage
    .from('site-photos')
    .remove([storagePath]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
