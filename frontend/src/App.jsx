import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { getMe } from './services/api'
import { Navbar } from './components/Navbar'

import Home from './pages/Home'
import EventSeatMap from './pages/EventSeatMap'
import Dashboard from './pages/Dashboard'
import AuthCallback from './pages/AuthCallback'
import Success from './pages/Success'
import Checkout from './pages/Checkout'
import TicketView from './pages/TicketView'

import AdminCreateEvent from './pages/AdminCreateEvent' 
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'

export default function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      setAuthLoading(false)
      return
    }
    getMe()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('auth_token')
      })
      .finally(() => setAuthLoading(false))
  }, [])

  const handleLogin = (userData) => setUser(userData)

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950">
        <Navbar user={user} onLogout={handleLogout} />

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/events/:eventId" element={<EventSeatMap user={user} />} />
          <Route path="/dashboard" element={<Dashboard user={user} />} />
          <Route path="/auth/callback" element={<AuthCallback onLogin={handleLogin} />} />
          <Route path="/success" element={<Success />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/admin/events/new" element={<AdminCreateEvent user={user} />} />
          <Route path="/admin/login" element={<AdminLogin onLogin={handleLogin} />} />
          <Route path="/bookings/:bookingId/ticket" element={<TicketView user={user} />} />
          <Route path="/admin" element={<AdminDashboard user={user} />} />





        </Routes>

        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#1f2937',
              color: '#f3f4f6',
              border: '1px solid #374151',
              borderRadius: '10px',
              fontSize: '13px',
            },
            success: { iconTheme: { primary: '#34d399', secondary: '#1f2937' } },
            error: { iconTheme: { primary: '#f87171', secondary: '#1f2937' } },
          }}
        />
      </div>
    </BrowserRouter>
  )
}
