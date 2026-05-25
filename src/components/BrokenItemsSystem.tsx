'use client';

import React, { useEffect, useState } from 'react';
import { Wrench } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Item } from '@/types/inventory';

const LAB_LABEL: Record<string, string> = {
  main: 'Main Lab',
  brunei: 'Brunei',
};

export default function BrokenItemsSystem() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBrokenItems = async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .eq('broken', true)
        .order('broken_at', { ascending: false });

      if (!error && data) setItems(data as Item[]);
      setLoading(false);
    };
    fetchBrokenItems();
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-red-100 p-2 rounded-lg">
          <Wrench className="w-6 h-6 text-red-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Broken Items</h2>
          <p className="text-sm text-gray-500">All items currently marked as broken across both inventories</p>
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lab</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reported by</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reported on</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-red-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    {item.name}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{item.category}</td>
                  <td className="px-4 py-3 text-gray-700">{item.location}</td>
                  <td className="px-4 py-3 text-gray-700">{LAB_LABEL[item.lab ?? 'main'] ?? item.lab}</td>
                  <td className="px-4 py-3 text-gray-700">{item.broken_by_email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {item.broken_at
                      ? new Date(item.broken_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-gray-400">
        To remove an item from this list, uncheck &quot;Mark as broken&quot; in its edit window.
      </p>
    </div>
  );
}
