'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { uploadPDF, deletePDF, getPDFUrl, formatFileSize } from '@/lib/storage';
import { BookOpen, Plus, Search, Trash2, Edit3, X, Upload, ExternalLink, Eye, Tag, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { PublicationWithCategory, PublicationFormData, PublicationCategory } from '@/types/publication';

interface PublicationsSystemProps {
  isAdmin: boolean;
}

const emptyForm: PublicationFormData = {
  title: '',
  author: '',
  year: new Date().getFullYear(),
  category_id: null,
  doi: '',
  external_link: '',
  notes: '',
};

export default function PublicationsSystem({ isAdmin }: PublicationsSystemProps) {
  const [publications, setPublications] = useState<PublicationWithCategory[]>([]);
  const [categories, setCategories] = useState<PublicationCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPublication, setEditingPublication] = useState<PublicationWithCategory | null>(null);
  const [formData, setFormData] = useState<PublicationFormData>(emptyForm);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const initialLoadDone = React.useRef(false);

  const fetchPublications = useCallback(async () => {
    try {
      // Only show the full loading spinner on the very first fetch.
      // Subsequent refreshes update data silently so form state is kept.
      if (!initialLoadDone.current) {
        setLoading(true);
      }
      const { data, error } = await supabase
        .from('publications')
        .select(`
          *,
          category:category_id (id, name, description, created_at, created_by)
        `)
        .order('year', { ascending: false });

      if (error) throw error;
      setPublications((data as PublicationWithCategory[]) || []);
      initialLoadDone.current = true;
    } catch (error) {
      console.error('Error fetching publications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('publication_categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }, []);

  useEffect(() => {
    fetchPublications();
    fetchCategories();
  }, [fetchPublications, fetchCategories]);

  const handleAddPublication = async () => {
    if (!formData.title.trim() || !formData.author.trim()) {
      alert('Title and author are required.');
      return;
    }

    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let pdfData: { pdf_path: string; pdf_filename: string; pdf_size_bytes: number } | null = null;

      if (pdfFile) {
        const uploadResult = await uploadPDF(pdfFile, 'publications', user.id);
        pdfData = {
          pdf_path: uploadResult.path,
          pdf_filename: uploadResult.filename,
          pdf_size_bytes: uploadResult.size,
        };
      }

      const year = typeof formData.year === 'string' ? parseInt(formData.year, 10) : formData.year;
      if (isNaN(year)) {
        alert('Please enter a valid year.');
        return;
      }

      const { error } = await supabase
        .from('publications')
        .insert([{
          title: formData.title.trim(),
          author: formData.author.trim(),
          year,
          category_id: formData.category_id || null,
          doi: formData.doi.trim() || null,
          external_link: formData.external_link.trim() || null,
          notes: formData.notes.trim() || null,
          created_by: user.id,
          ...(pdfData || {}),
        }]);

      if (error) throw error;

      setFormData(emptyForm);
      setPdfFile(null);
      setShowAddForm(false);
      showSuccess('Publication added successfully');
      fetchPublications();
    } catch (error) {
      console.error('Error adding publication:', error);
      alert(error instanceof Error ? error.message : 'Failed to add publication');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdatePublication = async () => {
    if (!editingPublication || !formData.title.trim() || !formData.author.trim()) {
      alert('Title and author are required.');
      return;
    }

    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const year = typeof formData.year === 'string' ? parseInt(formData.year, 10) : formData.year;
      if (isNaN(year)) {
        alert('Please enter a valid year.');
        return;
      }

      const updateData: Record<string, unknown> = {
        title: formData.title.trim(),
        author: formData.author.trim(),
        year,
        category_id: formData.category_id || null,
        doi: formData.doi.trim() || null,
        external_link: formData.external_link.trim() || null,
        notes: formData.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      // If a new PDF was uploaded, replace the old one
      if (pdfFile) {
        if (editingPublication.pdf_path) {
          await deletePDF(editingPublication.pdf_path, 'publications');
        }
        const uploadResult = await uploadPDF(pdfFile, 'publications', user.id);
        updateData.pdf_path = uploadResult.path;
        updateData.pdf_filename = uploadResult.filename;
        updateData.pdf_size_bytes = uploadResult.size;
      }

      const { error } = await supabase
        .from('publications')
        .update(updateData)
        .eq('id', editingPublication.id);

      if (error) throw error;

      setEditingPublication(null);
      setFormData(emptyForm);
      setPdfFile(null);
      showSuccess('Publication updated successfully');
      fetchPublications();
    } catch (error) {
      console.error('Error updating publication:', error);
      alert(error instanceof Error ? error.message : 'Failed to update publication');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePublication = async (pub: PublicationWithCategory) => {
    if (!confirm(`Delete "${pub.title}"?`)) return;

    try {
      // Delete PDF from storage if it exists
      if (pub.pdf_path) {
        await deletePDF(pub.pdf_path, 'publications');
      }

      const { error } = await supabase
        .from('publications')
        .delete()
        .eq('id', pub.id);

      if (error) throw error;

      showSuccess('Publication deleted successfully');
      fetchPublications();
    } catch (error) {
      console.error('Error deleting publication:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete publication');
    }
  };

  const handleViewPDF = async (pub: PublicationWithCategory) => {
    if (!pub.pdf_path) return;
    try {
      const url = await getPDFUrl(pub.pdf_path, 'publications');
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error getting PDF URL:', error);
      alert('Failed to open PDF');
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      alert('Category name is required.');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('publication_categories')
        .insert([{
          name: newCategoryName.trim(),
          description: newCategoryDescription.trim() || null,
          created_by: user.id,
        }]);

      if (error) throw error;

      setNewCategoryName('');
      setNewCategoryDescription('');
      showSuccess('Category added');
      fetchCategories();
    } catch (error) {
      console.error('Error adding category:', error);
      alert(error instanceof Error ? error.message : 'Failed to add category');
    }
  };

  const handleDeleteCategory = async (cat: PublicationCategory) => {
    // Check if any publications use this category
    const usingCount = publications.filter(p => p.category_id === cat.id).length;
    if (usingCount > 0) {
      alert(`Cannot delete "${cat.name}" - it is used by ${usingCount} publication(s). Reassign them first.`);
      return;
    }
    if (!confirm(`Delete category "${cat.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('publication_categories')
        .delete()
        .eq('id', cat.id);

      if (error) throw error;

      showSuccess('Category deleted');
      fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete category');
    }
  };

  const openEditModal = (pub: PublicationWithCategory) => {
    setEditingPublication(pub);
    setFormData({
      title: pub.title,
      author: pub.author,
      year: pub.year,
      category_id: pub.category_id,
      doi: pub.doi || '',
      external_link: pub.external_link || '',
      notes: pub.notes || '',
    });
    setPdfFile(null);
  };

  const handleExport = () => {
    const exportData = publications.map(p => ({
      title: p.title,
      author: p.author,
      year: p.year,
      category: p.category?.name || '',
      doi: p.doi || '',
      external_link: p.external_link || '',
      notes: p.notes || '',
      pdf_filename: p.pdf_filename || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Publications');
    XLSX.writeFile(wb, 'publications.xlsx');
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
          author?: string;
          year?: string | number;
          category?: string;
          doi?: string;
          external_link?: string;
          notes?: string;
        }>;

        // Match category names to IDs
        const catMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));

        const rows = data.filter(row =>
          row.title && row.title.toString().trim() !== '' &&
          row.author && row.author.toString().trim() !== '' &&
          row.year
        ).map(row => ({
          title: String(row.title).trim(),
          author: String(row.author).trim(),
          year: Number(row.year),
          category_id: row.category ? catMap.get(String(row.category).toLowerCase().trim()) || null : null,
          doi: row.doi ? String(row.doi).trim() : null,
          external_link: row.external_link ? String(row.external_link).trim() : null,
          notes: row.notes ? String(row.notes).trim() : null,
          created_by: user.id,
        }));

        if (rows.length === 0) throw new Error('No valid rows found (need title, author, year)');

        const { error } = await supabase.from('publications').insert(rows);
        if (error) throw error;

        showSuccess(`Imported ${rows.length} publication(s) successfully`);
        fetchPublications();
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Import failed');
      }
    };
    reader.readAsBinaryString(files[0]);
    e.target.value = '';
  };

  const filteredPublications = publications.filter((pub) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term || (
      pub.title.toLowerCase().includes(term) ||
      pub.author.toLowerCase().includes(term) ||
      pub.year.toString().includes(term) ||
      (pub.doi && pub.doi.toLowerCase().includes(term)) ||
      (pub.notes && pub.notes.toLowerCase().includes(term))
    );
    const matchesCategory = !filterCategory || pub.category_id === filterCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="text-lg text-gray-600">Loading publications...</div>
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
            <BookOpen className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">Publications</h2>
            <span className="text-sm text-gray-500">({filteredPublications.length} publications)</span>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCategoryManager(!showCategoryManager)}
                className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Tag className="w-4 h-4" />
                Categories
              </button>
              <button
                onClick={() => {
                  setShowAddForm(!showAddForm);
                  setFormData(emptyForm);
                  setPdfFile(null);
                }}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Publication
              </button>
            </div>
          )}
        </div>

        {/* Search & Filter */}
        <div className="flex gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by title, author, year, or DOI..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
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
                onClick={() => document.getElementById('publications-import')?.click()}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Upload className="w-4 h-4" />
                Import from Excel
              </button>
              <input
                id="publications-import"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImport}
                className="hidden"
              />
            </>
          )}
        </div>
      </div>

      {/* Category Manager */}
      {showCategoryManager && isAdmin && (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Manage Categories</h3>
          <div className="flex gap-4 mb-4">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Category name"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
            />
            <input
              type="text"
              value={newCategoryDescription}
              onChange={(e) => setNewCategoryDescription(e.target.value)}
              placeholder="Description (optional)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
            />
            <button
              onClick={handleAddCategory}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          {categories.length === 0 ? (
            <p className="text-sm text-gray-500">No categories yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full text-sm">
                  <span className="font-medium text-gray-700">{cat.name}</span>
                  {cat.description && (
                    <span className="text-gray-400" title={cat.description}>
                      - {cat.description}
                    </span>
                  )}
                  <button
                    onClick={() => handleDeleteCategory(cat)}
                    className="text-red-400 hover:text-red-600 ml-1"
                    title="Delete category"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Form */}
      {showAddForm && isAdmin && (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Publication</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Publication title"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Author(s) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                placeholder="e.g. Smith J, Doe A"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Year <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                placeholder="2024"
                min="1900"
                max="2100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={formData.category_id || ''}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value || null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
              >
                <option value="">None</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">DOI</label>
              <input
                type="text"
                value={formData.doi}
                onChange={(e) => setFormData({ ...formData, doi: e.target.value })}
                placeholder="e.g. 10.1234/example"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">External Link</label>
              <input
                type="url"
                value={formData.external_link}
                onChange={(e) => setFormData({ ...formData, external_link: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PDF File (optional)</label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddPublication}
              disabled={uploading}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {uploading ? 'Saving...' : 'Add Publication'}
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

      {/* Publications List */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {filteredPublications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchTerm || filterCategory ? 'No publications match your search.' : 'No publications added yet.'}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Title / Author</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Links</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPublications.map((pub) => (
                <tr key={pub.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{pub.title}</div>
                    <div className="text-sm text-gray-500 mt-1">{pub.author}</div>
                    {pub.notes && (
                      <div className="text-xs text-gray-400 mt-1 line-clamp-1">{pub.notes}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{pub.year}</td>
                  <td className="px-6 py-4 text-sm">
                    {pub.category ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {pub.category.name}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {pub.doi && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(pub.doi!);
                            showSuccess('DOI copied to clipboard');
                          }}
                          className="text-xs text-blue-600 cursor-pointer relative group hover:bg-blue-50 px-1.5 py-0.5 rounded transition-colors"
                          title="Click to copy DOI"
                        >
                          DOI
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                            {pub.doi}
                          </span>
                        </button>
                      )}
                      {pub.external_link && (
                        <a
                          href={pub.external_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="External link"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {pub.pdf_path && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleViewPDF(pub)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View PDF"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <span className="text-xs text-gray-400">
                            {formatFileSize(pub.pdf_size_bytes || 0)}
                          </span>
                        </div>
                      )}
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => openEditModal(pub)}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePublication(pub)}
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
      {editingPublication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl m-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Edit Publication</h3>
                <button
                  onClick={() => {
                    setEditingPublication(null);
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Author(s) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Year <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                      min="1900"
                      max="2100"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={formData.category_id || ''}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
                    >
                      <option value="">None</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">DOI</label>
                  <input
                    type="text"
                    value={formData.doi}
                    onChange={(e) => setFormData({ ...formData, doi: e.target.value })}
                    placeholder="e.g. 10.1234/example"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">External Link</label>
                  <input
                    type="url"
                    value={formData.external_link}
                    onChange={(e) => setFormData({ ...formData, external_link: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {editingPublication.pdf_path ? 'Replace PDF (optional)' : 'Upload PDF (optional)'}
                  </label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
                  />
                  {editingPublication.pdf_filename && (
                    <p className="text-xs text-gray-400 mt-1">
                      Current: {editingPublication.pdf_filename} ({formatFileSize(editingPublication.pdf_size_bytes || 0)})
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => {
                    setEditingPublication(null);
                    setFormData(emptyForm);
                    setPdfFile(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdatePublication}
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
