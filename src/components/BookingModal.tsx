import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { supabase } from '@/lib/supabase';

interface BookingModalProps {
  item: {
    id: string;
    name: string;
    quantity: string;
  };
  onClose: () => void;
  onBookingComplete: () => void;
}

interface Booking {
  id: string;
  start_datetime: string;
  end_datetime: string;
  quantity: number;
  user_email: string;
}

interface CalendarEvent {
    title: string;
    start: string;
    end: string;
    backgroundColor: string;
    extendedProps: {
      isCurrentUser: boolean;
      bookingId: string;
    };
  }

  const BookingModal: React.FC<BookingModalProps> = ({ item, onClose, onBookingComplete }) => {
    const [quantity, setQuantity] = useState(1);
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);
    const [existingBookings, setExistingBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  
    // Define fetchExistingBookings OUTSIDE of useEffect
    const fetchExistingBookings = useCallback(async () => {
      const { data, error } = await supabase
        .from('inventory_bookings')
        .select('*')
        .eq('item_id', item.id)
        .eq('status', 'active');
  
      if (error) {
        console.error('Error fetching bookings:', error);
        return;
      }
  
      setExistingBookings(data || []);
    }, [item.id]);
  
    useEffect(() => {
      fetchExistingBookings();
      const getCurrentUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          setCurrentUserEmail(user.email);
        }
      };
      getCurrentUser();
    }, [fetchExistingBookings]);

  const handleBook = async () => {
    // Validate the booking
    const validation = validateBooking(startDate, endDate, quantity);
    if (!validation.valid) {
      alert(validation.message);
      return;
    }
  
    if (!startDate || !endDate) { 
      alert("Start and end dates are required.");
      return;
    }
  
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');
  
      const { error: bookingError } = await supabase
        .from('inventory_bookings')
        .insert({
          item_id: item.id,
          user_id: user.id,
          user_email: user.email,
          quantity,
          start_datetime: startDate.toISOString(),
          end_datetime: endDate.toISOString(),
          status: 'active'
        });
  
      if (bookingError) throw bookingError;
  
      onBookingComplete();
      onClose();
    } catch (error) {
      console.error('Error booking item:', error);
      alert('Failed to book item. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const validateBooking = (
    startDate: Date | null, 
    endDate: Date | null, 
    requestedQuantity: number
  ): { valid: boolean; message: string } => {
    // Check for past dates
    const now = new Date();
    if (startDate && startDate < now) {
      return {
        valid: false,
        message: "Cannot book dates in the past"
      };
    }
  
    if (!startDate || !endDate || requestedQuantity <= 0) {
      return {
        valid: false,
        message: "Please fill in all fields"
      };
    }
  
    // Check for overlapping bookings and total quantity
    const overlappingBookings = existingBookings.filter(booking => {
      const bookingStart = new Date(booking.start_datetime);
      const bookingEnd = new Date(booking.end_datetime);
      return (
        (startDate <= bookingEnd && endDate >= bookingStart)
      );
    });
  
    // Calculate total booked quantity during the overlapping period
    const totalBookedQuantity = overlappingBookings.reduce((sum, booking) => sum + booking.quantity, 0);
    const availableQuantity = parseInt(item.quantity);
  
    if (totalBookedQuantity + requestedQuantity > availableQuantity) {
      return {
        valid: false,
        message: `Cannot book ${requestedQuantity} items. Only ${availableQuantity - totalBookedQuantity} available for this time period.`
      };
    }
  
    return { valid: true, message: "" };
  };

  const events: CalendarEvent[] = existingBookings.map(booking => ({
    title: `Booked: ${booking.quantity} by ${booking.user_email}`,
    start: booking.start_datetime,
    end: booking.end_datetime,
    backgroundColor: booking.user_email === currentUserEmail ? '#059669' : '#4338ca',
    extendedProps: {
      isCurrentUser: booking.user_email === currentUserEmail,
      bookingId: booking.id
    }
  }));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg w-full max-w-4xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Book {item.name}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity (Available: {item.quantity})
              </label>
              <input
                type="number"
                min="1"
                max={parseInt(item.quantity)}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value))}
                className="px-3 py-2 border rounded w-full"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date & Time
              </label>
              <input
                type="datetime-local"
                value={startDate?.toISOString().slice(0, 16) || ''}
                onChange={(e) => setStartDate(new Date(e.target.value))}
                min={new Date().toISOString().slice(0, 16)}
                className="px-3 py-2 border rounded w-full"
                />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date & Time
              </label>
              <input
                type="datetime-local"
                value={endDate?.toISOString().slice(0, 16) || ''}
                onChange={(e) => setEndDate(new Date(e.target.value))}
                min={startDate ? startDate.toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)}
                className="px-3 py-2 border rounded w-full"
                />
            </div>
          </div>

          <div className="h-96">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
              }}
              events={events}
              height="100%"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleBook}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Booking...' : 'Book Item'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingModal;