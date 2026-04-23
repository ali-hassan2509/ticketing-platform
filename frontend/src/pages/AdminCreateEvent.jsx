import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { createEvent } from '../services/api'

export default function AdminCreateEvent({ user }) {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '', category: 'event', destination: '', venue_name: '', 
    description: '', cancellation_policy: '', event_date: '', lock_duration_minutes: 10
  })
  
  const [rowsConfig, setRowsConfig] = useState([
    { row_start: 'A', row_end: 'D', seats_per_row: 20, price: 150.00, section: 'VIP Front', seat_class: 'vip', is_wheelchair_accessible: false }
  ])

  if (!user?.is_admin) return <div className="pt-20 text-center text-red-400">Access Denied: Admins Only</div>

  const handleAddTier = () => {
    setRowsConfig([...rowsConfig, { row_start: '', row_end: '', seats_per_row: 20, price: 50.00, section: 'General', seat_class: 'economy', is_wheelchair_accessible: false }])
  }

  const updateTier = (index, field, value) => {
    const newConfig = [...rowsConfig]
    newConfig[index][field] = value
    setRowsConfig(newConfig)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const payload = {
        ...formData,
        event_date: new Date(formData.event_date).toISOString(),
        rows_config: rowsConfig
      }
      const res = await createEvent(payload)
      toast.success(`Event created with ${res.total_seats} seats!`)
      navigate('/admin')
    } catch (err) {
      toast.error('Failed to create event. Check your inputs.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen pt-20 px-4 pb-12 bg-gray-950 flex justify-center">
      <div className="max-w-4xl w-full">
        <h1 className="text-3xl font-bold text-white mb-2">Create New Event</h1>
        <p className="text-gray-400 mb-8">Define the event details and automatically generate the seat map.</p>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-gray-200 mb-4">1. Event Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Event Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Category</label>
                <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white outline-none">
                  <option value="event">Event / Concert</option>
                  <option value="movie">Movie</option>
                  <option value="travel">Travel / Flight</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Venue Name</label>
                <input required type="text" value={formData.venue_name} onChange={e => setFormData({...formData, venue_name: e.target.value})} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">City / Destination</label>
                <input type="text" value={formData.destination} onChange={e => setFormData({...formData, destination: e.target.value})} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Date & Time</label>
                <input required type="datetime-local" value={formData.event_date} onChange={e => setFormData({...formData, event_date: e.target.value})} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white outline-none [color-scheme:dark]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Cancellation Policy</label>
                <input type="text" placeholder="e.g. Non-refundable" value={formData.cancellation_policy} onChange={e => setFormData({...formData, cancellation_policy: e.target.value})} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white outline-none focus:border-violet-500" />
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-200">2. Seat Map & Pricing Tiers</h2>
              <button type="button" onClick={handleAddTier} className="text-sm text-violet-400 hover:text-violet-300 font-medium">+ Add Tier</button>
            </div>
            
            <div className="space-y-4">
              {rowsConfig.map((tier, idx) => (
                <div key={idx} className="p-4 bg-gray-950 border border-gray-700 rounded-lg grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
                  <div><label className="block text-xs text-gray-500 mb-1">Row Start</label><input required type="text" maxLength="1" value={tier.row_start} onChange={e => updateTier(idx, 'row_start', e.target.value.toUpperCase())} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white outline-none uppercase text-center" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Row End</label><input required type="text" maxLength="1" value={tier.row_end} onChange={e => updateTier(idx, 'row_end', e.target.value.toUpperCase())} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white outline-none uppercase text-center" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Seats/Row</label><input required type="number" value={tier.seats_per_row} onChange={e => updateTier(idx, 'seats_per_row', Number(e.target.value))} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white outline-none text-center" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Price ($)</label><input required type="number" step="0.01" value={tier.price} onChange={e => updateTier(idx, 'price', Number(e.target.value))} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-emerald-400 font-mono outline-none text-center" /></div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Class</label>
                    <select value={tier.seat_class} onChange={e => updateTier(idx, 'seat_class', e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white outline-none">
                      <option value="economy">Economy</option>
                      <option value="premium">Premium</option>
                      <option value="vip">VIP</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-800 text-white font-bold rounded-xl flex items-center justify-center">
            {isSubmitting ? <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "🚀 Publish Event & Generate Seats"}
          </button>
        </form>
      </div>
    </div>
  )
}