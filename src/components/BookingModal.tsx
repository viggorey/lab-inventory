import React, { useState, useEffect, useCallback } from 'react';
import { X, Calendar, Clock, Package, Loader, AlertCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';

const BookingCalendar = dynamic(() => import('@/components/BookingCalendar'), {
  ssr: false,
  loading: () => (
    <div className="h-56 sm:h-96 flex items-center justify-center text-gray-500">
      <Loader className="w-6 h-6 animate-spin mr-2" />
      Loading calendar...
    </div>
  ),
});

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
  purpose?: string;
}

interface CalendarEvent {
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  extendedProps: {
    isCurrentUser: boolean;
    bookingId: string;
    userEmail: string;
    quantity: number;
    purpose?: string;
  };
}

const calendarStyles = `
  .fc {
    --fc-border-color: #CBD5E1;
    --fc-neutral-text-color: #1F2937;
    --fc-neutral-bg-color: #F8FAFC;
    --fc-today-bg-color: #EFF6FF;
    --fc-event-bg-color: #3B82F6;
    --fc-event-border-color: #2563EB;
  }

  .fc-daygrid-day-number,
  .fc-col-header-cell-cushion,
  .fc-timegrid-axis-cushion,
  .fc-timegrid-slot-label-cushion,
  .fc-toolbar-title {
    color: #1F2937;
    font-weight: 500;
  }

  .fc td, .fc th {
    border-color: #CBD5E1;
  }
`;

const BookingModal: React.FC<BookingModalProps> = ({ item, onClose, onBookingComplete }) => {
  const [quantity, setQuantity] = useState(1);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [existingBookings, setExistingBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string>('');
  const [comment, setComment] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<{ x: number; y: number; userEmail: string; quantity: number; purpose?: string; start: string; end: string } | null>(null);

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

    const availableInitialQuantity = parseInt(item.quantity);
    if (availableInitialQuantity === 0) {
      return { valid: false, message: "This item is currently out of stock" };
    }

    const overlappingBookings = existingBookings.filter(booking => {
      const bookingStart = new Date(booking.start_datetime);
      const bookingEnd = new Date(booking.end_datetime);
      return (startDate <= bookingEnd && endDate >= bookingStart);
    });

    let maxBookedQuantity = 0;
    overlappingBookings.forEach(booking => {
      maxBookedQuantity = Math.max(maxBookedQuantity, booking.quantity);
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const availableQuantity = parseInt(item.quantity);
    const remainingQuantity = availableInitialQuantity - maxBookedQuantity;

    if (requestedQuantity > remainingQuantity) {
      return {
        valid: false,
        message: `Only ${remainingQuantity} items available for this time period`
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

      const { error: bookingError } = await supabase
        .from('inventory_bookings')
        .insert({
          item_id: item.id,
          user_id: user.id,
          user_email: user.email,
          quantity,
          start_datetime: startDate.toISOString(),
          end_datetime: endDate.toISOString(),
          status: 'active',
          purpose: comment.trim() || null
        });

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
      bookingId: booking.id,
      userEmail: booking.user_email,
      quantity: booking.quantity,
      purpose: booking.purpose
    }
  }));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
      <style>{calendarStyles}</style>
      {/* Full-screen on mobile, constrained modal on sm+ */}
      <div className="bg-white w-full h-full sm:h-auto sm:rounded-xl sm:shadow-lg sm:max-w-4xl sm:m-4 flex flex-col">

        {/* Header — sticky */}
        <div className="flex-shrink-0 p-4 md:p-6 border-b border-gray-100">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Calendar className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg md:text-xl font-bold text-gray-900">Book {item.name}</h3>
                <p className="text-sm text-gray-500">Available quantity: {item.quantity}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6">
            {/* Quantity */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Quantity</label>
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
              <label className="block text-sm font-medium text-gray-700">Start Date & Time</label>
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
              <label className="block text-sm font-medium text-gray-700">End Date & Time</label>
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

          {/* Comment */}
          <div className="mb-6 space-y-2">
            <label className="block text-sm font-medium text-gray-700">Comment (optional)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. Item will be in Room 204"
              rows={2}
              className="w-full px-4 py-2 border rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all resize-none"
            />
          </div>

          {/* Validation Message */}
          {validationMessage && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{validationMessage}</p>
            </div>
          )}

          {/* Calendar */}
          <div className="bg-gray-50 rounded-lg p-3 md:p-4 mb-4">
            <div className="h-56 sm:h-96">
              <BookingCalendar
                events={events}
                onEventClick={(info) => {
                  const props = info.event.extendedProps;
                  setSelectedEvent({
                    x: 0,
                    y: 0,
                    userEmail: props.userEmail as string,
                    quantity: props.quantity as number,
                    purpose: props.purpose as string | undefined,
                    start: info.event.startStr,
                    end: info.event.endStr,
                  });
                }}
              />
            </div>
          </div>

          {/* Booking Detail Popover */}
          {selectedEvent && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setSelectedEvent(null)}>
              <div
                className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-72 mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-gray-900 text-sm">Booking Details</h4>
                  <button onClick={() => setSelectedEvent(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="text-gray-600"><span className="font-medium text-gray-700">Booked by:</span> {selectedEvent.userEmail}</p>
                  <p className="text-gray-600"><span className="font-medium text-gray-700">Quantity:</span> {selectedEvent.quantity}</p>
                  <p className="text-gray-600"><span className="font-medium text-gray-700">From:</span> {new Date(selectedEvent.start).toLocaleString()}</p>
                  <p className="text-gray-600"><span className="font-medium text-gray-700">To:</span> {new Date(selectedEvent.end).toLocaleString()}</p>
                  {selectedEvent.purpose && (
                    <p className="text-gray-600 mt-2 pt-2 border-t border-gray-100">
                      <span className="font-medium text-gray-700">Comment:</span>{' '}
                      <span className="italic">{selectedEvent.purpose}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer — sticky, buttons full-width on mobile */}
        <div className="flex-shrink-0 p-4 md:p-6 border-t border-gray-100 bg-white flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleBook}
            disabled={loading}
            className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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
  );
};

export default BookingModal;
