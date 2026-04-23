import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getEventSeats, getTicketTypes, getAddOns, validatePromo, confirmPayment } from '../services/api'
import useSeatStore from '../store/seatStore'

export default function Checkout({ user }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const eventId = Number(params.get('event'))
  const seatIds = params.get('seats')?.split(',').map(Number) || []
  const { resetSeats } = useSeatStore()

  const [seats, setSeats] = useState([])
  const [ticketTypes, setTicketTypes] = useState([])
  const [addOns, setAddOns] = useState([])
  
  // Checkout State
  const [selectedTypes, setSelectedTypes] = useState({}) // seat_id -> ticket_type_id
  const [selectedAddOns, setSelectedAddOns] = useState({}) // addon_id -> qty
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [promoCode, setPromoCode] = useState('')
  const [discountPct, setDiscountPct] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (!eventId || seatIds.length === 0) return navigate('/')
    Promise.all([
      getEventSeats(eventId), getTicketTypes(eventId), getAddOns(eventId)
    ]).then(([allSeats, tTypes, extras]) => {
      setSeats(allSeats.filter(s => seatIds.includes(s.id)))
      setTicketTypes(tTypes)
      setAddOns(extras)
      
      // Auto-select first ticket type (Adult) for all seats
      if (tTypes.length > 0) {
        const initial = {}
        seatIds.forEach(id => initial[id] = tTypes[0].id)
        setSelectedTypes(initial)
      }
    })
  }, [eventId])

  // Real-time Pricing Math
  const { baseTotal, addOnTotal, discountAmount, tax, grandTotal } = useMemo(() => {
    let base = 0
    seats.forEach(s => {
      let price = Number(s.price)
      const tId = selectedTypes[s.id]
      if (tId) {
        const typeObj = ticketTypes.find(t => t.id === Number(tId))
        if (typeObj) price += Number(typeObj.price_modifier)
      }
      base += price
    })

    let extras = 0
    Object.entries(selectedAddOns).forEach(([id, qty]) => {
      const ao = addOns.find(a => a.id === Number(id))
      if (ao) extras += Number(ao.price) * qty
    })

    const subtotal = base + extras
    const discount = subtotal * (discountPct / 100)
    const taxAmt = (subtotal - discount) * 0.10 // 10% Tax
    
    return {
      baseTotal: base, addOnTotal: extras, discountAmount: discount,
      tax: taxAmt, grandTotal: (subtotal - discount) + taxAmt
    }
  }, [seats, ticketTypes, selectedTypes, addOns, selectedAddOns, discountPct])

  const handleApplyPromo = async () => {
    try {
      const res = await validatePromo(promoCode)
      setDiscountPct(res.discount_percentage)
      toast.success(`Promo Applied: ${res.discount_percentage}% off!`)
    } catch (err) {
      setDiscountPct(0)
      toast.error('Invalid or expired promo code')
    }
  }

  const handlePay = async (e) => {
    e.preventDefault()
    if (!user && !guestEmail) return toast.error('Email is required for guest checkout')
    
    setIsProcessing(true)
    try {
      await confirmPayment({
        event_id: eventId, seat_ids: seatIds, card_number: "424242424242",
        guest_email: user ? null : guestEmail, guest_phone: user ? null : guestPhone,
        ticket_types: selectedTypes, add_ons: selectedAddOns, promo_code: promoCode
      })
      toast.success('Payment successful!')
      resetSeats()
      navigate(`/success?session_id=local_${Date.now()}`)
    } catch (err) {
      toast.error('Payment failed')
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen pt-20 px-4 pb-12 bg-gray-950 flex justify-center">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Config */}
        <div className="lg:col-span-2 space-y-6">
          <h1 className="text-3xl font-bold text-white mb-2">Checkout</h1>
          
          {/* Guest Info (If not logged in) */}
          {!user && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Contact Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <input required type="email" placeholder="Email Address" value={guestEmail} onChange={e=>setGuestEmail(e.target.value)} className="bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white outline-none focus:border-violet-500" />
                <input type="tel" placeholder="Phone (Optional)" value={guestPhone} onChange={e=>setGuestPhone(e.target.value)} className="bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white outline-none focus:border-violet-500" />
              </div>
              <p className="text-xs text-gray-500 mt-3">We will send your tickets here. Want to save them? <a href="/auth/google/login" className="text-violet-400 hover:underline">Log in</a></p>
            </div>
          )}

          {/* Ticket Types per Seat */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Assign Tickets</h2>
            <div className="divide-y divide-gray-800">
              {seats.map(seat => (
                <div key={seat.id} className="py-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-200">Seat {seat.row}{seat.number}</p>
                    <p className="text-xs text-emerald-400 font-mono">${Number(seat.price).toFixed(2)} Base</p>
                  </div>
                  <select 
                    value={selectedTypes[seat.id] || ''} 
                    onChange={e => setSelectedTypes({...selectedTypes, [seat.id]: e.target.value})}
                    className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none"
                  >
                    {ticketTypes.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({Number(t.price_modifier) > 0 ? '+' : ''}{Number(t.price_modifier)} $)
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Add-ons */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Add-ons & Upgrades</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addOns.map(addon => (
                <div key={addon.id} className="bg-gray-950 border border-gray-800 rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-200 text-sm">{addon.name}</p>
                    <p className="text-xs text-emerald-400 font-mono">+${Number(addon.price).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setSelectedAddOns({...selectedAddOns, [addon.id]: Math.max(0, (selectedAddOns[addon.id]||0)-1)})} className="w-8 h-8 rounded-full bg-gray-800 text-white">-</button>
                    <span className="text-white w-4 text-center">{selectedAddOns[addon.id] || 0}</span>
                    <button onClick={() => setSelectedAddOns({...selectedAddOns, [addon.id]: (selectedAddOns[addon.id]||0)+1})} className="w-8 h-8 rounded-full bg-gray-800 text-white">+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary */}
        <div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 sticky top-24">
            <h3 className="text-lg font-semibold text-white mb-4">Order Summary</h3>
            
            <div className="space-y-3 text-sm mb-6">
              <div className="flex justify-between text-gray-400"><span>Tickets ({seats.length})</span> <span>${baseTotal.toFixed(2)}</span></div>
              {addOnTotal > 0 && <div className="flex justify-between text-gray-400"><span>Add-ons</span> <span>${addOnTotal.toFixed(2)}</span></div>}
              {discountAmount > 0 && <div className="flex justify-between text-emerald-400"><span>Discount</span> <span>-${discountAmount.toFixed(2)}</span></div>}
              <div className="flex justify-between text-gray-400"><span>Taxes & Fees (10%)</span> <span>${tax.toFixed(2)}</span></div>
            </div>

            <div className="border-t border-gray-800 pt-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-200">Total</span>
                <span className="text-3xl font-bold text-emerald-400 font-mono">${grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-2 mb-6">
              <input type="text" placeholder="Promo Code" value={promoCode} onChange={e=>setPromoCode(e.target.value.toUpperCase())} className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white outline-none" />
              <button onClick={handleApplyPromo} className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 text-sm font-semibold">Apply</button>
            </div>

            <button onClick={handlePay} disabled={isProcessing} className="w-full py-4 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-800 text-white font-bold rounded-lg transition-colors flex items-center justify-center">
              {isProcessing ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Complete Secure Payment 🔒"}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}