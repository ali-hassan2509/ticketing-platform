import { useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import useSeatStore from '../store/seatStore'

export default function Success() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const resetSeats = useSeatStore(state => state.resetSeats)

  useEffect(() => {
    const sessionId = params.get('session_id')
    if (!sessionId) {
      navigate('/')
      return
    }
    // Payment was already confirmed on Checkout.jsx!
    // Just clear the cart so the user can buy more tickets.
    resetSeats()
  },[params, navigate, resetSeats])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
        <div className="animate-fade-in">
          <div className="w-20 h-20 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
            ✓
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Payment Successful!</h2>
          <p className="text-gray-400 mb-8">Your tickets have been booked and a confirmation email is on its way.</p>
          <Link 
            to="/dashboard" 
            className="block w-full py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-semibold transition-colors"
          >
            View My Tickets
          </Link>
        </div>
      </div>
    </div>
  )
}