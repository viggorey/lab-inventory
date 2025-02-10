import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar, X } from 'lucide-react';

interface Booking {
  id: string;
  item_id: string;
  quantity: number;
  start_datetime: string;
  end_datetime: string;
  status: string;
  item: {
    name: string;
  }
}

const BookingsList = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserBookings();
  }, []);

  const fetchUserBookings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('inventory_bookings')
        .select(`
          *,
          item:inventory(name)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('start_datetime', { ascending: true });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;

    try {
      const { error } = await supabase
        .from('inventory_bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId);

      if (error) throw error;
      await fetchUserBookings();
    } catch (error) {
      console.error('Error cancelling booking:', error);
      alert('Failed to cancel booking');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-blue-500" />
        <h2 className="text-xl font-bold text-gray-900">Your Bookings</h2>
      </div>

      {loading ? (
        <div className="text-center py-4 text-gray-900">Loading bookings...</div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-4 text-gray-900">No active bookings</div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <div key={booking.id} className="border rounded-lg p-4 flex justify-between items-center">
              <div>
                <h3 className="font-semibold">{booking.item.name}</h3>
                <p className="text-sm text-gray-600">
                  Quantity: {booking.quantity}
                </p>
                <p className="text-sm text-gray-600">
                  {new Date(booking.start_datetime).toLocaleString()} - {new Date(booking.end_datetime).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => handleCancelBooking(booking.id)}
                className="text-red-600 hover:text-red-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BookingsList;