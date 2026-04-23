import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getMe } from '../services/api'

/**
 * Handles the redirect from /auth/google/callback.
 * Extracts the JWT from the URL, stores it, fetches the user profile,
 * then redirects to the home page.
 */
export default function AuthCallback({ onLogin }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      navigate('/', { replace: true })
      return
    }

    localStorage.setItem('auth_token', token)

    getMe()
      .then((user) => {
        onLogin(user)
        navigate('/', { replace: true })
      })
      .catch(() => {
        localStorage.removeItem('auth_token')
        navigate('/', { replace: true })
      })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Signing you in…</p>
      </div>
    </div>
  )
}
