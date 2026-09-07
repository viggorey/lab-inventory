'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download, Eye, FileArchive, FileText } from 'lucide-react';
import AuthGuard from '@/components/AuthGuard';
import { supabase } from '@/lib/supabase';
import {
  detectFileKind,
  formatFileSize,
  getDownloadUrl,
  getFileUrl,
} from '@/lib/storage';
import MarkdownView from '@/components/MarkdownView';
import type { ManualWithEquipment } from '@/types/manual';

/**
 * Stable permalink for a single manual: /manuals/{id}
 *
 * Signed storage URLs expire after an hour, so they cannot be pasted into the
 * handbook or an email. This URL contains no credentials, never expires, and
 * mints a fresh signed URL on each visit. Auth is enforced by AuthGuard, the
 * same way as every other page in the app.
 */
export default function ManualPermalinkPage() {
  return (
    <AuthGuard>
      {() => <ManualDetail />}
    </AuthGuard>
  );
}

function ManualDetail() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [manual, setManual] = useState<ManualWithEquipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);

  const fetchManual = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('manuals')
        .select(`
          *,
          manual_equipment (
            equipment:equipment_id (id, name, category)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setManual(data as ManualWithEquipment);
    } catch (error) {
      console.error('Error fetching manual:', error);
      setManual(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchManual();
  }, [fetchManual]);

  const isArchive = manual ? detectFileKind(manual.pdf_filename) === 'zip' : false;

  const handleOpen = async () => {
    if (!manual?.pdf_path) {
      alert('This entry has no file attached.');
      return;
    }
    try {
      setOpening(true);
      const url = isArchive
        ? await getDownloadUrl(manual.pdf_path, 'equipment-manuals', manual.pdf_filename)
        : await getFileUrl(manual.pdf_path, 'equipment-manuals');
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error getting file URL:', error);
      alert('Failed to open file');
    } finally {
      setOpening(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center text-gray-600">
        Loading manual...
      </div>
    );
  }

  if (!manual) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <p className="text-gray-700 font-medium">Manual not found</p>
        <p className="text-sm text-gray-500 mt-1">
          It may have been deleted, or the link may be wrong.
        </p>
        <Link
          href="/other"
          className="inline-flex items-center gap-2 mt-4 text-blue-600 hover:text-blue-800 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Resources
        </Link>
      </div>
    );
  }

  const updated = manual.updated_at || manual.created_at;

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
      <Link
        href="/other"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Resources
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            {isArchive
              ? <FileArchive className="w-6 h-6 text-purple-600 flex-shrink-0" />
              : <FileText className="w-6 h-6 text-blue-600 flex-shrink-0" />}
            {manual.title}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {manual.pdf_filename} · {formatFileSize(manual.pdf_size_bytes)}
            {manual.version && <> · {manual.version}</>}
            {updated && (
              <> · updated {new Date(updated).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric',
              })}</>
            )}
          </p>
        </div>

        <button
          onClick={handleOpen}
          disabled={opening}
          className="flex-shrink-0 flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isArchive ? <Download className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {opening
            ? 'Preparing...'
            : isArchive ? 'Download archive' : 'View PDF'}
        </button>
      </div>

      {manual.manual_equipment && manual.manual_equipment.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            Linked equipment ({manual.manual_equipment.length})
          </h2>
          <div className="flex flex-wrap gap-1">
            {manual.manual_equipment.map((me) => (
              <span
                key={me.equipment.id}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
              >
                {me.equipment.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {manual.description && (
        <div>
          <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            What is in the archive
          </h2>
          <div className="border-t border-gray-100 pt-4">
            <MarkdownView>{manual.description}</MarkdownView>
          </div>
        </div>
      )}
    </div>
  );
}
