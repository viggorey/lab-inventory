import React, { useState, useEffect, useCallback } from 'react';
import { X, Calendar, Clock, Package, Loader, AlertCircle } from 'lucide-react';
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
  const [validationMessage, setValidationMessage] = useState<string>('');

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

  const validateBooking = (
    startDate: Date | null,
    endDate: Date | null,
    requestedQuantity: number
  ): { valid: boolean; message: string } => {
    const now = new Date();
    if (!startDate || !endDate) {
      return { valid: false, message: "Please select both start and end times" };
    }
    
    if (startDate < now) {
      return { valid: false, message: "Cannot book dates in the past" };
    }

    if (endDate <= startDate) {
      return { valid: false, message: "End time must be after start time" };
    }

    if (requestedQuantity <= 0) {
      return { valid: false, message: "Please select a valid quantity" };
    }

    const overlappingBookings = existingBookings.filter(booking => {
      const bookingStart = new Date(booking.start_datetime);
      const bookingEnd = new Date(booking.end_datetime);
      return (startDate <= bookingEnd && endDate >= bookingStart);
    });

    const totalBookedQuantity = overlappingBookings.reduce((sum, booking) => sum + booking.quantity, 0);
    const availableQuantity = parseInt(item.quantity);

    if (totalBookedQuantity + requestedQuantity > availableQuantity) {
      return {
        valid: false,
        message: `Only ${availableQuantity - totalBookedQuantity} items available for this time period`
      };
    }

    return { valid: true, message: "" };
  };

  const handleBook = async () => {
    const validation = validateBooking(startDate, endDate, quantity);
    setValidationMessage(validation.message);
    
    if (!validation.valid || !startDate || !endDate) {
      return;
    }
  
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');
  
      // Create the booking
      const { data: bookingData, error: bookingError } = await supabase
        .from('inventory_bookings')
        .insert({
          item_id: item.id,
          user_id: user.id,
          user_email: user.email,
          quantity,
          start_datetime: startDate.toISOString(),
          end_datetime: endDate.toISOString(),
          status: 'active'
        })
        .select()
        .single();
  
      if (bookingError) throw bookingError;
      
      onBookingComplete();
      onClose();
    } catch (error) {
      console.error('Error booking item:', error);
      setValidationMessage('Failed to book item. Please try again.');
    } finally {
      setLoading(false);
    }
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-4xl m-4">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Book {item.name}</h3>
                <p className="text-sm text-gray-500">Available quantity: {item.quantity}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Quantity Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Quantity
              </label>
              <div className="relative">
                <Package className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="number"
                  min="1"
                  max={parseInt(item.quantity)}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value))}
                  className="pl-10 pr-4 py-2 w-full border rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            {/* Start Date/Time */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Start Date & Time
              </label>
              <div className="relative">
                <Clock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="datetime-local"
                  value={startDate?.toISOString().slice(0, 16) || ''}
                  onChange={(e) => setStartDate(new Date(e.target.value))}
                  min={new Date().toISOString().slice(0, 16)}
                  className="pl-10 pr-4 py-2 w-full border rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            {/* End Date/Time */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                End Date & Time
              </label>
              <div className="relative">
                <Clock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="datetime-local"
                  value={endDate?.toISOString().slice(0, 16) || ''}
                  onChange={(e) => setEndDate(new Date(e.target.value))}
                  min={startDate ? startDate.toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)}
                  className="pl-10 pr-4 py-2 w-full border rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Validation Message */}
          {validationMessage && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{validationMessage}</p>
            </div>
          )}

          {/* Calendar */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
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
                slotMinTime="06:00:00"
                slotMaxTime="22:00:00"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleBook}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Booking...
                </>
              ) : (
                'Book Item'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingModal;