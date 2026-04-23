import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { adminLogin } from '../services/api'

export default function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState('')
  const[password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await adminLogin(email, password)
      localStorage.setItem('auth_token', response.token)
      onLogin(response.user)
      toast.success('Admin authentication successful')
      // FIX: Navigate directly to the Admin Dashboard
      navigate('/admin') 
    } catch (err) {
      toast.error('Invalid admin credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen pt-20 px-4 bg-gray-950 flex items-center justify-center">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Admin Portal</h1>
          <p className="text-gray-400 text-sm">Secure access for event managers.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Admin Email</label>
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="admin@ticketpro.com"
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Password</label>
            <input required type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3.5 mt-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 text-white font-bold rounded-lg transition-colors flex items-center justify-center">
            {loading ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : "Secure Login"}
          </button>
        </form>
      </div>
    </div>
  )
}