'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { UserCheck, UserX, User, ChevronDown, ChevronUp, Loader } from 'lucide-react';


interface UserProfile {
  id: string;
  email: string;
  role: string;
  full_name: string | null;
  created_at: string;
}

const UserManagement = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null); 


  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
  
      if (error) {
        console.error('Error fetching profiles:', error);
        setError('Failed to load users. Please try refreshing the page.');
        return;
      }
  
      setUsers(profiles || []);
      setError(null); // Clear any existing errors
    } catch (error) {
      console.error('Error:', error);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };
  

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (profileError) {
        console.error('Profile update error:', profileError);
        setError('Failed to update user role: ' + profileError.message);
        return;
      }

      // Get user email for notification
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single();

      if (userError || !userData?.email) {
        console.error('Error fetching user email:', userError);
        throw new Error('Could not fetch user email');
      }
  
      // Only attempt to send email if URL is available
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-status-email`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
              },
              body: JSON.stringify({
                email: userData.email,
                type: newRole === 'user' ? 'approved' : 'denied'
              })
            }
          );
  
          if (!response.ok) {
            console.warn('Email sending failed:', await response.text());
          }
        } catch (emailError) {
          console.warn('Email sending failed:', emailError);
        }
      }
  
      await fetchUsers();
      
      // Set success message based on the action
      setSuccessMessage(
        newRole === 'user' 
          ? 'User approved successfully!' 
          : newRole === 'denied'
          ? 'User denied successfully!'
          : 'User role updated successfully!'
      );
      
    } catch (error) {
      console.error('Error:', error);
      setError('Failed to update user role. Please try again.');
    } finally {
      setLoading(false);
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
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-800 rounded-full transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>
        </div>
        <button
          onClick={fetchUsers}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center gap-2"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Updating...
            </>
          ) : (
            'Refresh Users'
          )}
        </button>
      </div>
  
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold hover:text-red-900">×</button>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4 flex justify-between items-center">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="font-bold hover:text-green-900">×</button>
        </div>
      )}
  
      <div className={`transition-all duration-300 ease-in-out ${
        isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
      }`}>
        {loading ? (
          <div className="text-center py-8">
            <Loader className="w-8 h-8 animate-spin mx-auto mb-2" />
            <p className="text-gray-600">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-gray-600">
            No users found
          </div>
        ) : (
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
                              className="flex items-center gap-1 bg-red-400/80 text-white px-3 py-1 rounded hover:bg-red-500/80"
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
        )}
      </div>
    </div>
  );
};

export default UserManagement;