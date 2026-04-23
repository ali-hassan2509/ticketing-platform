import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor: attach JWT ──────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  const guestId = localStorage.getItem('guest_session_id') // Feature 2
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (guestId) config.headers['X-Guest-ID'] = guestId // Feature 2
  return config
})


// ── Response interceptor: handle 401 globally ───────────────
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      window.location.href = '/'
    }
    return Promise.reject(err)
  }
)

// ─────────────────────── Auth ───────────────────────────────
export const getMe = () => api.get('/auth/me').then(r => r.data)

// ─────────────────────── Events ─────────────────────────────
// export const getEvents = () => api.get('/api/events').then(r => r.data)
// export const getEvent = (eventId) => api.get(`/api/events/${eventId}`).then(r => r.data)
export const getEvents = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return api.get(`/api/events?${query}`).then(r => r.data)
}
export const getEvent = (eventId) => api.get(`/api/events/${eventId}`).then(r => r.data)

// ─────────────────────── Seats ──────────────────────────────
export const getEventSeats = (eventId) =>
  api.get(`/api/events/${eventId}/seats`).then(r => r.data)

/**
 * Lock a seat. Returns { seat_id, lock_token, expires_at, locked_at, user_id }
 */
export const lockSeat = (eventId, seatId) =>
  api.post(`/api/events/${eventId}/seats/lock`, { seat_id: seatId }).then(r => r.data)

/**
 * Release a seat lock by token.
 */
export const releaseSeat = (eventId, lockToken) =>
  api.post(`/api/events/${eventId}/seats/release`, { lock_token: lockToken }).then(r => r.data)

/**
 * Get all active locks for the current user.
 */
export const getMyLocks = () => api.get('/api/me/locks').then(r => r.data)

/**
 * Mock checkout — in production this would create a Stripe session.
 */
// export const createCheckoutSession = (eventId, seats) =>
//   Promise.resolve({ url: `/checkout?event=${eventId}&seats=${seats.join(',')}` })

// ─────────────────────── Checkout ─────────────────────────────
export const createCheckoutSession = (eventId, seatIds) =>
  api.post('/api/checkout/create-session', { event_id: eventId, seat_ids: seatIds }).then(r => r.data)

// export const confirmPayment = (eventId, seatIds, cardNumber) =>
//   api.post('/api/checkout/confirm', { 
//     event_id: eventId, 
//     seat_ids: seatIds, 
//     card_number: cardNumber 
//   }).then(r => r.data)

// ─────────────────────── Admin ──────────────────────────────
export const adminLogin = (email, password) =>
  api.post('/api/admin/login', { email, password }).then(r => r.data)

export const createEvent = (eventData) =>
  api.post('/api/admin/events', eventData).then(r => r.data)

export const getTicketTypes = (eventId) => api.get(`/api/events/${eventId}/ticket-types`).then(r => r.data)
export const getAddOns = (eventId) => api.get(`/api/events/${eventId}/add-ons`).then(r => r.data)
export const validatePromo = (code) => api.get(`/api/promo/validate?code=${code}`).then(r => r.data)

export const confirmPayment = (payload) => api.post('/api/checkout/confirm', payload).then(r => r.data)
// ─────────────────────── Bookings (Phase 3) ─────────────────────────────
export const getMyBookings = () => api.get('/api/bookings').then(r => r.data)
export const getBookingTicket = (id) => api.get(`/api/bookings/${id}`).then(r => r.data)
export const cancelBooking = (id) => api.post(`/api/bookings/${id}/cancel`).then(r => r.data)
// ─────────────────────── Admin (Phase 4) ──────────────────────────────
export const getAdminMetrics = () => api.get('/api/admin/metrics').then(r => r.data)
export const getAdminUsers = () => api.get('/api/admin/users').then(r => r.data)
export const toggleUserStatus = (id) => api.post(`/api/admin/users/${id}/toggle-status`).then(r => r.data)
export const getAdminBookings = () => api.get('/api/admin/bookings').then(r => r.data)
export const getAuditLogs = () => api.get('/api/admin/audit-logs').then(r => r.data)


export default api
