'use client';

import React, { useState, useEffect } from 'react';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { UserCheck, UserX, User } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  email: string;
  role: string;
  full_name: string | null;
  created_at: string;
}

const UserManagement = () => {  // Add this line to define the component
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      setError(null);
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
  
      if (error) {
        console.error('Error fetching profiles:', error);
        setError('Failed to load users. Please try refreshing the page.');
        return;
      }
  
      console.log('Fetched profiles:', profiles);
      setUsers(profiles || []);
    } catch (error) {
      console.error('Error:', error);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  const syncMissingProfiles = async () => {
    try {
      if (!supabaseAdmin) {
        throw new Error('Admin client not configured');
      }
      // First get all auth users using admin client
      const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers();
      if (authError) throw authError;
      
      // Get existing profiles
      const { data: existingProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id');
      if (profilesError) throw profilesError;

      // Find users without profiles
      const existingProfileIds = new Set(existingProfiles?.map(p => p.id));
      const usersWithoutProfiles = users?.filter((user: SupabaseUser) => !existingProfileIds.has(user.id));

      // Create missing profiles
      if (usersWithoutProfiles?.length) {
        const { error: insertError } = await supabase
          .from('profiles')
          .insert(
            usersWithoutProfiles.map((user: SupabaseUser) => ({
              id: user.id,
              email: user.email,
              role: 'pending',
              created_at: new Date().toISOString()
            }))
          );
        if (insertError) throw insertError;
      }

      // Refresh the users list
      await fetchUsers();
    } catch (error) {
        console.error('Error syncing profiles - Full error:', error);
        if (error instanceof Error) {
          setError(`Failed to sync user profiles: ${error.message}`);
        } else {
          setError('Failed to sync user profiles');
        }
      }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);
  
      if (error) {
        console.error('Error updating role:', error);
        setError('Failed to update user role');
        return;
      }
  
      await fetchUsers();
    } catch (error) {
      console.error('Error:', error);
      setError('Failed to update user role');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  if (loading) {
    return <div className="text-center p-4">Loading users...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
        <button
          onClick={syncMissingProfiles}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Sync Users
        </button>
      </div>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border p-2 bg-gray-50 text-gray-900 font-semibold">Email</th>
              <th className="border p-2 bg-gray-50 text-gray-900 font-semibold">Role</th>
              <th className="border p-2 bg-gray-50 text-gray-900 font-semibold">Join Date</th>
              <th className="border p-2 bg-gray-50 text-gray-900 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td className="border p-2 text-gray-900">{user.email}</td>
                <td className="border p-2">
                  <span
                    className={`inline-block px-2 py-1 rounded ${
                      user.role === 'admin'
                        ? 'bg-purple-100 text-purple-800'
                        : user.role === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="border p-2 text-gray-900">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="border p-2">
                  <div className="flex gap-2 justify-center">
                    {user.role === 'pending' && (
                      <>
                        <button
                          onClick={() => updateUserRole(user.id, 'user')}
                          className="flex items-center gap-1 bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                        >
                          <UserCheck className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => updateUserRole(user.id, 'denied')}
                          className="lex items-center gap-1 bg-red-400/80 text-white px-3 py-1 rounded hover:bg-red-500/80"
                        >
                          <UserX className="w-4 h-4" />
                          Deny
                        </button>
                      </>
                    )}
                    {user.role === 'user' && (
                      <button
                        onClick={() => updateUserRole(user.id, 'admin')}
                        className="flex items-center gap-1 bg-purple-500 text-white px-3 py-1 rounded hover:bg-purple-600"
                      >
                        <User className="w-4 h-4" />
                        Make Admin
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagement;