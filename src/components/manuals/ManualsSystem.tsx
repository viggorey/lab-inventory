'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { uploadPDF, deletePDF, getPDFUrl, formatFileSize } from '@/lib/storage';
import { FileText, Plus, Search, Trash2, Edit3, X, Upload, Eye, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { ManualWithEquipment, ManualFormData } from '@/types/manual';

interface ManualsSystemProps {
  isAdmin: boolean;
}

const emptyForm: ManualFormData = {
  title: '',
  equipment_id: null,
  description: '',
  version: '',
};

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
  const [equipment, setEquipment] = useState<{ id: string; name: string; category: string }[]>([]);
  const [equipmentSearch, setEquipmentSearch] = useState('');
  const [showEquipmentDropdown, setShowEquipmentDropdown] = useState(false);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const initialLoadDone = React.useRef(false);

  const fetchManuals = useCallback(async () => {
    try {
      // Only show the full loading spinner on the very first fetch.
      // Subsequent refreshes update data silently so form state is kept.
      if (!initialLoadDone.current) {
        setLoading(true);
      }
      const { data, error } = await supabase
        .from('manuals')
        .select(`
          *,
          equipment:equipment_id (id, name, category)
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

  const handleAddManual = async () => {
    if (!formData.title.trim() || !pdfFile) {
      alert('Title and PDF file are required.');
      return;
    }

    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const uploadResult = await uploadPDF(pdfFile, 'equipment-manuals', user.id);

      const { error } = await supabase
        .from('manuals')
        .insert([{
          title: formData.title.trim(),
          equipment_id: formData.equipment_id || null,
          description: formData.description.trim() || null,
          version: formData.version.trim() || null,
          pdf_path: uploadResult.path,
          pdf_filename: uploadResult.filename,
          pdf_size_bytes: uploadResult.size,
          created_by: user.id,
        }]);

      if (error) throw error;

      setFormData(emptyForm);
      setPdfFile(null);
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
        equipment_id: formData.equipment_id || null,
        description: formData.description.trim() || null,
        version: formData.version.trim() || null,
        updated_at: new Date().toISOString(),
      };

      // If a new PDF was uploaded, replace the old one
      if (pdfFile) {
        // Delete old PDF
        await deletePDF(editingManual.pdf_path, 'equipment-manuals');
        // Upload new PDF
        const uploadResult = await uploadPDF(pdfFile, 'equipment-manuals', user.id);
        updateData.pdf_path = uploadResult.path;
        updateData.pdf_filename = uploadResult.filename;
        updateData.pdf_size_bytes = uploadResult.size;
      }

      const { error } = await supabase
        .from('manuals')
        .update(updateData)
        .eq('id', editingManual.id);

      if (error) throw error;

      setEditingManual(null);
      setFormData(emptyForm);
      setPdfFile(null);
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
    if (!confirm(`Delete "${manual.title}"? This will also delete the PDF file.`)) return;

    try {
      // Delete PDF from storage
      await deletePDF(manual.pdf_path, 'equipment-manuals');

      // Delete record from database
      const { error } = await supabase
        .from('manuals')
        .delete()
        .eq('id', manual.id);

      if (error) throw error;

      showSuccess('Manual deleted successfully');
      fetchManuals();
    } catch (error) {
      console.error('Error deleting manual:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete manual');
    }
  };

  const handleViewPDF = async (manual: ManualWithEquipment) => {
    try {
      const url = await getPDFUrl(manual.pdf_path, 'equipment-manuals');
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error getting PDF URL:', error);
      alert('Failed to open PDF');
    }
  };

  const filteredEquipment = equipment.filter((eq) =>
    `${eq.name} (${eq.category})`.toLowerCase().includes(equipmentSearch.toLowerCase())
  );

  const selectEquipment = (eqId: string | null, eqLabel: string) => {
    setFormData({ ...formData, equipment_id: eqId });
    setEquipmentSearch(eqLabel);
    setShowEquipmentDropdown(false);
  };

  const openEditModal = (manual: ManualWithEquipment) => {
    setEditingManual(manual);
    setFormData({
      title: manual.title,
      equipment_id: manual.equipment_id,
      description: manual.description || '',
      version: manual.version || '',
    });
    setEquipmentSearch(manual.equipment ? `${manual.equipment.name} (${manual.equipment.category})` : '');
    setShowEquipmentDropdown(false);
    setPdfFile(null);
  };

  const handleExport = () => {
    const exportData = manuals.map(m => ({
      title: m.title,
      equipment: m.equipment ? `${m.equipment.name} (${m.equipment.category})` : '',
      version: m.version || '',
      description: m.description || '',
      pdf_filename: m.pdf_filename,
      pdf_size: formatFileSize(m.pdf_size_bytes),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Manuals');
    XLSX.writeFile(wb, 'manuals.xlsx');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.[0]) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      if (!event.target?.result) return;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const wb = XLSX.read(event.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false }) as Array<{
          title?: string;
          description?: string;
          version?: string;
        }>;

        const rows = data.filter(row => row.title && row.title.toString().trim() !== '').map(row => ({
          title: String(row.title).trim(),
          description: row.description ? String(row.description).trim() : null,
          version: row.version ? String(row.version).trim() : null,
          pdf_path: '',
          pdf_filename: 'imported',
          pdf_size_bytes: 0,
          created_by: user.id,
        }));

        if (rows.length === 0) throw new Error('No valid rows found');

        const { error } = await supabase.from('manuals').insert(rows);
        if (error) throw error;

        showSuccess(`Imported ${rows.length} manual(s) successfully`);
        fetchManuals();
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Import failed');
      }
    };
    reader.readAsBinaryString(files[0]);
    e.target.value = '';
  };

  const filteredManuals = manuals.filter((manual) => {
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    return (
      manual.title.toLowerCase().includes(term) ||
      (manual.description && manual.description.toLowerCase().includes(term)) ||
      (manual.equipment?.name && manual.equipment.name.toLowerCase().includes(term)) ||
      (manual.version && manual.version.toLowerCase().includes(term))
    );
  });

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="text-lg text-gray-600">Loading manuals...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Success Message */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg">
          {successMessage}
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">Equipment Manuals</h2>
            <span className="text-sm text-gray-500">({filteredManuals.length} manuals)</span>
          </div>
          {isAdmin && (
            <button
              onClick={() => {
                setShowAddForm(!showAddForm);
                setFormData(emptyForm);
                setPdfFile(null);
                setEquipmentSearch('');
                setShowEquipmentDropdown(false);
              }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Manual
            </button>
          )}
        </div>

        {/* Search */}
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

        {/* Export / Import */}
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            Export to Excel
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => document.getElementById('manuals-import')?.click()}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Upload className="w-4 h-4" />
                Import from Excel
              </button>
              <input
                id="manuals-import"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImport}
                className="hidden"
              />
            </>
          )}
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && isAdmin && (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Manual</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Manual title"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
              />
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Linked Equipment
              </label>
              <input
                type="text"
                value={equipmentSearch}
                onChange={(e) => {
                  setEquipmentSearch(e.target.value);
                  setShowEquipmentDropdown(true);
                  if (!e.target.value) setFormData({ ...formData, equipment_id: null });
                }}
                onFocus={() => setShowEquipmentDropdown(true)}
                placeholder="Search equipment..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
              />
              {showEquipmentDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => selectEquipment(null, '')}
                    className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-100"
                  >
                    None
                  </button>
                  {filteredEquipment.map((eq) => (
                    <button
                      type="button"
                      key={eq.id}
                      onClick={() => selectEquipment(eq.id, `${eq.name} (${eq.category})`)}
                      className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-blue-50"
                    >
                      {eq.name} ({eq.category})
                    </button>
                  ))}
                  {filteredEquipment.length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-400">No matches</div>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PDF File <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the manual..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddManual}
              disabled={uploading}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Upload Manual'}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setFormData(emptyForm);
                setPdfFile(null);
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Manuals List */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {filteredManuals.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchTerm ? 'No manuals match your search.' : 'No manuals uploaded yet.'}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Equipment</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Version</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">File</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredManuals.map((manual) => (
                <tr key={manual.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{manual.title}</div>
                    {manual.description && (
                      <div className="text-sm text-gray-500 mt-1 line-clamp-2">{manual.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {manual.equipment ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {manual.equipment.name}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {manual.version || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div>{manual.pdf_filename}</div>
                    <div className="text-xs text-gray-400">{formatFileSize(manual.pdf_size_bytes)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewPDF(manual)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View PDF"
                      >
                        <Eye className="w-4 h-4" />
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
        )}
      </div>

      {/* Edit Modal */}
      {editingManual && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl m-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Edit Manual</h3>
                <button
                  onClick={() => {
                    setEditingManual(null);
                    setFormData(emptyForm);
                    setPdfFile(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
                  />
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Linked Equipment
                  </label>
                  <input
                    type="text"
                    value={equipmentSearch}
                    onChange={(e) => {
                      setEquipmentSearch(e.target.value);
                      setShowEquipmentDropdown(true);
                      if (!e.target.value) setFormData({ ...formData, equipment_id: null });
                    }}
                    onFocus={() => setShowEquipmentDropdown(true)}
                    placeholder="Search equipment..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
                  />
                  {showEquipmentDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => selectEquipment(null, '')}
                        className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-100"
                      >
                        None
                      </button>
                      {filteredEquipment.map((eq) => (
                        <button
                          type="button"
                          key={eq.id}
                          onClick={() => selectEquipment(eq.id, `${eq.name} (${eq.category})`)}
                          className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-blue-50"
                        >
                          {eq.name} ({eq.category})
                        </button>
                      ))}
                      {filteredEquipment.length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-400">No matches</div>
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Replace PDF (optional)
                  </label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Current: {editingManual.pdf_filename} ({formatFileSize(editingManual.pdf_size_bytes)})
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => {
                    setEditingManual(null);
                    setFormData(emptyForm);
                    setPdfFile(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateManual}
                  disabled={uploading}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {uploading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
