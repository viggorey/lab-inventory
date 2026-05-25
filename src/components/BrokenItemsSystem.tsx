'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, Wrench } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Item } from '@/types/inventory';

const LAB_LABEL: Record<string, string> = {
  main: 'Main Lab',
  brunei: 'Brunei',
};

interface Props {
  lab?: string;
}

export default function BrokenItemsSystem({ lab }: Props) {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [fixingId, setFixingId] = useState<string | null>(null);

  const fetchBrokenItems = useCallback(async () => {
    let query = supabase
      .from('inventory')
      .select('*')
      .eq('broken', true)
      .order('broken_at', { ascending: false });

    if (lab) query = query.eq('lab', lab);

    const { data, error } = await query;
    if (!error && data) setItems(data as Item[]);
    setLoading(false);
  }, [lab]);

  useEffect(() => {
    fetchBrokenItems();
  }, [fetchBrokenItems]);

  const handleFixed = async (item: Item) => {
    setFixingId(item.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('inventory')
        .update({ broken: false, broken_at: null, broken_by_email: null })
        .eq('id', item.id);

      if (error) throw error;

      await supabase.from('inventory_logs').insert({
        item_id: item.id,
        user_id: user.id,
        user_email: user.email,
        action_type: 'edit',
        field_name: 'broken',
        old_value: 'true',
        new_value: 'false',
        timestamp: new Date().toISOString(),
      });

      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err) {
      console.error('Error marking item as fixed:', err);
    } finally {
      setFixingId(null);
    }
  };

  const heading = lab ? `Broken Items — ${LAB_LABEL[lab] ?? lab}` : 'Broken Items';
  const subheading = lab
    ? `Items in ${LAB_LABEL[lab] ?? lab} currently marked as broken`
    : 'All items currently marked as broken across both inventories';

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-red-100 p-2 rounded-lg">
          <Wrench className="w-6 h-6 text-red-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{heading}</h2>
          <p className="text-sm text-gray-500">{subheading}</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No broken items reported</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                {!lab && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lab</th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comment</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reported by</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reported on</th>
                {isAdmin && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-red-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                      {item.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{item.category}</td>
                  <td className="px-4 py-3 text-gray-700">{item.location}</td>
                  {!lab && (
                    <td className="px-4 py-3 text-gray-700">{LAB_LABEL[item.lab ?? 'main'] ?? item.lab}</td>
                  )}
                  <td className="px-4 py-3 text-gray-500 italic">{item.broken_comment || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{item.broken_by_email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {item.broken_at
                      ? new Date(item.broken_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                      : '—'}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleFixed(item)}
                        disabled={fixingId === item.id}
                        className="flex items-center gap-1.5 bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200 transition-colors text-xs font-medium disabled:opacity-50"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        {fixingId === item.id ? 'Fixing…' : 'Fixed'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
