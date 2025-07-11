'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Download, User, Activity, Edit, Plus, BookOpen } from 'lucide-react';

interface UserActivity {
  id: string;
  user_email: string;
  action_type: 'create' | 'edit' | 'delete';
  field_name?: string;
  old_value?: string;
  new_value?: string;
  timestamp: string;
  item_id?: string;
  item_name?: string;
  item_category?: string;
  item_location?: string;
}

interface UserBooking {
  id: string;
  user_id: string;
  user_email: string;
  item_id: string;
  item_name: string;
  start_datetime: string;
  end_datetime: string;
  status: string;
  purpose?: string;
  created_at: string;
}

interface UserProfile {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

interface UserStats {
  email: string;
  totalActions: number;
  creates: number;
  edits: number;
  deletes: number;
  bookings: number;
  lastActivity: string;
}

const UserActivityDashboard = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userActivities, setUserActivities] = useState<UserActivity[]>([]);
  const [userBookings, setUserBookings] = useState<UserBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('30'); // days
  const [actionFilter, setActionFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUserStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter]);

  const fetchUserStats = async () => {
    try {
      setLoading(true);

      // Get all users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Get activity logs for the date range
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(dateFilter));
      
      const { data: logs, error: logsError } = await supabase
        .from('inventory_logs')
        .select(`
          *,
          item:inventory(name, category, location)
        `)
        .gte('timestamp', startDate.toISOString())
        .order('timestamp', { ascending: false });

      if (logsError) throw logsError;

      // Get bookings for the date range
      const { data: bookings, error: bookingsError } = await supabase
        .from('inventory_bookings')
        .select(`
          *,
          item:inventory(name)
        `)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (bookingsError) throw bookingsError;

      // Calculate user statistics
      const stats: { [key: string]: UserStats } = {};

      // Initialize stats for all users
      profiles?.forEach(profile => {
        stats[profile.email] = {
          email: profile.email,
          totalActions: 0,
          creates: 0,
          edits: 0,
          deletes: 0,
          bookings: 0,
          lastActivity: profile.created_at
        };
      });

      // Count activities
      logs?.forEach(log => {
        if (stats[log.user_email]) {
          stats[log.user_email].totalActions++;
          if (log.action_type === 'create') stats[log.user_email].creates++;
          else if (log.action_type === 'edit') stats[log.user_email].edits++;
          else if (log.action_type === 'delete') stats[log.user_email].deletes++;
          if (new Date(log.timestamp) > new Date(stats[log.user_email].lastActivity)) {
            stats[log.user_email].lastActivity = log.timestamp;
          }
        }
      });

      // Count bookings
      bookings?.forEach(booking => {
        const userEmail = profiles?.find(p => p.id === booking.user_id)?.email;
        if (userEmail && stats[userEmail]) {
          stats[userEmail].bookings++;
          stats[userEmail].totalActions++;
          if (new Date(booking.created_at) > new Date(stats[userEmail].lastActivity)) {
            stats[userEmail].lastActivity = booking.created_at;
          }
        }
      });

      setUsers(profiles || []);
      setUserStats(Object.values(stats).sort((a, b) => b.totalActions - a.totalActions));

    } catch (error) {
      console.error('Error fetching user stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async (userEmail: string) => {
    try {
      setSelectedUser(userEmail);

      // Get user's activities
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(dateFilter));

      const { data: activities, error: activitiesError } = await supabase
        .from('inventory_logs')
        .select(`
          *,
          item:inventory(name, category, location)
        `)
        .eq('user_email', userEmail)
        .gte('timestamp', startDate.toISOString())
        .order('timestamp', { ascending: false });

      if (activitiesError) throw activitiesError;

      // Get user's bookings
      const user = users.find(u => u.email === userEmail);
      if (user) {
        const { data: bookings, error: bookingsError } = await supabase
          .from('inventory_bookings')
          .select(`
            *,
            item:inventory(name)
          `)
          .eq('user_id', user.id)
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false });

        if (bookingsError) throw bookingsError;
        setUserBookings(bookings || []);
      }

      setUserActivities(activities || []);

    } catch (error) {
      console.error('Error fetching user details:', error);
    }
  };

  const filteredActivities = userActivities.filter(activity => {
    if (actionFilter !== 'all' && activity.action_type !== actionFilter) return false;
    if (searchTerm && !activity.item_name?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const exportUserReport = (userEmail: string) => {
    const user = userStats.find(u => u.email === userEmail);
    if (!user) return;

    const activities = userActivities.filter(a => a.user_email === userEmail);
    const bookings = userBookings;

    let csvContent = `User Activity Report for ${userEmail}\n`;
    csvContent += `Generated on: ${new Date().toLocaleString()}\n\n`;
    csvContent += `Total Actions: ${user.totalActions}\n`;
    csvContent += `Creates: ${user.creates}\n`;
    csvContent += `Edits: ${user.edits}\n`;
    csvContent += `Deletes: ${user.deletes}\n`;
    csvContent += `Bookings: ${user.bookings}\n\n`;

    csvContent += `Activity Details:\n`;
    csvContent += `Timestamp,Action,Item,Field,Old Value,New Value\n`;
    
    activities.forEach(activity => {
      csvContent += `${new Date(activity.timestamp).toLocaleString()},${activity.action_type},${activity.item_name || 'Unknown'},${activity.field_name || ''},"${activity.old_value || ''}","${activity.new_value || ''}"\n`;
    });

    csvContent += `\nBooking Details:\n`;
    csvContent += `Created,Start Date,End Date,Item,Status,Purpose\n`;
    
    bookings.forEach(booking => {
      csvContent += `${new Date(booking.created_at).toLocaleString()},${new Date(booking.start_datetime).toLocaleString()},${new Date(booking.end_datetime).toLocaleString()},${booking.item_name || 'Unknown'},${booking.status},"${booking.purpose || ''}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `user_activity_${userEmail.replace('@', '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4 text-center">Loading user activity data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Activity className="w-8 h-8 text-blue-600" />
                User Activity Dashboard
              </h1>
              <p className="text-gray-600 mt-2">Track all user edits, bookings, and activities</p>
            </div>
            <div className="flex gap-3">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last year</option>
              </select>
            </div>
          </div>

          {/* User Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-600">Total Users</span>
              </div>
              <p className="text-2xl font-bold text-blue-900">{users.length}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-green-600">Total Creates</span>
              </div>
              <p className="text-2xl font-bold text-green-900">
                {userStats.reduce((sum, user) => sum + user.creates, 0)}
              </p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-600">Total Edits</span>
              </div>
              <p className="text-2xl font-bold text-yellow-900">
                {userStats.reduce((sum, user) => sum + user.edits, 0)}
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-medium text-purple-600">Total Bookings</span>
              </div>
              <p className="text-2xl font-bold text-purple-900">
                {userStats.reduce((sum, user) => sum + user.bookings, 0)}
              </p>
            </div>
          </div>

          {/* User List */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">User Activity Summary</h2>
            <div className="space-y-3">
              {userStats.map((user) => (
                <div
                  key={user.email}
                  className={`bg-white rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                    selectedUser === user.email ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => fetchUserDetails(user.email)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{user.email}</h3>
                      <p className="text-sm text-gray-600">
                        Last activity: {new Date(user.lastActivity).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-lg font-bold text-blue-600">{user.totalActions}</p>
                        <p className="text-xs text-gray-500">Total</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-green-600">{user.creates}</p>
                        <p className="text-xs text-gray-500">Creates</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-yellow-600">{user.edits}</p>
                        <p className="text-xs text-gray-500">Edits</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-purple-600">{user.bookings}</p>
                        <p className="text-xs text-gray-500">Bookings</p>
                      </div>
                      {selectedUser === user.email && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            exportUserReport(user.email);
                          }}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* User Details */}
        {selectedUser && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Activity Details for {selectedUser}</h2>
                <p className="text-gray-600">Detailed timeline of all activities</p>
              </div>
              <button
                onClick={() => exportUserReport(selectedUser)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export Report
              </button>
            </div>

            {/* Filters */}
            <div className="flex gap-4 mb-6">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
              >
                <option value="all">All Actions</option>
                <option value="create">Creates</option>
                <option value="edit">Edits</option>
                <option value="delete">Deletes</option>
              </select>
            </div>

            {/* Activity Timeline */}
            <div className="space-y-4">
              {filteredActivities.map((activity) => (
                <div key={activity.id} className="border-l-4 border-blue-500 pl-4 py-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">
                          {new Date(activity.timestamp).toLocaleString()}
                        </span>
                        {activity.action_type === 'create' && (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">Created</span>
                        )}
                        {activity.action_type === 'edit' && (
                          <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">Edited</span>
                        )}
                        {activity.action_type === 'delete' && (
                          <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">Deleted</span>
                        )}
                      </div>
                      <p className="font-medium text-gray-900">
                        {activity.item_name || 'Unknown Item'}
                      </p>
                      {activity.action_type === 'edit' && (
                        <p className="text-sm text-gray-600">
                          Changed <span className="font-medium">{activity.field_name}</span> from{' '}
                          <span className="text-red-600">&quot;{activity.old_value}&quot;</span> to{' '}
                          <span className="text-green-600">&quot;{activity.new_value}&quot;</span>
                        </p>
                      )}
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      <p>{activity.item_category}</p>
                      <p>{activity.item_location}</p>
                    </div>
                  </div>
                </div>
              ))}

              {userBookings.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Bookings</h3>
                  <div className="space-y-3">
                    {userBookings.map((booking) => (
                      <div key={booking.id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{booking.item_name}</p>
                            <p className="text-sm text-gray-600">
                              {new Date(booking.start_datetime).toLocaleString()} - {new Date(booking.end_datetime).toLocaleString()}
                            </p>
                            <p className="text-sm text-gray-600">Purpose: {booking.purpose || 'No purpose specified'}</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs ${
                            booking.status === 'active' ? 'bg-green-100 text-green-800' :
                            booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {booking.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredActivities.length === 0 && userBookings.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No activities found for the selected filters.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserActivityDashboard; 