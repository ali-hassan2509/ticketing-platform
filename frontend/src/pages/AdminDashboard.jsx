import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getAdminMetrics, getAdminUsers, toggleUserStatus, getAdminBookings, getAuditLogs } from '../services/api'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

export default function AdminDashboard({ user }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [metrics, setMetrics] = useState(null)
  const [users, setUsers] = useState([])
  const [bookings, setBookings] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.is_admin) {
      navigate('/')
      return
    }
    fetchData()
  }, [user, activeTab])

  const fetchData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'overview') setMetrics(await getAdminMetrics())
      if (activeTab === 'users') setUsers(await getAdminUsers())
      if (activeTab === 'bookings') setBookings(await getAdminBookings())
      if (activeTab === 'audits') setLogs(await getAuditLogs())
    } catch (err) {
      toast.error('Failed to fetch admin data')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleUser = async (id) => {
    try {
      const res = await toggleUserStatus(id)
      toast.success(res.message)
      setUsers(users.map(u => u.id === id ? { ...u, is_active: res.is_active } : u))
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to toggle user')
    }
  }

  if (!user?.is_admin) return null

  return (
    <div className="min-h-screen pt-14 flex bg-gray-950">
      
      {/* Sidebar */}
      <div className="w-64 border-r border-gray-800 bg-gray-900 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">🛡️ Admin Portal</h2>
        </div>
        <div className="flex flex-col p-4 space-y-2 flex-1">
          {['overview', 'events', 'bookings', 'users', 'audits'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`text-left px-4 py-3 rounded-lg text-sm font-semibold transition-colors capitalize ${
                activeTab === tab ? 'bg-violet-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-8">
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="animate-fade-in">
            <h1 className="text-3xl font-bold text-white mb-8">Platform Metrics</h1>
            {loading ? <div className="h-64 bg-gray-900 rounded-xl animate-pulse"/> : metrics && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                  <p className="text-gray-400 text-sm font-medium mb-1">Total Revenue</p>
                  <p className="text-3xl font-bold text-emerald-400 font-mono">${metrics.total_revenue.toFixed(2)}</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                  <p className="text-gray-400 text-sm font-medium mb-1">Total Bookings</p>
                  <p className="text-3xl font-bold text-white">{metrics.total_bookings}</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                  <p className="text-gray-400 text-sm font-medium mb-1">Registered Users</p>
                  <p className="text-3xl font-bold text-white">{metrics.total_users}</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                  <p className="text-gray-400 text-sm font-medium mb-1">Occupancy Rate</p>
                  <p className="text-3xl font-bold text-violet-400">{metrics.occupancy_rate}%</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* EVENTS TAB */}
        {activeTab === 'events' && (
          <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-bold text-white">Manage Events</h1>
              <Link to="/admin/events/new" className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg shadow-lg">
                + Create New Event
              </Link>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
              <p className="text-gray-400">Events are managed from the main homepage and creation portal.</p>
            </div>
          </div>
        )}

        {/* BOOKINGS TAB */}
        {activeTab === 'bookings' && (
          <div className="animate-fade-in">
            <h1 className="text-3xl font-bold text-white mb-8">Global Booking Ledger</h1>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-sm text-gray-400">
                <thead className="bg-gray-950 text-gray-500 uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-4">Ref</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Purchaser</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {bookings.map(b => (
                    <tr key={b.id} className="hover:bg-gray-800/50">
                      <td className="px-6 py-4 font-mono text-white">{b.reference}</td>
                      <td className="px-6 py-4">{format(new Date(b.date), 'MMM d, yyyy HH:mm')}</td>
                      <td className="px-6 py-4">{b.purchaser}</td>
                      <td className="px-6 py-4 text-emerald-400 font-mono">${b.amount.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${b.status === 'confirmed' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400'}`}>
                          {b.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div className="animate-fade-in">
            <h1 className="text-3xl font-bold text-white mb-8">User Management</h1>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-sm text-gray-400">
                <thead className="bg-gray-950 text-gray-500 uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Joined</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-800/50">
                      <td className="px-6 py-4 text-white font-medium">{u.name} <br/><span className="text-xs text-gray-500">{u.email}</span></td>
                      <td className="px-6 py-4">{format(new Date(u.created_at), 'MMM d, yyyy')}</td>
                      <td className="px-6 py-4">
                        {u.is_admin ? <span className="text-violet-400 bg-violet-900/30 px-2 py-1 rounded text-xs font-bold">ADMIN</span> : 'User'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {!u.is_admin && (
                          <button onClick={() => handleToggleUser(u.id)}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold ${u.is_active ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' : 'bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50'}`}>
                            {u.is_active ? 'Block User' : 'Unblock User'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AUDIT TAB */}
        {activeTab === 'audits' && (
          <div className="animate-fade-in">
            <h1 className="text-3xl font-bold text-white mb-8">Security Audit Logs</h1>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-sm text-gray-400">
                <thead className="bg-gray-950 text-gray-500 uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Admin</th>
                    <th className="px-6 py-4">Action</th>
                    <th className="px-6 py-4">Target Entity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-800/50">
                      <td className="px-6 py-4">{format(new Date(log.date), 'MMM d, yyyy HH:mm:ss')}</td>
                      <td className="px-6 py-4 text-white">{log.admin}</td>
                      <td className="px-6 py-4 font-bold text-violet-400">{log.action}</td>
                      <td className="px-6 py-4">{log.target}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}