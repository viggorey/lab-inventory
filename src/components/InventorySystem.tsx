'use client';

import React, { useState, useEffect } from 'react';
import { Download, Upload, LogOut } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import UserManagement from './UserManagement';

interface Item {
  id: string;
  name: string;
  quantity: string;
  category: string;
  location: string;
  source: string;
  created_at?: string;
  created_by?: string;
}

interface UserProfile {
  role: string;
}

const InventorySystem = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerms, setSearchTerms] = useState({
    name: '',
    quantity: '',
    category: '',
    location: '',
    source: ''
  });

  const [newItem, setNewItem] = useState({
    name: '',
    quantity: '',
    category: '',
    location: '',
    source: ''
  });

  // Check user role
// In InventorySystem.tsx, update the useEffect hook
useEffect(() => {
  const checkUserRole = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        if (profileError) {
          console.error('Profile fetch error:', profileError);
          setIsAdmin(false);
          return;
        }

        // Check if user is pending or denied
        if (profileData.role === 'pending' || profileData.role === 'denied') {
          // Redirect to login or show unauthorized message
          await supabase.auth.signOut();
          return;
        }

        const adminStatus = profileData?.role === 'admin';
        setIsAdmin(adminStatus);
      }
      await fetchItems();
    } catch (error) {
      console.error('Error in checkUserRole:', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };
  
  checkUserRole();
}, []);

  // Fetch items from database
  const fetchItems = async () => {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching items:', error);
      return;
    }

    setItems(data || []);
  };

  // Handle new item submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('inventory')
      .insert([{ ...newItem, created_by: user.id }]);

    if (error) {
      console.error('Error adding item:', error);
      return;
    }

    await fetchItems();
    setNewItem({
      name: '',
      quantity: '',
      category: '',
      location: '',
      source: ''
    });
  };

  // Add delete function
  const handleDelete = async (itemId: string) => {
    if (!isAdmin) return;
    if (window.confirm('Are you sure you want to delete this item?')) {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', itemId);

      if (error) {
        console.error('Error deleting item:', error);
        return;
      }

      await fetchItems();
    }
  };

  // Add edit functions
  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setIsEditing(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !isAdmin) return;

    const { error } = await supabase
      .from('inventory')
      .update({
        name: editingItem.name,
        quantity: editingItem.quantity,
        category: editingItem.category,
        location: editingItem.location,
        source: editingItem.source,
        updated_at: new Date().toISOString()
      })
      .eq('id', editingItem.id);

    if (error) {
      console.error('Error updating item:', error);
      return;
    }

    setIsEditing(false);
    setEditingItem(null);
    await fetchItems();
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingItem(null);
  };
  
  // Handle Excel export
  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(items);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, "lab_inventory.xlsx");
  };

  // Handle Excel import
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    
    const files = e.target.files;
    if (files && files[0]) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (event.target?.result) {
          const wb = XLSX.read(event.target.result, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws) as Item[];

          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          // Insert all items into database
          const { error } = await supabase
            .from('inventory')
            .insert(
              data.map(item => ({
                ...item,
                created_by: user.id
              }))
            );

          if (error) {
            console.error('Error importing items:', error);
            return;
          }

          await fetchItems();
        }
      };
      reader.readAsBinaryString(file);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Filter items based on search terms
  const filteredItems = items.filter(item => {
    return Object.keys(searchTerms).every(key => {
      const searchTerm = searchTerms[key as keyof typeof searchTerms];
      const itemValue = item[key as keyof Item];
      return !searchTerm || (itemValue?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    });
  });

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      {loading ? (
        <div className="text-center p-4">Loading...</div>
      ) : (
        <>
          {isAdmin && (
            <div className="mb-6">
              <UserManagement />
            </div>
          )}
          <div className="bg-white rounded-lg shadow-lg mb-6">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold mb-6 text-gray-900">Lab Inventory Management</h2>
                <div className="flex items-center gap-2">
                  {isAdmin && <span className="text-green-600 font-semibold">Admin</span>}
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 bg-red-400/80 text-white px-4 py-2 rounded hover:bg-red-500/85"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              </div>
  
              {isAdmin && (
                <form onSubmit={handleSubmit} className="grid grid-cols-5 gap-4 mb-6">
                  <input
                    className="px-3 py-2 border rounded"
                    placeholder="Name"
                    value={newItem.name}
                    onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                    required
                  />
                  <input
                    className="px-3 py-2 border rounded"
                    placeholder="Quantity"
                    type="number"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({...newItem, quantity: e.target.value})}
                    required
                  />
                  <input
                    className="px-3 py-2 border rounded"
                    placeholder="Category"
                    value={newItem.category}
                    onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                    required
                  />
                  <input
                    className="px-3 py-2 border rounded"
                    placeholder="Location"
                    value={newItem.location}
                    onChange={(e) => setNewItem({...newItem, location: e.target.value})}
                    required
                  />
                  <input
                    className="px-3 py-2 border rounded"
                    placeholder="Source"
                    value={newItem.source}
                    onChange={(e) => setNewItem({...newItem, source: e.target.value})}
                    required
                  />
                  <button 
                    type="submit" 
                    className="col-span-5 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                  >
                    Add Item
                  </button>
                </form>
              )}
  
              <div className="flex gap-4 mb-6">
                <button 
                  onClick={handleExport}
                  className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                >
                  <Download className="w-4 h-4" />
                  Export to Excel
                </button>
                
                {isAdmin && (
                  <>
                    <button 
                      className="flex items-center gap-2 bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
                      onClick={() => document.getElementById('file-upload')?.click()}
                    >
                      <Upload className="w-4 h-4" />
                      Import from Excel
                    </button>
                    <input
                      id="file-upload"
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleImport}
                      className="hidden"
                    />
                  </>
                )}
              </div>
  
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {Object.keys(searchTerms).map(key => (
                        <th key={key} className="border p-2 bg-gray-50 text-gray-900">
                          <div className="flex flex-col gap-2">
                            <span className="capitalize font-semibold text-gray-900">{key}</span>
                            <input
                              placeholder={`Search ${key}...`}
                              value={searchTerms[key as keyof typeof searchTerms]}
                              onChange={(e) => setSearchTerms({...searchTerms, [key]: e.target.value})}
                              className="w-full px-2 py-1 border rounded text-gray-900 placeholder-gray-500"
                            />
                          </div>
                        </th>
                      ))}
                      {isAdmin && <th className="border p-2 text-gray-900">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => (
                      <tr key={item.id}>
                        <td className="border p-2 text-gray-900">{item.name}</td>
                        <td className="border p-2 text-gray-900">{item.quantity}</td>
                        <td className="border p-2 text-gray-900">{item.category}</td>
                        <td className="border p-2 text-gray-900">{item.location}</td>
                        <td className="border p-2 text-gray-900">{item.source}</td>
                        {isAdmin && (
                          <td className="border p-2">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => handleEdit(item)}
                                className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                              >Edit</button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="bg-red-400/80 text-white px-2 py-1 rounded hover:bg-red-500/80"
                              >Delete</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {isEditing && editingItem && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="bg-white p-6 rounded-lg w-full max-w-2xl">
                <h3 className="text-xl font-bold mb-4">Edit Item</h3>
                <form onSubmit={handleSaveEdit} className="grid grid-cols-1 gap-4">
                  <input
                    className="px-3 py-2 border rounded"
                    placeholder="Name"
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({...editingItem, name: e.target.value})}
                    required
                  />
                  <input
                    className="px-3 py-2 border rounded"
                    placeholder="Quantity"
                    type="number"
                    value={editingItem.quantity}
                    onChange={(e) => setEditingItem({...editingItem, quantity: e.target.value})}
                    required
                  />
                  <input
                    className="px-3 py-2 border rounded"
                    placeholder="Category"
                    value={editingItem.category}
                    onChange={(e) => setEditingItem({...editingItem, category: e.target.value})}
                    required
                  />
                  <input
                    className="px-3 py-2 border rounded"
                    placeholder="Location"
                    value={editingItem.location}
                    onChange={(e) => setEditingItem({...editingItem, location: e.target.value})}
                    required
                  />
                  <input
                    className="px-3 py-2 border rounded"
                    placeholder="Source"
                    value={editingItem.source}
                    onChange={(e) => setEditingItem({...editingItem, source: e.target.value})}
                    required
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InventorySystem;

