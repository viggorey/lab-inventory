'use client';

import React, { useState, useEffect, useCallback, memo} from 'react';
import { Download, Upload, Search, MessageSquare, ClipboardList, Trash2 } from 'lucide-react';import { uniq } from 'lodash';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import UserManagement from './UserManagement';
import UserActivityDashboard from './UserActivityDashboard';
import AutocompleteInput from '@/components/AutocompleteInput';
import Pagination from '@/components/Pagination';
import { Calendar, Edit, X, Activity } from 'lucide-react';
import BookingModal from '@/components/BookingModal';
import BookingsList from '@/components/BookingsList';
import CommentModal from '@/components/CommentModal';
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

interface SimilarityWarning {
  similarItems: string[];
  similarCategories: string[];
  show: boolean;
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

const InventoryRow = memo(({ item, isAdmin, onEdit, onBook }: {
  item: Item;
  isAdmin: boolean;
  onEdit: (item: Item) => void;
  onBook: (item: Item) => void;
}) => {
  const [showComment, setShowComment] = useState(false);

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.name}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {item.quantity} {item.unit}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.category}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.location}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          <div className="flex items-center gap-2">
            {item.source}
            {item.comment && (
              <button
                onClick={() => setShowComment(!showComment)}
                className="text-blue-500 hover:text-blue-700"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            )}
          </div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-sm bg-gray-50">
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={() => onBook(item)}
              className="bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 transition-colors flex items-center gap-1"
            >
              <Calendar className="w-3 h-3" />
              Book
            </button>
            {isAdmin && (
              <button
                onClick={() => onEdit(item)}
                className="bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors flex items-center gap-1"
              >
                <Edit className="w-3 h-3" />
                Edit
              </button>
            )}
          </div>
        </td>
      </tr>
      {showComment && item.comment && (
        <tr>
          <td colSpan={6} className="bg-gray-50 px-6 py-4">
            <div className="text-sm text-gray-700 whitespace-pre-wrap">
              {item.comment}
            </div>
          </td>
        </tr>
      )}
    </>
  );
});

InventoryRow.displayName = 'InventoryRow';

const InventorySystem = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [searchTerms, setSearchTerms] = useState({
    name: '',
    quantity: '',  // This will include both quantity and unit
    category: '',
    location: '',
    source: ''     // This will search both source and comment
  });
  const [similarityWarning, setSimilarityWarning] = useState<SimilarityWarning>({
    similarItems: [],
    similarCategories: [],
    show: false
  });
  const [newItem, setNewItem] = useState({
    name: '',
    quantity: '',
    unit: '',
    category: '',
    location: '',
    source: '',
    comment: ''
  });

  const [showCommentModal, setShowCommentModal] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  
  const ITEMS_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB limit
  
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const DELETION_PHRASE = "I will delete all of Walter's inventory";
  const [showActivityDashboard, setShowActivityDashboard] = useState(false);

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
        .order('category', { ascending: true }) // First, sort by category
        .order('name', { ascending: true });    // Then, sort by name within categories
  
      if (!fetchAll) {
        query = query.range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);
      }
  
      const { data, error } = await query;
  
      if (error) throw error;
  
      if (fetchAll) {
        // Sort for all items view
        const sortedData = data
          .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
        setAllItems(sortedData || []);
      } else {
        // Sort for paginated view
        const sortedData = data
          .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
        setItems(sortedData || []);
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

    checkUserRole();
  }, [fetchItems]);

  // Calculate similarity of item name added (60% warning)
  function levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
  
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j - 1] + 1,
            dp[i - 1][j] + 1,
            dp[i][j - 1] + 1
          );
        }
      }
    }
    return dp[m][n];
  }
  
  function findSimilarValues(
    newValue: string, 
    existingValues: string[], 
    threshold: number = 0.6
  ): string[] {
    const normalizedNewValue = newValue.toLowerCase().trim();
    const newValueWords = normalizedNewValue.split(/\s+/).sort();
    
    return existingValues.filter(existingValue => {
      const normalizedExistingValue = existingValue.toLowerCase().trim();
      
      // Skip exact matches (case-insensitive)
      if (normalizedNewValue === normalizedExistingValue) {
        return false;
      }
      
      const existingValueWords = normalizedExistingValue.split(/\s+/).sort();
      
      // Check word permutations
      const wordPermutationSimilarity = newValueWords.length === existingValueWords.length &&
        newValueWords.every((word, i) => 
          levenshteinDistance(word, existingValueWords[i]) <= 2
        );
      
      // Check overall string similarity
      const maxLength = Math.max(normalizedNewValue.length, normalizedExistingValue.length);
      const distance = levenshteinDistance(normalizedNewValue, normalizedExistingValue);
      const stringSimilarity = (maxLength - distance) / maxLength;
      
      return wordPermutationSimilarity || stringSimilarity >= threshold;
    });
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
  
    try {
      const similarItems = findSimilarValues(newItem.name, items.map(item => item.name));
      const similarCategories = findSimilarValues(
        newItem.category, 
        uniq(items.map(item => item.category))
      );
      
      if (similarItems.length > 0 || similarCategories.length > 0) {
        setSimilarityWarning({
          similarItems,
          similarCategories,
          show: true
        });
        return;
      }
  
      await addItem();
    } catch (error) {
      console.error('Error details:', error);
      alert('Failed to add item. Please try again.');
    }
  };
  
  // Separate function for adding the item
  const addItem = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');
  
      // Clean up the item data before insertion
      const itemToInsert = {
        ...newItem,
        unit: newItem.unit || null,      // Make sure unit is null if empty
        comment: newItem.comment || null, // Make sure comment is null if empty
        created_by: user.id
      };
  
      const { data: newItemData, error: insertError } = await supabase
        .from('inventory')
        .insert([itemToInsert])
        .select()
        .single();
  
      if (insertError) throw insertError;
  
      // Create log entry
      const { error: logError } = await supabase
        .from('inventory_logs')
        .insert([{
          item_id: newItemData.id,
          user_id: user.id,
          user_email: user.email,
          action_type: 'create',
          timestamp: new Date().toISOString()
        }]);
  
      if (logError) {
        console.error('Log creation error:', logError);
      }
  
      await Promise.all([fetchItems(), fetchItems(true)]);
  
    // Add success message and clear it after 3 seconds
    setSuccessMessage('Item added successfully!');
    setTimeout(() => {
      setSuccessMessage('');
    }, 3000);

    // Reset form with all fields
    setNewItem({
      name: '',
      quantity: '',
      unit: '',
      category: '',
      location: '',
      source: '',
      comment: ''
    });

    setSimilarityWarning({ similarItems: [], similarCategories: [], show: false });
    
    // Close comment modal if it's open
    setShowCommentModal(false);
  } catch (error) {
    console.error('Error details:', error);
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
      const { data: originalItem, error: originalError } = await supabase
        .from('inventory')
        .select('*')
        .eq('id', editingItem.id)
        .single();
  
      if (originalError) throw originalError;
  
      // Update the item
      const { error: updateError } = await supabase
        .from('inventory')
        .update({
          name: editingItem.name,
          quantity: editingItem.quantity,
          unit: editingItem.unit || null,
          category: editingItem.category,
          location: editingItem.location,
          source: editingItem.source,
          comment: editingItem.comment || null,
          updated_at: new Date().toISOString(),
          updated_by: user.id
        })
        .eq('id', editingItem.id);
  
      if (updateError) throw updateError;
  
      // Log the changes
      if (originalItem) {
        const changes = [];
        const fields: (keyof Item)[] = ['name', 'quantity', 'unit', 'category', 'location', 'source', 'comment'];
        
        for (const field of fields) {
          if (originalItem[field]?.toString() !== editingItem[field]?.toString()) {
            const logEntry = {
              item_id: editingItem.id,
              user_id: user.id,
              user_email: user.email,
              action_type: 'edit',
              field_name: field,
              old_value: originalItem[field]?.toString() || '',
              new_value: editingItem[field]?.toString() || '',
              timestamp: new Date().toISOString()
            };
            changes.push(logEntry);
          }
        }
  
        if (changes.length > 0) {
          const { error: logError } = await supabase
            .from('inventory_logs')
            .insert(changes)
            .select();
  
          if (logError) {
            console.error('Error creating logs:', logError);
          }
        }
      }
  
      setIsEditing(false);
      setEditingItem(null);
      setShowCommentModal(false);
      await fetchItems();
      await fetchItems(true);
      
      setSuccessMessage('Item updated successfully');
      setTimeout(() => setSuccessMessage(''), 2000); // Clear after 2 seconds
    } catch (error) {
      console.error('Error updating item:', error);
      alert('Failed to update item. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingItem(null);
  };
  

// HandleExport function
const handleExport = () => {
  const exportData = allItems.map(item => ({
    name: item.name || '',
    quantity: item.quantity.toString(),  // Convert to string to ensure Excel handles 0 properly
    unit: item.unit || '',              // Empty string if null/undefined
    category: item.category || '',
    location: item.location || '',
    source: item.source || '',          // Empty string if null/undefined
    comment: item.comment || ''         // Empty string if null/undefined
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventory");
  XLSX.writeFile(wb, "lab_inventory.xlsx");
};

// Update handleImport function
const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
  if (!isAdmin) return;
    
  const files = e.target.files;
  if (files && files[0]) {
    const file = files[0];

    if (file.size > MAX_FILE_SIZE) {
      alert('File is too large. Maximum size is 5MB.');
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
          
          const data = XLSX.utils.sheet_to_json(ws, { 
            defval: null,  
            raw: false     
          }) as Array<{
            name?: string;
            quantity?: number | string;
            unit?: string;
            category?: string;
            location?: string;
            source?: string;
            comment?: string;
          }>;
  
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
  
          const transformedData = data.filter(row => 
            row.name && row.name.toString().trim() !== '' &&
            row.quantity !== undefined && row.quantity !== null &&
            row.category && row.category.toString().trim() !== '' &&
            row.location && row.location.toString().trim() !== ''
          ).map(row => ({
            name: String(row.name).trim(),
            quantity: Number(row.quantity),
            unit: row.unit ? String(row.unit).trim() : null,
            category: String(row.category).trim(),
            location: String(row.location).trim(),
            source: row.source ? String(row.source).trim() : null,
            comment: row.comment ? String(row.comment).trim() : null,
            created_by: user.id,
            created_at: new Date().toISOString()
          }));
  
          if (transformedData.length === 0) {
            throw new Error('No valid rows found for import');
          }
  
          const { error } = await supabase
            .from('inventory')
            .insert(transformedData);
  
          if (error) throw error;
  
          await Promise.all([fetchItems(), fetchItems(true)]);
          alert(`Import successful! ${transformedData.length} items imported.`);
        } catch (error) {
          const errorMessage = error instanceof Error 
            ? error.message 
            : 'An unknown error occurred during file import';
          
          alert(errorMessage);
        }
      }
    };

    reader.readAsBinaryString(file);
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
      if (!searchTerm) return true;
  
      if (key === 'quantity') {
        const fullQuantity = `${item.quantity} ${item.unit || ''}`.toLowerCase();
        return fullQuantity.includes(searchTerm.toLowerCase());
      }
  
      if (key === 'source') {
        const sourceAndComment = `${item.source} ${item.comment || ''}`.toLowerCase();
        return sourceAndComment.includes(searchTerm.toLowerCase());
      }
  
      const itemValue = item[key as keyof Item];
      return itemValue?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ?? false;
    });
  });

  const handleShowLogs = async (itemId: string) => {
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
    setSuccessMessage('');
  };
  
  const handleBook = (item: Item) => {
    setSelectedItem(item);
    setShowBooking(true);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      {/* Success Message - Place this at the top level */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg transition-opacity duration-300">
          {successMessage}
        </div>
      )}
  
      {loading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg text-gray-600">Loading...</div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto space-y-6">
          {/* User Management Section */}
          {isAdmin && (
            <div className="bg-white rounded-xl shadow-lg">
              <UserManagement />
            </div>
          )}

          {/* Bookings List */}
          <div className="bg-white rounded-xl shadow-lg">
            <BookingsList />
          </div>

          {/* Main Content */}
          <div className="bg-white rounded-xl shadow-lg">
            <div className="p-6">
              {/* Add New Item Form (Admin Only) */}
              {isAdmin && (
                <form onSubmit={handleSubmit} className="mb-8 bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Item</h3>
                  <div className="flex items-center gap-4">
                    <div className="w-1/4">
                      <input
                        className="px-4 py-2 border rounded-lg w-full text-gray-700 placeholder-gray-500 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all"
                        placeholder="Name *"
                        value={newItem.name}
                        onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                        required
                      />
                    </div>

                    <div className="flex gap-2 w-1/6">
                      <input
                        className="px-4 py-2 border rounded-lg w-20 text-gray-700 placeholder-gray-500 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all"
                        placeholder="Qty *"
                        type="number"
                        min="0"
                        value={newItem.quantity}
                        onChange={(e) => setNewItem({...newItem, quantity: e.target.value})}
                        required
                      />
                      <div className="w-24">
                        <AutocompleteInput
                          value={newItem.unit}
                          onChange={(value) => setNewItem({...newItem, unit: value})}
                          placeholder="Unit"
                          items={items}
                          field="unit"
                        />
                      </div>
                    </div>

                    <div className="w-1/6">
                      <AutocompleteInput
                        value={newItem.category}
                        onChange={(value) => setNewItem({...newItem, category: value})}
                        placeholder="Category *"
                        items={allItems}
                        field="category"
                      />
                    </div>

                    <div className="w-1/6">
                      <AutocompleteInput
                        value={newItem.location}
                        onChange={(value) => setNewItem({...newItem, location: value})}
                        placeholder="Location *"
                        items={allItems}
                        field="location"
                      />
                    </div>

                    <div className="flex items-center gap-2 w-1/6">
                      <input
                        className="px-4 py-2 border rounded-lg w-full text-gray-700 placeholder-gray-500 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all"
                        placeholder="Source"
                        value={newItem.source}
                        onChange={(e) => setNewItem({...newItem, source: e.target.value})}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCommentModal(true)}
                        className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${
                          newItem.comment ? 'text-blue-500' : 'text-gray-500'
                        }`}
                      >
                        <MessageSquare className="w-5 h-5" />
                      </button>
                    </div>

                    <button 
                      type="submit" 
                      className={`bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0 ${
                        successMessage ? 'bg-green-500 hover:bg-green-600' : ''
                      }`}
                    >
                      {successMessage ? 'Added ✓' : 'Add Item'}
                    </button>
                  </div>
                </form>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4 mb-6">
                <button 
                  onClick={handleExport}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export to Excel
                </button>
                
                {isAdmin && (
                  <>
                    <button 
                      className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
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
                    <button 
                      className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                      onClick={() => setShowActivityDashboard(true)}
                    >
                      <Activity className="w-4 h-4" />
                      User Activity Dashboard
                    </button>
                  </>
                )}
              </div>

              {/* Search and Filters */}
              <div className="mb-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {Object.keys(searchTerms).map(key => (
                    <div key={key}>
                      <div className="text-sm font-medium text-gray-700 mb-1 capitalize">{key}</div>
                      {key === 'category' || key === 'location' ? (
                        <AutocompleteInput
                          value={searchTerms[key]}
                          onChange={(value) => setSearchTerms({...searchTerms, [key]: value})}
                          placeholder={`Search ${key}...`}
                          items={allItems}
                          field={key as 'category' | 'location'}
                        />
                      ) : (
                        <div className="relative">
                          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                          <input
                            placeholder={`Search ${key}...`}
                            value={searchTerms[key as keyof typeof searchTerms]}
                            onChange={(e) => setSearchTerms({...searchTerms, [key]: e.target.value})}
                            className="w-full pl-10 pr-4 py-2 border rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Inventory Table */}
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                        Location
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                        Source/Comment
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-100 w-[120px]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(Object.values(searchTerms).some(term => term !== '') 
                      ? filteredItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                      : items).map((item) => (
                      <InventoryRow 
                        key={item.id}
                        item={item}
                        isAdmin={isAdmin}
                        onEdit={handleEdit}
                        onBook={handleBook}
                      />
                    ))}
                  </tbody>
                </table>
              </div>


              {/* Pagination */}
              <div className="mt-6">
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

          {/* Admin Delete All Section */}
          {isAdmin && (
            <div className="text-right mt-8">
              <button
                onClick={() => setShowDeleteAll(true)}
                className="text-xs text-gray-400 hover:text-red-600 underline transition-colors"
              >
                Delete All Inventory
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {/* Edit Modal */}
      {isEditing && editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl m-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Edit Item</h3>
                <button
                  onClick={handleCancelEdit}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSaveEdit}>
                {/* Required Fields Section */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 required-field">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="w-full px-4 py-2 border rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all"
                      placeholder="Name"
                      value={editingItem.name}
                      onChange={(e) => setEditingItem(prev => prev ? {...prev, name: e.target.value} : null)}
                      required
                    />
                  </div>

                  <div className="flex gap-4">
                    <div className="w-1/3">
                      <label className="block text-sm font-medium text-gray-700 required-field">
                        Quantity <span className="text-red-500">*</span>
                      </label>
                      <input
                        className="w-full px-4 py-2 border rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all"
                        placeholder="Quantity"
                        type="number"
                        min="0"
                        value={editingItem.quantity}
                        onChange={(e) => setEditingItem(prev => prev ? {...prev, quantity: e.target.value} : null)}
                        required
                      />
                    </div>

                    <div className="w-2/3">
                      <label className="block text-sm font-medium text-gray-700">
                        Unit <span className="text-gray-400">(optional)</span>
                      </label>
                      <AutocompleteInput
                        value={editingItem.unit || ''}
                        onChange={(value) => setEditingItem(prev => prev ? {...prev, unit: value || null} : null)}
                        placeholder="Unit (optional)"
                        items={items}
                        field="unit"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 required-field">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <AutocompleteInput
                      value={editingItem.category}
                      onChange={(value) => setEditingItem(prev => prev ? {...prev, category: value} : null)}
                      placeholder="Category"
                      items={allItems}
                      field="category"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 required-field">
                      Location <span className="text-red-500">*</span>
                    </label>
                    <AutocompleteInput
                      value={editingItem.location}
                      onChange={(value) => setEditingItem(prev => prev ? {...prev, location: value} : null)}
                      placeholder="Location"
                      items={allItems}
                      field="location"
                    />
                  </div>
                </div>

                {/* Optional Fields Section */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Source <span className="text-gray-400">(optional)</span>
                    </label>
                    <input
                      className="w-full px-4 py-2 border rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all"
                      placeholder="Source (optional)"
                      value={editingItem.source || ''}
                      onChange={(e) => setEditingItem(prev => prev ? {...prev, source: e.target.value || null} : null)}
                    />
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Add/Edit Comment
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCommentModal(true)}
                      className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${
                        editingItem?.comment ? 'text-blue-500' : 'text-gray-500'
                      }`}
                    >
                      <MessageSquare className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Bottom buttons container */}
                <div className="flex justify-between items-center mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      handleShowLogs(editingItem.id);
                      setShowLogsModal(true);
                    }}
                    className="bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200 transition-colors flex items-center gap-2"
                  >
                    <ClipboardList className="w-4 h-4" />
                    View History
                  </button>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleDelete(editingItem.id)}
                      className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-6 py-2 text-gray-700 hover:text-gray-900 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}


      {/* Comment Modal */}
      {showCommentModal && (
        <CommentModal
          comment={newItem.comment || ''}
          onChange={(value) => setNewItem({ ...newItem, comment: value })}
          onClose={() => setShowCommentModal(false)}
          onSubmit={() => setShowCommentModal(false)}
          title="Add Comment"
        />
      )}

      {/* Similarity Warning Modal */}
      {similarityWarning.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md m-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-amber-600">⚠️ Similar Items Found</h3>
                <button
                  onClick={() => setSimilarityWarning({ ...similarityWarning, show: false })}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {similarityWarning.similarItems.length > 0 && (
                  <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
                    <h4 className="font-semibold text-amber-800 mb-2">Similar Items:</h4>
                    <ul className="list-disc list-inside text-amber-700 space-y-1">
                      {similarityWarning.similarItems.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {similarityWarning.similarCategories.length > 0 && (
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">Similar Categories:</h4>
                    <ul className="list-disc list-inside text-blue-700 space-y-1">
                      {similarityWarning.similarCategories.map((category, index) => (
                        <li key={index}>{category}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setSimilarityWarning({ ...similarityWarning, show: false })}
                    className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addItem}
                    className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                  >
                    Add Anyway
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logs Modal */}
      {showLogsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg m-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Item History</h3>
                <button
                  onClick={() => setShowLogsModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {logsLoading ? (
                  <div className="p-4 text-center text-gray-700">Loading logs...</div>
                ) : logs.length === 0 ? (
                  <div className="p-4 text-center text-gray-700">No history found</div>
                ) : (
                  <div className="divide-y">
                    {logs.map((log) => (
                      <div key={log.id} className="p-3 text-sm">
                        <div className="flex justify-between text-gray-900 font-medium">
                          <span>{new Date(log.timestamp).toLocaleString()}</span>
                          <span className="text-blue-600">{log.user_email}</span>
                        </div>
                        {log.action_type === 'create' ? (
                          <div className="mt-1 text-green-600 font-medium">Item created</div>
                        ) : (
                          <div className="mt-1 text-gray-800">
                            Changed <span className="font-medium text-blue-600">{log.field_name}</span> from{' '}
                            <span className="font-medium text-red-500">&ldquo;{log.old_value}&rdquo;</span> to{' '}
                            <span className="font-medium text-green-600">&ldquo;{log.new_value}&rdquo;</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Booking Modal */}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md m-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-red-600">⚠️ Delete Entire Inventory</h3>
                <button
                  onClick={() => {
                    setShowDeleteAll(false);
                    setDeleteConfirmation('');
                  }}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded-r-lg">
                  <p className="text-red-700">
                    This action is irreversible. To confirm deletion, please type:
                  </p>
                  <p className="font-mono bg-gray-100 p-2 mt-2 text-sm rounded">
                    {DELETION_PHRASE}
                  </p>
                </div>

                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="Type confirmation phrase here"
                  className="w-full px-4 py-2 border rounded-lg text-gray-700 focus:ring-2 focus:ring-red-200 focus:border-red-500 transition-all"
                />

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowDeleteAll(false);
                      setDeleteConfirmation('');
                    }}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAllInventory}
                    disabled={deleteConfirmation !== DELETION_PHRASE}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Delete All Items
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Comment Modal for editing */}
      {showCommentModal && editingItem && (
        <CommentModal
          comment={editingItem.comment || ''}
          onChange={(value) => setEditingItem(prev => prev ? {...prev, comment: value} : null)}
          onClose={() => setShowCommentModal(false)}
          onSubmit={() => setShowCommentModal(false)}
          title="Edit Comment"
        />
      )}

      {/* Activity Dashboard Modal */}
      {showActivityDashboard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-7xl max-h-[90vh] m-4 flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-xl font-semibold text-gray-900">User Activity Dashboard</h3>
              <button
                onClick={() => setShowActivityDashboard(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pb-8">
              <UserActivityDashboard />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventorySystem;