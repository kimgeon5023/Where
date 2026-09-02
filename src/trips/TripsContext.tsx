import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { listTrips, type Trip } from '../lib/tripsApi'
import { useAuth } from '../auth/AuthContext'

type TripsContextValue = { trips: Trip[]; tripsLoading: boolean; tripsError: string; refreshTrips: () => Promise<void> }
const TripsContext = createContext<TripsContextValue | null>(null)

export function TripsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [trips, setTrips] = useState<Trip[]>([])
  const [tripsLoading, setTripsLoading] = useState(false)
  const [tripsError, setTripsError] = useState('')
  const refreshTrips = useCallback(async () => {
    if (!user?.token) { setTrips([]); setTripsError(''); return }
    setTripsLoading(true); setTripsError('')
    try { setTrips(await listTrips(user.token)) }
    catch (error) { setTrips([]); setTripsError(error instanceof Error ? error.message : '저장한 코스를 불러오지 못했습니다.') }
    finally { setTripsLoading(false) }
  }, [user?.token])
  useEffect(() => { void refreshTrips() }, [refreshTrips])
  const value = useMemo(() => ({ trips, tripsLoading, tripsError, refreshTrips }), [trips, tripsLoading, tripsError, refreshTrips])
  return <TripsContext.Provider value={value}>{children}</TripsContext.Provider>
}

export function useTrips() {
  const value = useContext(TripsContext)
  if (!value) throw new Error('useTrips must be used within TripsProvider')
  return value
}
