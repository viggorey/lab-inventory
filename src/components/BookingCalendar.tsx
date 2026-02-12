'use client';

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

interface BookingCalendarProps {
  events: {
    title: string;
    start: string;
    end: string;
    backgroundColor: string;
    extendedProps: Record<string, unknown>;
  }[];
  onEventClick: (info: { el: HTMLElement; event: { startStr: string; endStr: string; extendedProps: Record<string, unknown> } }) => void;
}

const BookingCalendar: React.FC<BookingCalendarProps> = ({ events, onEventClick }) => {
  return (
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
      eventClick={onEventClick}
    />
  );
};

export default BookingCalendar;
