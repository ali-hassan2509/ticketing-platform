import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getBookingTicket } from '../services/api'
import { format } from 'date-fns'

export default function TicketView({ user }) {
  const { bookingId } = useParams()
  const [booking, setBooking] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    getBookingTicket(bookingId)
      .then(setBooking)
      .catch(() => setError(true))
  }, [bookingId])

  if (error) return <div className="pt-20 text-center text-red-400">Failed to load ticket.</div>
  if (!booking) return <div className="pt-20 text-center text-gray-400"><span className="animate-pulse">Generating your ticket...</span></div>

  return (
    <div className="min-h-screen pt-20 px-4 bg-gray-950 pb-12 flex flex-col items-center">
      
      {/* Utility Bar (Hidden when printing) */}
      <div className="w-full max-w-2xl flex justify-between mb-6 print:hidden">
        <Link to="/dashboard" className="text-gray-400 hover:text-white transition-colors">← Back to Dashboard</Link>
        <button onClick={() => window.print()} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
          🖨️ Print Ticket
        </button>
      </div>

      {/* Printable Ticket Container */}
      <div className="w-full max-w-2xl bg-white rounded-2xl overflow-hidden shadow-2xl print:shadow-none print:w-[100%]">
        
        {/* Header */}
        <div className="bg-violet-600 text-white p-6 md:p-8 flex justify-between items-center print:bg-gray-900">
          <div>
            <p className="text-violet-200 text-sm font-bold tracking-widest uppercase mb-1">Official E-Ticket</p>
            <h1 className="text-2xl md:text-3xl font-bold">{booking.event_name}</h1>
          </div>
          <div className="text-right hidden md:block">
            <span className="text-5xl">🎟️</span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 md:p-8 text-gray-900 border-b-2 border-dashed border-gray-200 relative">
          {/* Half-circle cutouts for ticket effect */}
          <div className="absolute -left-4 bottom-[-16px] w-8 h-8 bg-gray-950 rounded-full print:hidden"></div>
          <div className="absolute -right-4 bottom-[-16px] w-8 h-8 bg-gray-950 rounded-full print:hidden"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wide mb-1">Date & Time</p>
              <p className="font-semibold text-lg">{format(new Date(booking.event_date), 'EEEE, MMM d, yyyy')}</p>
              <p className="text-gray-600">{format(new Date(booking.event_date), 'h:mm a')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wide mb-1">Venue</p>
              <p className="font-semibold text-lg">{booking.venue_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wide mb-1">Purchaser</p>
              <p className="font-semibold">{user?.name}</p>
              <p className="text-gray-600 text-sm">{user?.email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wide mb-1">Order Reference</p>
              <p className="font-mono font-bold text-lg text-violet-600">{booking.booking_reference}</p>
            </div>
          </div>

          <p className="text-xs text-gray-500 uppercase font-bold tracking-wide mb-3">Your Seats ({booking.seats.length})</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {booking.seats.map(seat => (
              <div key={seat.id} className="bg-gray-100 rounded-lg p-3 border border-gray-200">
                <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">{seat.ticket_type}</p>
                <p className="text-xl font-bold">R:{seat.row} S:{seat.number}</p>
                {seat.section && <p className="text-xs text-gray-600 mt-1">{seat.section}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Footer & Barcode (Simulated) */}
        <div className="p-6 md:p-8 bg-gray-50 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-sm text-gray-500 max-w-sm text-center md:text-left">
            <p>Please present this barcode at the venue entrance. Valid ID matching the purchaser name may be required.</p>
          </div>
          <div className="flex flex-col items-center">
            {/* CSS Simulated Barcode */}
            <div className="flex h-16 items-center gap-[2px] opacity-80 mix-blend-multiply">
              {[...Array(40)].map((_, i) => (
                <div key={i} className="bg-black h-full" style={{ width: `${Math.random() * 4 + 1}px` }}></div>
              ))}
            </div>
            <p className="text-xs font-mono mt-2 tracking-widest text-gray-500">{booking.booking_reference}</p>
          </div>
        </div>

      </div>
    </div>
  )
}