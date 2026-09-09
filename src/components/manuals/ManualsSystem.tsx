'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  uploadDocument,
  deleteDocument,
  getFileUrl,
  getDownloadUrl,
  detectFileKind,
  formatFileSize,
  MAX_UPLOAD_BYTES,
} from '@/lib/storage';
import { extractIndexFromZip, INDEX_CANDIDATE_LABEL } from '@/lib/manualIndex';
import { suggestEquipment, type Suggestion } from '@/lib/equipmentSuggest';
import MarkdownView from '@/components/MarkdownView';
import {
  FileText, Plus, Search, Trash2, Edit3, X, Upload, Eye, Download,
  FileArchive, CheckCircle, AlertCircle, Loader, Sparkles, Check,
} from 'lucide-react';
import type { ManualWithEquipment, ManualFormData } from '@/types/manual';

interface ManualsSystemProps {
  isAdmin: boolean;
}

const emptyForm: ManualFormData = {
  title: '',
  equipment_ids: [],
  description: '',
  version: '',
};

type EquipmentOption = { id: string; name: string; category: string };

/**
 * Defined at module scope, not inside ManualsSystem. Declaring it inside the
 * parent recreated the component type on every render, remounting the input and
 * dropping focus after each keystroke — painful when linking many items.
 */
function EquipmentPicker({
  pickerRef,
  selected,
  matches,
  selectedIds,
  search,
  onSearchChange,
  showDropdown,
  onFocus,
  onToggle,
  onRemove,
}: {
  pickerRef: React.RefObject<HTMLDivElement | null>;
  selected: EquipmentOption[];
  matches: EquipmentOption[];
  selectedIds: string[];
  search: string;
  onSearchChange: (value: string) => void;
  showDropdown: boolean;
  onFocus: () => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="relative" ref={pickerRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Linked Equipment
        {selected.length > 0 && (
          <span className="ml-1 text-xs font-normal text-gray-400">({selected.length} linked)</span>
        )}
      </label>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2 max-h-24 overflow-y-auto">
          {selected.map((eq) => (
            <span
              key={eq.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
            >
              {eq.name}
              <button type="button" onClick={() => onRemove(eq.id)} className="text-blue-600 hover:text-blue-800">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        onFocus={onFocus}
        placeholder="Search equipment to add..."
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
      />
      {showDropdown && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {matches.map((eq) => {
            const isSelected = selectedIds.includes(eq.id);
            return (
              <button
                type="button"
                key={eq.id}
                onClick={() => onToggle(eq.id)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  isSelected ? 'bg-blue-50 text-blue-800 font-medium' : 'text-gray-900 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center justify-between">
                  <span>{eq.name} ({eq.category})</span>
                  {isSelected && <span className="text-blue-600 text-xs">Selected</span>}
                </span>
              </button>
            );
          })}
          {matches.length === 0 && <div className="px-3 py-2 text-sm text-gray-400">No matches</div>}
        </div>
      )}
    </div>
  );
}

/** Entries whose stored file is an archive are downloaded rather than previewed. */
function isArchive(manual: { pdf_filename: string }): boolean {
  return detectFileKind(manual.pdf_filename) === 'zip';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

export default function ManualsSystem({ isAdmin }: ManualsSystemProps) {
  const [manuals, setManuals] = useState<ManualWithEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingManual, setEditingManual] = useState<ManualWithEquipment | null>(null);
  const [formData, setFormData] = useState<ManualFormData>(emptyForm);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [equipment, setEquipment] = useState<EquipmentOption[]>([]);
  const [equipmentSearch, setEquipmentSearch] = useState('');
  const [showEquipmentDropdown, setShowEquipmentDropdown] = useState(false);
  const [opening, setOpening] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const equipmentPickerRef = useRef<HTMLDivElement>(null);

  // Feedback about pulling the index out of a chosen archive
  const [indexStatus, setIndexStatus] = useState<
    { state: 'idle' } | { state: 'reading' } | { state: 'found'; filename: string; size: number } | { state: 'missing' }
  >({ state: 'idle' });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (equipmentPickerRef.current && !equipmentPickerRef.current.contains(e.target as Node)) {
        setShowEquipmentDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const initialLoadDone = useRef(false);

  const fetchManuals = useCallback(async () => {
    try {
      if (!initialLoadDone.current) setLoading(true);
      const { data, error } = await supabase
        .from('manuals')
        .select(`
          *,
          manual_equipment (
            equipment:equipment_id (id, name, category)
          )
        `)
        .order('title');

      if (error) throw error;
      setManuals((data as ManualWithEquipment[]) || []);
      initialLoadDone.current = true;
    } catch (error) {
      console.error('Error fetching manuals:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEquipment = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('id, name, category')
        .order('name');
      if (error) throw error;
      setEquipment(data || []);
    } catch (error) {
      console.error('Error fetching equipment:', error);
    }
  }, []);

  useEffect(() => {
    fetchManuals();
    fetchEquipment();
  }, [fetchManuals, fetchEquipment]);

  /**
   * When an archive is chosen, read its index document and use it as the
   * description. The admin never has to paste the index in by hand.
   */
  const handleFileChange = async (file: File | null) => {
    setPdfFile(file);
    setIndexStatus({ state: 'idle' });
    if (!file || detectFileKind(file.name) !== 'zip') return;

    try {
      setIndexStatus({ state: 'reading' });
      const found = await extractIndexFromZip(file);
      if (found) {
        setFormData((prev) => ({ ...prev, description: found.text }));
        setSuggestions(null);
        setIndexStatus({ state: 'found', filename: found.filename, size: found.text.length });
      } else {
        setIndexStatus({ state: 'missing' });
      }
    } catch (error) {
      console.error('Error reading archive:', error);
      setIndexStatus({ state: 'missing' });
    }
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setPdfFile(null);
    setEquipmentSearch('');
    setIndexStatus({ state: 'idle' });
    setSuggestions(null);
  };

  const handleAddManual = async () => {
    if (!formData.title.trim() || !pdfFile) {
      alert('Title and a PDF or ZIP file are required.');
      return;
    }

    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const uploadResult = await uploadDocument(pdfFile, 'equipment-manuals', user.id, ['pdf', 'zip']);

      const { data: inserted, error } = await supabase
        .from('manuals')
        .insert([{
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          version: formData.version.trim() || null,
          pdf_path: uploadResult.path,
          pdf_filename: uploadResult.filename,
          pdf_size_bytes: uploadResult.size,
          created_by: user.id,
        }])
        .select('id')
        .single();

      if (error) throw error;

      if (formData.equipment_ids.length > 0 && inserted) {
        const junctionRows = formData.equipment_ids.map((eqId) => ({
          manual_id: inserted.id,
          equipment_id: eqId,
        }));
        const { error: junctionError } = await supabase.from('manual_equipment').insert(junctionRows);
        if (junctionError) throw junctionError;
      }

      resetForm();
      setShowAddForm(false);
      showSuccess('Manual added successfully');
      fetchManuals();
    } catch (error) {
      console.error('Error adding manual:', error);
      alert(error instanceof Error ? error.message : 'Failed to add manual');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateManual = async () => {
    if (!editingManual || !formData.title.trim()) {
      alert('Title is required.');
      return;
    }

    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const updateData: Record<string, unknown> = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        version: formData.version.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (pdfFile) {
        if (editingManual.pdf_path) {
          await deleteDocument(editingManual.pdf_path, 'equipment-manuals');
        }
        const uploadResult = await uploadDocument(pdfFile, 'equipment-manuals', user.id, ['pdf', 'zip']);
        updateData.pdf_path = uploadResult.path;
        updateData.pdf_filename = uploadResult.filename;
        updateData.pdf_size_bytes = uploadResult.size;
      }

      const { error } = await supabase.from('manuals').update(updateData).eq('id', editingManual.id);
      if (error) throw error;

      const { error: deleteError } = await supabase
        .from('manual_equipment')
        .delete()
        .eq('manual_id', editingManual.id);
      if (deleteError) throw deleteError;

      if (formData.equipment_ids.length > 0) {
        const junctionRows = formData.equipment_ids.map((eqId) => ({
          manual_id: editingManual.id,
          equipment_id: eqId,
        }));
        const { error: junctionError } = await supabase.from('manual_equipment').insert(junctionRows);
        if (junctionError) throw junctionError;
      }

      setEditingManual(null);
      resetForm();
      showSuccess('Manual updated successfully');
      fetchManuals();
    } catch (error) {
      console.error('Error updating manual:', error);
      alert(error instanceof Error ? error.message : 'Failed to update manual');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteManual = async (manual: ManualWithEquipment) => {
    if (!confirm(`Delete "${manual.title}"? This will also delete the stored file.`)) return;

    try {
      if (manual.pdf_path) {
        await deleteDocument(manual.pdf_path, 'equipment-manuals');
      }
      const { error } = await supabase.from('manuals').delete().eq('id', manual.id);
      if (error) throw error;

      showSuccess('Manual deleted successfully');
      fetchManuals();
    } catch (error) {
      console.error('Error deleting manual:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete manual');
    }
  };

  const handleOpenFile = async (manual: ManualWithEquipment) => {
    if (!manual.pdf_path) {
      alert('This entry has no file attached.');
      return;
    }
    try {
      setOpening(true);
      // Archives cannot be previewed in the browser, so they are downloaded instead.
      const url = isArchive(manual)
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

  const openEditModal = (manual: ManualWithEquipment) => {
    setEditingManual(manual);
    setFormData({
      title: manual.title,
      equipment_ids: manual.manual_equipment?.map((me) => me.equipment.id) || [],
      description: manual.description || '',
      version: manual.version || '',
    });
    setEquipmentSearch('');
    setShowEquipmentDropdown(false);
    setPdfFile(null);
    setIndexStatus({ state: 'idle' });
    setSuggestions(null);
    setShowAddForm(false);
  };

  // The master archive is the most recently updated ZIP entry. Anything else
  // (individual PDFs) is listed separately below it.
  const archives = manuals
    .filter(isArchive)
    .sort((a, b) =>
      new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
    );
  const masterArchive = archives[0] ?? null;
  const otherManuals = manuals.filter((m) => m.id !== masterArchive?.id);

  const filteredOthers = otherManuals.filter((manual) => {
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    return (
      manual.title.toLowerCase().includes(term) ||
      (manual.description && manual.description.toLowerCase().includes(term)) ||
      (manual.manual_equipment?.some((me) => me.equipment.name.toLowerCase().includes(term))) ||
      (manual.version && manual.version.toLowerCase().includes(term))
    );
  });

  const selectedEquipmentItems = formData.equipment_ids
    .map((id) => equipment.find((eq) => eq.id === id))
    .filter(Boolean) as EquipmentOption[];

  const filteredEquipment = equipment.filter((eq) =>
    `${eq.name} (${eq.category})`.toLowerCase().includes(equipmentSearch.toLowerCase())
  );

  const toggleEquipment = (eqId: string) => {
    setFormData((prev) => ({
      ...prev,
      equipment_ids: prev.equipment_ids.includes(eqId)
        ? prev.equipment_ids.filter((id) => id !== eqId)
        : [...prev.equipment_ids, eqId],
    }));
  };

  const removeEquipment = (eqId: string) => {
    setFormData((prev) => ({
      ...prev,
      equipment_ids: prev.equipment_ids.filter((id) => id !== eqId),
    }));
  };

  const equipmentPicker = (
    <EquipmentPicker
      pickerRef={equipmentPickerRef}
      selected={selectedEquipmentItems}
      matches={filteredEquipment}
      selectedIds={formData.equipment_ids}
      search={equipmentSearch}
      onSearchChange={(value) => {
        setEquipmentSearch(value);
        setShowEquipmentDropdown(true);
      }}
      showDropdown={showEquipmentDropdown}
      onFocus={() => setShowEquipmentDropdown(true)}
      onToggle={toggleEquipment}
      onRemove={removeEquipment}
    />
  );

  const fileField = (label: string, hint?: string) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="file"
        accept=".pdf,.zip,application/pdf,application/zip,application/x-zip-compressed"
        onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
      />
      <p className="text-xs text-gray-400 mt-1">
        {hint ?? `PDF or ZIP archive, up to ${formatFileSize(MAX_UPLOAD_BYTES)}`}
      </p>
      {indexStatus.state === 'reading' && (
        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
          <Loader className="w-3 h-3 animate-spin" /> Reading index from archive...
        </p>
      )}
      {indexStatus.state === 'found' && (
        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Index read from <span className="font-medium">{indexStatus.filename}</span> ({formatFileSize(indexStatus.size)})
        </p>
      )}
      {indexStatus.state === 'missing' && (
        <p className="text-xs text-amber-600 mt-1 flex items-start gap-1">
          <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>No index found in the archive. Add one named {INDEX_CANDIDATE_LABEL}, or write it below.</span>
        </p>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="text-lg text-gray-600">Loading manuals...</div>
      </div>
    );
  }

  const isFormOpen = showAddForm || !!editingManual;

  return (
    <div>
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg">
          {successMessage}
        </div>
      )}

      {/* ── Master archive ─────────────────────────────────────────────────── */}
      {masterArchive ? (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FileArchive className="w-6 h-6 text-purple-600 flex-shrink-0" />
                <h2 className="text-2xl font-bold text-gray-900">{masterArchive.title}</h2>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {masterArchive.pdf_filename} · {formatFileSize(masterArchive.pdf_size_bytes)}
                {masterArchive.version && <> · {masterArchive.version}</>}
                {' · '}updated {formatDate(masterArchive.updated_at || masterArchive.created_at)}
              </p>
              {masterArchive.manual_equipment && masterArchive.manual_equipment.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {masterArchive.manual_equipment.map((me) => (
                    <span
                      key={me.equipment.id}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {me.equipment.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => handleOpenFile(masterArchive)}
                disabled={opening}
                className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                {opening ? 'Preparing...' : 'Download archive'}
              </button>
              {isAdmin && (
                <>
                  <button
                    onClick={() => openEditModal(masterArchive)}
                    className="p-2.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-amber-200"
                    title="Replace archive or edit details"
                  >
                    <Upload className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteManual(masterArchive)}
                    className="p-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-400 mt-4 pt-4 border-t border-gray-100">
            Permanent link:{' '}
            <Link href={`/manuals/${masterArchive.id}`} className="text-blue-600 hover:underline">
              /manuals/{masterArchive.id}
            </Link>
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6 text-center">
          <FileArchive className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium text-gray-700">No manuals archive uploaded yet</p>
          <p className="text-sm text-gray-500 mt-1">
            {isAdmin
              ? 'Upload the master ZIP archive. Its index will be read automatically and shown below.'
              : 'An administrator has not uploaded the manuals archive yet.'}
          </p>
          {isAdmin && !isFormOpen && (
            <button
              onClick={() => { setShowAddForm(true); resetForm(); }}
              className="inline-flex items-center gap-2 mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Upload archive
            </button>
          )}
        </div>
      )}

      {/* ── Add / replace form ─────────────────────────────────────────────── */}
      {isFormOpen && isAdmin && (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingManual ? `Edit "${editingManual.title}"` : 'Add manual or archive'}
            </h3>
            <button
              onClick={() => { setShowAddForm(false); setEditingManual(null); resetForm(); }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Lab manuals"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
              />
            </div>

            <div>
              {equipmentPicker}
              {formData.description.trim() && (
                <button
                  type="button"
                  onClick={() => setSuggestions(suggestEquipment(formData.description, equipment))}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Suggest from index
                </button>
              )}

              {suggestions !== null && (
                <div className="mt-2 border border-blue-100 bg-blue-50 rounded-lg p-3">
                  {suggestions.length === 0 ? (
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>Nothing in the inventory matched the index.</p>
                      <p>
                        Add a keyword block to the index — it is stripped before display, so
                        readers never see it. One rig per line, aliases separated by <code className="px-1 bg-white rounded">|</code>:
                      </p>
                      <pre className="bg-white rounded p-2 overflow-x-auto text-[11px] leading-relaxed">{`<!-- lab-system:keywords
Plasma cleaner | Diener Zepto | vacuum pump
Air compressor | PTA513 | Jun Air 64
-->`}</pre>
                      <p>
                        For an exact inventory name, use
                        <code className="mx-1 px-1 bg-white rounded">{'<!-- equipment: Item name -->'}</code>
                        instead.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-gray-700">
                          {suggestions.length} suggested from the index
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              equipment_ids: [
                                ...new Set([...prev.equipment_ids, ...suggestions.map((sg) => sg.item.id)]),
                              ],
                            }))
                          }
                          className="text-xs font-medium text-blue-600 hover:text-blue-800"
                        >
                          Add all
                        </button>
                      </div>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {suggestions.map((sg) => {
                          const already = formData.equipment_ids.includes(sg.item.id);
                          return (
                            <button
                              type="button"
                              key={sg.item.id}
                              onClick={() => !already && toggleEquipment(sg.item.id)}
                              disabled={already}
                              className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors ${
                                already
                                  ? 'bg-white/60 text-gray-400 cursor-default'
                                  : 'bg-white hover:bg-blue-100 text-gray-800'
                              }`}
                            >
                              <span className="flex items-center justify-between gap-2">
                                <span className="min-w-0">
                                  <span className="font-medium">{sg.item.name}</span>
                                  <span className="text-gray-400"> — matched &ldquo;{sg.matchedOn}&rdquo;</span>
                                </span>
                                {already ? (
                                  <Check className="w-3.5 h-3.5 flex-shrink-0 text-green-600" />
                                ) : (
                                  <span className="flex-shrink-0 text-blue-600 font-medium">Add</span>
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
              <input
                type="text"
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                placeholder="e.g. v2.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
              />
            </div>

            {editingManual
              ? fileField(
                  'Replace file (optional)',
                  `Current: ${editingManual.pdf_filename} (${formatFileSize(editingManual.pdf_size_bytes)})`
                )
              : fileField('File *')}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Index
              <span className="ml-1 text-xs font-normal text-gray-400">
                filled in automatically from the archive — edit only if you need to
              </span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Markdown. Read from the archive's index file when you choose a ZIP."
              rows={12}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 font-mono"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setShowAddForm(false); setEditingManual(null); resetForm(); }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={editingManual ? handleUpdateManual : handleAddManual}
              disabled={uploading}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
            >
              <Upload className="w-4 h-4" />
              {uploading ? 'Saving...' : editingManual ? 'Save changes' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* ── The index ──────────────────────────────────────────────────────── */}
      {masterArchive && (
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 mb-6">
          <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
            What is in the archive
          </h2>
          {masterArchive.description ? (
            <MarkdownView>{masterArchive.description}</MarkdownView>
          ) : (
            <p className="text-sm text-gray-400">
              This archive has no index. Add a file named {INDEX_CANDIDATE_LABEL} to it and re-upload,
              or write one in the edit form.
            </p>
          )}
        </div>
      )}

      {/* ── Other manuals ──────────────────────────────────────────────────── */}
      {otherManuals.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Other manuals</h2>
            <span className="text-sm text-gray-500">({filteredOthers.length})</span>
          </div>

          <div className="relative mb-4">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by title, description, or equipment..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-3 md:px-6 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="text-left px-3 md:px-6 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Equipment</th>
                  <th className="text-left px-3 md:px-6 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">File</th>
                  <th className="text-left px-3 md:px-6 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredOthers.map((manual) => (
                  <tr key={manual.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 md:px-6 py-3 align-top">
                      <Link href={`/manuals/${manual.id}`} className="font-medium text-gray-900 hover:text-blue-700 hover:underline">
                        {manual.title}
                      </Link>
                      {manual.description && (
                        <div className="text-sm text-gray-500 mt-1 line-clamp-2">{manual.description}</div>
                      )}
                    </td>
                    <td className="px-3 md:px-6 py-3 text-sm text-gray-600 align-top">
                      {manual.manual_equipment && manual.manual_equipment.length > 0 ? (
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
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 md:px-6 py-3 text-sm text-gray-600 align-top">
                      <div>{manual.pdf_filename}</div>
                      <div className="text-xs text-gray-400">{formatFileSize(manual.pdf_size_bytes)}</div>
                    </td>
                    <td className="px-3 md:px-6 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenFile(manual)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title={isArchive(manual) ? 'Download archive' : 'View PDF'}
                        >
                          {isArchive(manual) ? <Download className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => openEditModal(manual)}
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteManual(manual)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Add another manual ─────────────────────────────────────────────── */}
      {isAdmin && masterArchive && !isFormOpen && (
        <button
          onClick={() => { setShowAddForm(true); resetForm(); }}
          className="flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          Add another manual
        </button>
      )}
    </div>
  );
}
