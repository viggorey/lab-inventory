'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Download, Upload, LogOut } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import UserManagement from './UserManagement';
import AutocompleteInput from '@/components/AutocompleteInput';
import Pagination from '@/components/Pagination';
import { Calendar, Edit, X, ClipboardList, Trash2 } from 'lucide-react';
import BookingModal from '@/components/BookingModal';
import BookingsList from '@/components/BookingsList';
import { Item } from '@/types/inventory';

const DEBUG = process.env.NODE_ENV === 'development';

interface InventoryLog {
  id: string;
  item_id: string;
  user_id: string;
  user_email: string;
  action_type: 'create' | 'edit' | 'delete';
  field_name?: string;
  old_value?: string;
  new_value?: string;
  timestamp: Date;
}

const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${Math.round(size)}${units[unitIndex]}`;
};


const InventorySystem = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [allItems, setAllItems] = useState<Item[]>([]);
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
  const ITEMS_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB limit
  
  const [showLogs, setShowLogs] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const DELETION_PHRASE = "I will delete all of Walter's inventory";



  // Keep fetchItems outside useEffect but wrap it in useCallback
  const fetchItems = useCallback(async (fetchAll: boolean = false) => {
    try {
      if (DEBUG) console.log(`Starting fetchItems (fetchAll: ${fetchAll})`);
      
      const countResponse = await supabase
        .from('inventory')
        .select('*', { count: 'exact', head: true });
      
      let query = supabase
        .from('inventory')
        .select('*')
        .order('created_at', { ascending: false });

      if (!fetchAll) {
        query = query.range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (fetchAll) {
        setAllItems(data || []);
      } else {
        setItems(data || []);
      }
      setTotalItems(countResponse.count || 0);
    } catch (error) {
      console.error('Error in fetchItems:', error);
    }
  }, [currentPage]);


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

          if (profileData.role === 'pending' || profileData.role === 'denied') {
            await supabase.auth.signOut();
            return;
          }

          const adminStatus = profileData?.role === 'admin';
          setIsAdmin(adminStatus);
        }
        
        // Fetch data
        await Promise.all([
          fetchItems(),      // Fetch paginated items
          fetchItems(true)   // Fetch all items
        ]);
      } catch (error) {
        console.error('Error in checkUserRole:', error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    setIsClient(true);
    checkUserRole();
  }, [fetchItems]); // Add fetchItems as dependency


  // Handle new item submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
  
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user found');
        return;
      }
  
      // Insert new item
      const { data: newItemData, error: insertError } = await supabase
        .from('inventory')
        .insert([{ ...newItem, created_by: user.id }])
        .select()
        .single();
  
      if (insertError) {
        console.error('Insert error:', insertError);
        throw insertError;
      }
  
      // If we get here, item was created successfully
      console.log('Item created:', newItemData);
  
      try {
        // Create log entry
        const { error: logError } = await supabase
          .from('inventory_logs')
          .insert([{  // Note the array wrapper
            item_id: newItemData.id,
            user_id: user.id,
            user_email: user.email,
            action_type: 'create',
            timestamp: new Date().toISOString()
          }]);
  
        if (logError) {
          console.error('Log creation error:', logError);
          // Don't throw here, we still want to update the UI
        }
      } catch (logError) {
        console.error('Log creation failed:', logError);
        // Don't throw here either
      }
  
      // Update UI regardless of log success
      await Promise.all([
        fetchItems(),
        fetchItems(true)
      ]);
  
      // Reset form
      setNewItem({
        name: '',
        quantity: '',
        category: '',
        location: '',
        source: ''
      });

  
    } catch (error) {
      console.error('Error details:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        type: typeof error
      });
      alert('Failed to add item. Please try again.');
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!isAdmin) return;
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        console.log('Starting deletion process for item:', itemId);
  
        // First delete related bookings
        console.log('Deleting bookings...');
        const { data: bookings, error: bookingsError } = await supabase
          .from('inventory_bookings')
          .delete()
          .eq('item_id', itemId)
          .select();
  
        if (bookingsError) {
          console.error('Error deleting bookings:', bookingsError);
          throw bookingsError;
        }
        console.log('Bookings deleted:', bookings);
  
        // Then delete related logs
        console.log('Deleting logs...');
        const { data: logs, error: logsError } = await supabase
          .from('inventory_logs')
          .delete()
          .eq('item_id', itemId)
          .select();
  
        if (logsError) {
          console.error('Error deleting logs:', logsError);
          throw logsError;
        }
        console.log('Logs deleted:', logs);
  
        // Finally delete the inventory item
        console.log('Deleting inventory item...');
        const { data: deletedItem, error: inventoryError } = await supabase
          .from('inventory')
          .delete()
          .eq('id', itemId)
          .select();
  
        if (inventoryError) {
          console.error('Error deleting inventory item:', inventoryError);
          throw inventoryError;
        }
        console.log('Inventory item deleted:', deletedItem);
  
        // Close the edit modal
        setIsEditing(false);
        setEditingItem(null);
        
        // Refresh the items
        await Promise.all([
          fetchItems(),
          fetchItems(true)
        ]);
  
        console.log('Deletion process completed successfully');
  
      } catch (error) {
        console.error('Error during deletion process:', error);
        alert('Failed to delete item. Please try again.');
      }
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
  
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
  
      // Get the original item to compare changes
      const { data: originalItem } = await supabase
        .from('inventory')
        .select('*')
        .eq('id', editingItem.id)
        .single();
  
      // Update the item
      const { error: updateError } = await supabase
        .from('inventory')
        .update({
          name: editingItem.name,
          quantity: editingItem.quantity,
          category: editingItem.category,
          location: editingItem.location,
          source: editingItem.source,
          updated_at: new Date().toISOString(),
          updated_by: user.id
        })
        .eq('id', editingItem.id);
  
      if (updateError) throw updateError;
  
      // Log the changes
      if (originalItem) {
        const changes = [];
        const fields: (keyof Item)[] = ['name', 'quantity', 'category', 'location', 'source'];
        
        for (const field of fields) {
          if (originalItem[field] !== editingItem[field]) {
            changes.push({
              item_id: editingItem.id,
              user_id: user.id,
              action_type: 'edit',
              field_name: field,
              old_value: originalItem[field]?.toString() || '',
              new_value: editingItem[field]?.toString() || '',
              user_email: user.email
            });
          }
        }
  
        if (changes.length > 0) {
          const { error: logError } = await supabase
            .from('inventory_logs')
            .insert(changes);
  
          if (logError) throw logError;
        }
      }
  
      setIsEditing(false);
      setEditingItem(null);
      await fetchItems();
    } catch (error) {
      console.error('Error updating item:', error);
      alert('Failed to update item. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingItem(null);
  };
  

  const fetchItemLogs = async (itemId: string) => {
    setLogsLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory_logs')
        .select('*')
        .eq('item_id', itemId)
        .order('timestamp', { ascending: false });
  
      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLogsLoading(false);
    }
  };

  // Handle Excel export
  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(allItems);
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
  
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        alert('File is too large. Maximum size is 5MB.');
        // Reset the file input
        e.target.value = '';
        return;
      }
  
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (event.target?.result) {
          try {
            const wb = XLSX.read(event.target.result, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws) as Item[];
  
            // Validate that data isn't empty
            if (data.length === 0) {
              alert('The Excel file appears to be empty.');
              return;
            }
  
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
              alert('Error importing items. Please check the file format and try again.');
              return;
            }
  
            await fetchItems(); // Fetch paginated items
            await fetchItems(true); // Fetch all items
            alert('Import successful!');
          } catch (error) {
            console.error('Error processing file:', error);
            alert('Error processing file. Please make sure it\'s a valid Excel file.');
          }
        }
      };
  
      reader.onerror = () => {
        alert('Error reading file. Please try again.');
      };
  
      reader.readAsBinaryString(file);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
        return;
      }
      // Force a page refresh after successful logout
      window.location.href = '/';
    } catch (error) {
      console.error('Unexpected error during sign out:', error);
    }
  };

  const handleDeleteAllInventory = async () => {
    if (deleteConfirmation !== DELETION_PHRASE) {
      alert('Please type the confirmation phrase exactly as shown');
      return;
    }
  
    try {
      // First delete all logs
      const { error: logsError } = await supabase
        .from('inventory_logs')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000');
  
      if (logsError) throw logsError;
  
      // Then delete all bookings
      const { error: bookingsError } = await supabase
        .from('inventory_bookings')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000');
  
      if (bookingsError) throw bookingsError;
  
      // Finally delete all inventory items
      const { error: inventoryError } = await supabase
        .from('inventory')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000');
  
      if (inventoryError) throw inventoryError;
  
      // Clear the form and close the modal
      setDeleteConfirmation('');
      setShowDeleteAll(false);
      
      // Refresh the inventory lists
      await fetchItems();
      await fetchItems(true);
      
      alert('All inventory items have been deleted');
    } catch (error) {
      console.error('Error deleting inventory:', error);
      alert('Failed to delete inventory. Please try again.');
    }
  };

  // Filter items based on search terms
  const filteredItems = allItems.filter(item => {
    return Object.keys(searchTerms).every(key => {
      const searchTerm = searchTerms[key as keyof typeof searchTerms];
      const itemValue = item[key as keyof Item];
      return !searchTerm || (itemValue?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    });

  });

  const handleShowLogs = async (itemId: string) => {
    setSelectedItemId(itemId);
    setShowLogs(true);
    await fetchItemLogs(itemId);
  };
  
  const handleBook = (item: Item) => {
    setSelectedItem(item);
    setShowBooking(true);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-4 max-w-6xl mx-auto bg-blue-50 min-h-screen">
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
            <BookingsList />
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
  
              {isAdmin && isClient && (
                <form onSubmit={handleSubmit} className="grid grid-cols-5 gap-4 mb-6">
                  <input
                    className="px-3 py-2 border rounded w-full text-gray-700 placeholder-gray-500"
                    placeholder="Name"
                    value={newItem.name}
                    onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                    required
                  />
                  <input
                    className="px-3 py-2 border rounded w-full text-gray-700 placeholder-gray-500"
                    placeholder="Quantity"
                    type="number"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({...newItem, quantity: e.target.value})}
                    required
                  />
                  <AutocompleteInput
                    value={newItem.category}
                    onChange={(value) => setNewItem({...newItem, category: value})}
                    placeholder="Category"
                    items={items}
                    field="category"
                  />
                  <AutocompleteInput
                    value={newItem.location}
                    onChange={(value) => setNewItem({...newItem, location: value})}
                    placeholder="Location"
                    items={items}
                    field="location"
                  />
                  <input
                    className="px-3 py-2 border rounded w-full text-gray-700 placeholder-gray-500"
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
                      Import from Excel (Max {formatFileSize(MAX_FILE_SIZE)})
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
                              {key === 'category' || key === 'location' ? (
                                <AutocompleteInput
                                  value={searchTerms[key]}
                                  onChange={(value) => setSearchTerms({...searchTerms, [key]: value})}
                                  placeholder={`Search ${key}...`}
                                  items={items}
                                  field={key as 'category' | 'location'}
                                />
                              ) : (
                                <input
                                  placeholder={`Search ${key}...`}
                                  value={searchTerms[key as keyof typeof searchTerms]}
                                  onChange={(e) => setSearchTerms({...searchTerms, [key]: e.target.value})}
                                  className="w-full px-2 py-1 border rounded text-gray-700 font-normal placeholder-gray-500"
                                />
                              )}
                            </div>
                          </th>
                        ))}
                        {isAdmin && <th className="border p-2 text-gray-900">Actions</th>}
                      </tr>
                    </thead>
                  <tbody>
                    {(Object.values(searchTerms).some(term => term !== '') ? filteredItems : items).map((item) => (
                      <tr key={item.id}>
                        <td className="border p-2 text-gray-900">{item.name}</td>
                        <td className="border p-2 text-gray-900">{item.quantity}</td>
                        <td className="border p-2 text-gray-900">{item.category}</td>
                        <td className="border p-2 text-gray-900">{item.location}</td>
                        <td className="border p-2 text-gray-900">{item.source}</td>
                        <td className="border p-2">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => handleBook(item)}
                            className="bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 flex items-center gap-1"
                          >
                            <Calendar className="w-4 h-4" />
                            Book
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleEdit(item)}
                              className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 flex items-center gap-1"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </button>
                          )}
                        </div>
                      </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(
                    (Object.values(searchTerms).some(term => term !== '') 
                      ? filteredItems.length 
                      : totalItems) 
                    / ITEMS_PER_PAGE
                  )}
                  onPageChange={setCurrentPage}
                />
              </div>
            </div>
          </div>

          {isEditing && editingItem && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="bg-white p-6 rounded-lg w-full max-w-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold">Edit Item</h3>
                  <button
                    onClick={handleCancelEdit}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveEdit} className="grid grid-cols-1 gap-4">
                  <input
                    className="px-3 py-2 border rounded w-full text-gray-700 placeholder-gray-500"
                    placeholder="Name"
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({...editingItem, name: e.target.value})}
                    required
                  />
                  <input
                    className="px-3 py-2 border rounded w-full text-gray-700 placeholder-gray-500"
                    placeholder="Quantity"
                    type="number"
                    value={editingItem.quantity}
                    onChange={(e) => setEditingItem({...editingItem, quantity: e.target.value})}
                    required
                  />
                  <AutocompleteInput
                    value={editingItem.category}
                    onChange={(value) => setEditingItem({...editingItem, category: value})}
                    placeholder="Category"
                    items={items}
                    field="category"
                  />
                  <AutocompleteInput
                    value={editingItem.location}
                    onChange={(value) => setEditingItem({...editingItem, location: value})}
                    placeholder="Location"
                    items={items}
                    field="location"
                  />
                  <input
                    className="px-3 py-2 border rounded w-full text-gray-700 placeholder-gray-500"
                    placeholder="Source"
                    value={editingItem.source}
                    onChange={(e) => setEditingItem({...editingItem, source: e.target.value})}
                    required
                  />
                  
                  <div className="flex justify-between mt-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleShowLogs(editingItem.id)}
                        className="bg-blue-100 text-blue-700 px-4 py-2 rounded hover:bg-blue-200 flex items-center gap-2"
                      >
                        <ClipboardList className="w-4 h-4" />
                        Logs
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(editingItem.id)}
                        className="bg-red-100 text-red-700 px-4 py-2 rounded hover:bg-red-200 flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Item
                      </button>
                    </div>
                    <div className="flex gap-2">
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
                  </div>
                </form>
              </div>
            </div>
          )}

          {showLogs && selectedItemId && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="bg-white p-6 rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold">Item History</h3>
                  <button
                    onClick={() => setShowLogs(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-auto">
                  {logsLoading ? (
                    <div className="flex justify-center items-center h-32">
                      <span className="text-gray-600">Loading logs...</span>
                    </div>
                  ) : logs.length === 0 ? (
                    <div className="text-center text-gray-600 py-8">
                      No history available for this item
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {logs.map((log) => (
                        <div key={log.id} className="border-l-4 border-blue-500 pl-4 py-2">
                          <div className="flex justify-between text-sm text-gray-600">
                            <span>{log.user_email}</span>
                            <span>{new Date(log.timestamp).toLocaleString()}</span>
                          </div>
                          <div className="mt-1">
                            {log.action_type === 'edit' ? (
                              <p>
                                Changed <span className="font-semibold">{log.field_name}</span> from{' '}
                                <span className="text-red-600">{log.old_value}</span> to{' '}
                                <span className="text-green-600">{log.new_value}</span>
                              </p>
                            ) : log.action_type === 'create' ? (
                              <p>Created item</p>
                            ) : (
                              <p>Deleted item</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {showBooking && selectedItem && (
            <BookingModal
              item={selectedItem}
              onClose={() => setShowBooking(false)}
              onBookingComplete={() => {
                setShowBooking(false);
                fetchItems();
              }}
            />
          )}
          {/* Delete All Modal */}
          {showDeleteAll && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="bg-white p-6 rounded-lg w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-red-600">⚠️ Delete Entire Inventory</h3>
                  <button
                    onClick={() => {
                      setShowDeleteAll(false);
                      setDeleteConfirmation('');
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="bg-red-50 border-l-4 border-red-600 p-4">
                    <p className="text-red-700">
                      This action is irreversible. To confirm deletion, please type:
                    </p>
                    <p className="font-mono bg-gray-100 p-2 mt-2 text-sm">
                      {DELETION_PHRASE}
                    </p>
                  </div>

                  <input
                    type="text"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="Type confirmation phrase here"
                    className="w-full px-3 py-2 border rounded"
                  />

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setShowDeleteAll(false);
                        setDeleteConfirmation('');
                      }}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteAllInventory}
                      disabled={deleteConfirmation !== DELETION_PHRASE}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Delete All Items
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {isAdmin && (
            <div className="text-right mt-8">
              <button
                onClick={() => setShowDeleteAll(true)}
                className="text-xs text-gray-400 hover:text-red-600 underline"
              >
                Delete All Inventory
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InventorySystem;