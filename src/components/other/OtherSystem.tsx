'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { ExternalLink, Plus, Search, Trash2, Edit3, X, Link as LinkIcon } from 'lucide-react';
import type { SharedLink, SharedLinkFormData } from '@/types/shared-link';

interface OtherSystemProps {
  isAdmin: boolean;
}

const emptyForm: SharedLinkFormData = {
  title: '',
  url: '',
  comment: '',
};

export default function OtherSystem({ isAdmin }: OtherSystemProps) {
  const [links, setLinks] = useState<SharedLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLink, setEditingLink] = useState<SharedLink | null>(null);
  const [formData, setFormData] = useState<SharedLinkFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const initialLoadDone = React.useRef(false);

  const fetchLinks = useCallback(async () => {
    try {
      if (!initialLoadDone.current) {
        setLoading(true);
      }
      const { data, error } = await supabase
        .from('shared_links')
        .select('*')
        .order('title', { ascending: true });

      if (error) throw error;
      setLinks(data || []);
      initialLoadDone.current = true;
    } catch (error) {
      console.error('Error fetching shared links:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const handleAdd = async () => {
    if (!formData.title.trim() || !formData.url.trim()) {
      alert('Title and URL are required.');
      return;
    }

    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('shared_links')
        .insert([{
          title: formData.title.trim(),
          url: formData.url.trim(),
          comment: formData.comment.trim() || null,
          created_by: user.id,
        }]);

      if (error) throw error;

      setFormData(emptyForm);
      setShowAddForm(false);
      showSuccess('Link added successfully');
      fetchLinks();
    } catch (error) {
      console.error('Error adding link:', error);
      alert(error instanceof Error ? error.message : 'Failed to add link');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingLink || !formData.title.trim() || !formData.url.trim()) {
      alert('Title and URL are required.');
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('shared_links')
        .update({
          title: formData.title.trim(),
          url: formData.url.trim(),
          comment: formData.comment.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingLink.id);

      if (error) throw error;

      setEditingLink(null);
      setFormData(emptyForm);
      showSuccess('Link updated successfully');
      fetchLinks();
    } catch (error) {
      console.error('Error updating link:', error);
      alert(error instanceof Error ? error.message : 'Failed to update link');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (link: SharedLink) => {
    if (!confirm(`Delete "${link.title}"?`)) return;

    try {
      const { error } = await supabase
        .from('shared_links')
        .delete()
        .eq('id', link.id);

      if (error) throw error;
      showSuccess('Link deleted successfully');
      fetchLinks();
    } catch (error) {
      console.error('Error deleting link:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete link');
    }
  };

  const startEdit = (link: SharedLink) => {
    setEditingLink(link);
    setFormData({
      title: link.title,
      url: link.url,
      comment: link.comment || '',
    });
    setShowAddForm(false);
  };

  const cancelForm = () => {
    setShowAddForm(false);
    setEditingLink(null);
    setFormData(emptyForm);
  };

  const filteredLinks = links.filter((link) => {
    const term = searchTerm.toLowerCase();
    return (
      link.title.toLowerCase().includes(term) ||
      link.url.toLowerCase().includes(term) ||
      (link.comment && link.comment.toLowerCase().includes(term))
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isFormOpen = showAddForm || editingLink;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ExternalLink className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Shared Links</h2>
            <p className="text-gray-500">Shared drives, meeting links, and other resources</p>
          </div>
        </div>
        {isAdmin && !isFormOpen && (
          <button
            onClick={() => { setShowAddForm(true); setEditingLink(null); setFormData(emptyForm); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Link
          </button>
        )}
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}

      {/* Add / Edit Form */}
      {isFormOpen && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingLink ? 'Edit Link' : 'Add New Link'}
            </h3>
            <button onClick={cancelForm} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder="e.g. Shared Google Drive"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL *</label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder="https://..."
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
              <textarea
                value={formData.comment}
                onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                rows={2}
                placeholder="Optional description or notes"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={editingLink ? handleUpdate : handleAdd}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : editingLink ? 'Update Link' : 'Add Link'}
            </button>
            <button
              onClick={cancelForm}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search links..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Links list */}
      {filteredLinks.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <LinkIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">
            {searchTerm ? 'No links match your search.' : 'No shared links yet.'}
          </p>
          {isAdmin && !searchTerm && (
            <p className="mt-2">Click &quot;Add Link&quot; to create one.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLinks.map((link) => (
            <div
              key={link.id}
              className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-5 flex flex-col"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lg font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5 min-w-0"
                >
                  <ExternalLink className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{link.title}</span>
                </a>
                {isAdmin && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => startEdit(link)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(link)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-400 truncate mb-2">{link.url}</p>
              {link.comment && (
                <p className="text-sm text-gray-600 mt-auto">{link.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
