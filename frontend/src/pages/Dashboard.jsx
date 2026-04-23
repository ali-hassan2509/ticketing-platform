import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMyBookings, cancelBooking } from '../services/api'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

export default function Dashboard({ user }) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchBookings = () => {
    setLoading(true)
    getMyBookings().then(setBookings).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => {
    if (user) fetchBookings()
  }, [user])

  const handleCancel = async (id, ref) => {
    if (!window.confirm(`Are you sure you want to cancel booking ${ref}? This cannot be undone and your seats will be released immediately.`)) return
    
    try {
      const res = await cancelBooking(id)
      toast.success(`Booking Cancelled. $${res.refund_amount} refunded.`)
      fetchBookings() // Refresh
    } catch (err) {
      toast.error('Failed to cancel booking')
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Sign in to view your tickets</p>
          <a href="/auth/google/login" className="px-6 py-3 bg-violet-600 text-white rounded-lg font-semibold">Sign in with Google</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-20 px-4 max-w-4xl mx-auto pb-12">
      <div className="mb-10 flex items-center gap-4">
        {user.picture && <img src={user.picture} alt={user.name} className="w-16 h-16 rounded-full border-2 border-violet-500 shadow-lg" />}
        <div>
          <h1 className="text-3xl font-bold text-white">{user.name}</h1>
          <p className="text-gray-400">{user.email}</p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-white mb-6">My Tickets & Bookings</h2>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-900 rounded-xl animate-pulse" />)}
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-20 bg-gray-900 border border-gray-800 rounded-2xl">
          <p className="text-5xl mb-4">🎫</p>
          <p className="text-gray-400 mb-4">You don't have any bookings yet.</p>
          <Link to="/" className="text-violet-400 font-semibold hover:underline">Explore Events →</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => {
            const isCancelled = booking.status === 'cancelled'
            return (
              <div key={booking.id} className={`bg-gray-900 border ${isCancelled ? 'border-red-900/50 opacity-75' : 'border-gray-800'} rounded-2xl p-6 flex flex-col md:flex-row gap-6 shadow-xl`}>
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-mono bg-gray-800 text-gray-300 px-2 py-1 rounded">Ref: {booking.booking_reference}</span>
                    <span className={`text-xs px-2 py-1 rounded-full font-bold uppercase tracking-wider ${isCancelled ? 'bg-red-900/50 text-red-400' : 'bg-emerald-900/50 text-emerald-400'}`}>
                      {booking.status}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">{booking.event_name}</h3>
                  <p className="text-sm text-gray-400 flex items-center gap-1.5 mb-1">
                    <span>📅</span> {format(new Date(booking.event_date), 'MMMM d, yyyy · h:mm a')}
                  </p>
                  <p className="text-sm text-gray-400 flex items-center gap-1.5 mb-4">
                    <span>📍</span> {booking.venue_name}
                  </p>
                  
                  <div className="flex flex-wrap gap-2">
                    {booking.seats.map(seat => (
                      <div key={seat.id} className="text-xs bg-gray-800 text-gray-300 px-3 py-1.5 rounded-lg border border-gray-700">
                        Row <span className="text-white font-bold">{seat.row}</span> Seat <span className="text-white font-bold">{seat.number}</span>
                        <span className="ml-2 text-violet-300">{seat.ticket_type}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="md:w-48 flex flex-col justify-between border-t md:border-t-0 md:border-l border-gray-800 pt-4 md:pt-0 md:pl-6">
                  <div className="mb-4">
                    <p className="text-sm text-gray-500 mb-1">Total Paid</p>
                    <p className="text-2xl font-bold text-white font-mono">${Number(booking.total_amount).toFixed(2)}</p>
                  </div>
                  
                  <div className="space-y-2">
                    {!isCancelled && (
                      <>
                        <Link to={`/bookings/${booking.id}/ticket`} className="block w-full text-center py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg text-sm transition-colors">
                          View E-Ticket
                        </Link>
                        <button onClick={() => handleCancel(booking.id, booking.booking_reference)} className="block w-full text-center py-2.5 bg-transparent border border-red-900/50 text-red-400 hover:bg-red-900/20 font-semibold rounded-lg text-sm transition-colors">
                          Cancel Booking
                        </button>
                      </>
                    )}
                  </div>
                </div>

              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}