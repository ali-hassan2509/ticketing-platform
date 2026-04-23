import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getEvents } from '../services/api'
import { format } from 'date-fns'

export default function Home() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Feature 1: Search & Filter State
  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
    destination: '',
    sort_by: 'date'
  })

  const fetchEvents = () => {
    setLoading(true)
    getEvents(filters)
      .then(setEvents)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  // Fetch when filters change
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchEvents()
    }, 300)
    return () => clearTimeout(delayDebounceFn)
  }, [filters.search, filters.category, filters.destination, filters.sort_by])

  return (
    <div className="min-h-screen pt-20 px-4 max-w-6xl mx-auto pb-12">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-white mb-3">
          Explore Experiences 🌍
        </h1>
        <p className="text-gray-400">Discover and book movies, travel, and events instantly.</p>
      </div>

      {/* Feature 1: Search & Filter Bar */}
      <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl mb-8 flex flex-wrap gap-4 items-center shadow-xl">
        <div className="flex-1 min-w-[200px]">
          <input 
            type="text" 
            placeholder="Search events, movies..." 
            value={filters.search}
            onChange={(e) => setFilters({...filters, search: e.target.value})}
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-violet-500 outline-none"
          />
        </div>
        
        <select 
          value={filters.category} 
          onChange={(e) => setFilters({...filters, category: e.target.value})}
          className="bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white outline-none"
        >
          <option value="all">All Categories</option>
          <option value="movie">🍿 Movies</option>
          <option value="event">🎤 Concerts & Events</option>
          <option value="travel">✈️ Travel & Flights</option>
        </select>

        <div className="w-full md:w-auto">
          <input 
            type="text" 
            placeholder="City / Destination" 
            value={filters.destination}
            onChange={(e) => setFilters({...filters, destination: e.target.value})}
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-violet-500 outline-none"
          />
        </div>

        <select 
          value={filters.sort_by} 
          onChange={(e) => setFilters({...filters, sort_by: e.target.value})}
          className="bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white outline-none"
        >
          <option value="date">Sort: Upcoming First</option>
          <option value="popularity">Sort: Most Popular</option>
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-64 bg-gray-800/50 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20 bg-gray-900 border border-gray-800 rounded-2xl">
          <p className="text-5xl mb-4">🔍</p>
          <p className="text-gray-400">No results found for your search.</p>
          <button onClick={() => setFilters({search: '', category: 'all', destination: '', sort_by: 'date'})} className="mt-4 text-violet-400 hover:text-violet-300 font-medium">Clear Filters</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <Link
              key={event.id}
              to={`/events/${event.id}`}
              className="group block bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-violet-700 hover:shadow-xl hover:shadow-violet-900/20 transition-all flex flex-col h-full"
            >
              <div className="h-36 bg-gradient-to-br from-violet-900 via-purple-900 to-indigo-900 flex items-center justify-center text-6xl group-hover:from-violet-800 transition-all relative">
                {event.category === 'movie' ? '🍿' : event.category === 'travel' ? '✈️' : '🎤'}
                <span className="absolute top-3 right-3 bg-black/50 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide">
                  {event.category}
                </span>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <h2 className="font-bold text-white text-lg leading-tight mb-2 group-hover:text-violet-300 transition-colors line-clamp-2">
                  {event.name}
                </h2>
                
                <div className="mt-auto space-y-1.5 mb-4">
                  {(event.venue_name || event.destination) && (
                    <p className="text-sm text-gray-400 flex items-center gap-1.5">
                      <span>📍</span> {event.venue_name} {event.destination ? `· ${event.destination}` : ''}
                    </p>
                  )}
                  {event.event_date && (
                    <p className="text-sm text-gray-400 flex items-center gap-1.5">
                      <span>📅</span> {format(new Date(event.event_date), 'MMM d, yyyy · h:mm a')}
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-800 mt-auto flex items-center justify-between">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    event.status === 'active' ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-800' : 'bg-gray-800 text-gray-500 border border-gray-700'
                  }`}>
                    {event.status.toUpperCase()}
                  </span>
                  <span className="text-sm font-semibold text-violet-400 group-hover:translate-x-1 transition-transform">
                    View Details →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}