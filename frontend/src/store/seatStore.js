import { create } from 'zustand'

/**
 * Zustand store for all seat state.
 *
 * seats: Map<seatId, SeatWithLock>
 * myLocks: Map<seatId, lockToken>  — seats this user has locked
 */
let guestId = localStorage.getItem('guest_session_id')
if (!guestId) {
  guestId = 'guest_' + Math.random().toString(36).substring(2, 15)
  localStorage.setItem('guest_session_id', guestId)
}

const useSeatStore = create((set, get) => ({
  seats: {},        // seatId -> seat object
  myLocks: {},      // seatId -> lock_token
  loading: false,
  error: null,
  guestSessionId: guestId,

  // ── Setters ─────────────────────────────────────────────

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  /** Replace the entire seat map (initial load). */
  setAllSeats: (seatList) => {
    const seats = {}
    for (const seat of seatList) {
      seats[seat.id] = seat
    }
    set({ seats })
  },

  /** Batch-update seats received from initial_state WS message. */
  batchUpdateSeats: (seatList) => {
    set((state) => {
      const seats = { ...state.seats }
      for (const seat of seatList) {
        seats[seat.id] = { ...seats[seat.id], ...seat }
      }
      return { seats }
    })
  },

  /** Update a single seat's status and lock info. */
  updateSeatStatus: (seatId, status, lockInfo = null) => {
    set((state) => ({
      seats: {
        ...state.seats,
        [seatId]: {
          ...state.seats[seatId],
          status,
          lock: lockInfo,
        },
      },
    }))
  },

  /** Track that the current user locked this seat. */
  addMyLock: (seatId, lockToken) => {
    set((state) => ({
      myLocks: { ...state.myLocks, [seatId]: lockToken },
    }))
  },

  /** Remove a lock from the current user's set. */
  removeMyLock: (seatId) => {
    set((state) => {
      const myLocks = { ...state.myLocks }
      delete myLocks[seatId]
      return { myLocks }
    })
  },

  /** Set all user locks from initial_state message. */
  setMyLocks: (lockList) => {
    const myLocks = {}
    for (const lock of lockList) {
      myLocks[lock.seat_id] = lock.lock_token
    }
    set({ myLocks })
  },

  /** Reset everything (logout / event change). */
  resetSeats: () => set({ seats: {}, myLocks: {}, loading: false, error: null }),

  // ── Selectors ────────────────────────────────────────────

  getAvailableSeats: () =>
    Object.values(get().seats).filter((s) => s.status === 'available'),

  getLockedSeatsByUser: () =>
    Object.values(get().seats).filter((s) => s.lock?.locked_by_me),

  getSelectedSeats: () => {
    const myLocks = get().myLocks
    return Object.values(get().seats).filter((s) => myLocks[s.id])
  },

  isSeatMine: (seatId) => !!get().myLocks[seatId],
  getLockToken: (seatId) => get().myLocks[seatId] || null,
}))

export default useSeatStore
