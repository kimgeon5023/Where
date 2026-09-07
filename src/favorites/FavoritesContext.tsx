import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { createFavorite, getFavorites, removeFavorite, type FavoriteRecord } from '../lib/favoritesApi'
import { clearLegacyFavorites, getFavoriteSnapshot, getLastFavoriteSnapshot, getLegacyFavorites, saveFavoriteSnapshot } from '../lib/legacyFavorites'
import type { Category, Place } from '../types'

interface FavoritesContextValue {
  favorites: Place[]
  favoritesLoading: boolean
  legacyFavoritesCount: number
  isFavorite: (placeId: string) => boolean
  toggleFavorite: (place: Place) => Promise<void>
  importLegacyFavorites: () => Promise<void>
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)

function favoriteToPlace(favorite: FavoriteRecord): Place {
  const place = favorite.place || {}
  return {
    id: favorite.placeId,
    name: favorite.placeName,
    area: favorite.address,
    category: (place.category || favorite.category || 'tour') as Category,
    lat: favorite.latitude ?? place.lat ?? 0,
    lng: favorite.longitude ?? place.lng ?? 0,
    tags: place.tags || [],
    groupFit: place.groupFit || [],
    indoor: place.indoor ?? false,
    price: place.price ?? 0,
    durationMin: place.durationMin ?? 0,
    rating: place.rating ?? 0,
    description: place.description || '',
    image: favorite.imageUrl || place.image || '',
    accent: place.accent || '#1d9b77',
    distanceKm: place.distanceKm,
    menu: place.menu,
    lodging: place.lodging,
    phone: place.phone,
    placeUrl: place.placeUrl,
  }
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [favorites, setFavorites] = useState<Place[]>([])
  const [favoritesLoading, setFavoritesLoading] = useState(false)
  const [legacyFavorites, setLegacyFavorites] = useState<Place[]>([])

  useEffect(() => {
    if (!user?.token) {
      // Keep the most recently signed-in account's list available on this device
      // after sign-out. A subsequent sign-in always replaces it with that account's list.
      setFavorites(getLastFavoriteSnapshot())
      setFavoritesLoading(false)
      setLegacyFavorites([])
      return
    }
    const controller = new AbortController()
    let active = true
    // Never display the previous account's favorites while loading this account.
    setFavorites([])
    setLegacyFavorites(getLegacyFavorites())
    setFavoritesLoading(true)
    getFavorites(user.token, controller.signal)
      .then((data) => {
        if (!active) return
        const places = data.map(favoriteToPlace)
        setFavorites(places)
        saveFavoriteSnapshot(user.id, places)
      })
      .catch((error: unknown) => {
        if (active && !(error instanceof DOMException && error.name === 'AbortError')) setFavorites(getFavoriteSnapshot(user.id))
      })
      .finally(() => { if (active) setFavoritesLoading(false) })
    return () => { active = false; controller.abort() }
  }, [user?.id, user?.token])

  const isFavorite = useCallback((placeId: string) => favorites.some((place) => place.id === placeId), [favorites])

  const toggleFavorite = useCallback(async (place: Place) => {
    if (!user?.token) throw new Error('AUTH_REQUIRED')
    if (isFavorite(place.id)) {
      await removeFavorite(user.token, place.id)
      setFavorites((current) => {
        const next = current.filter((item) => item.id !== place.id)
        saveFavoriteSnapshot(user.id, next)
        return next
      })
      return
    }
    const favorite = await createFavorite(user.token, place)
    setFavorites((current) => {
      const next = [favoriteToPlace(favorite), ...current.filter((item) => item.id !== place.id)]
      saveFavoriteSnapshot(user.id, next)
      return next
    })
  }, [isFavorite, user])

  const importLegacyFavorites = useCallback(async () => {
    if (!user?.token) throw new Error('AUTH_REQUIRED')
    for (const place of legacyFavorites) await createFavorite(user.token, place)
    const data = await getFavorites(user.token)
    const places = data.map(favoriteToPlace)
    setFavorites(places)
    saveFavoriteSnapshot(user.id, places)
    clearLegacyFavorites()
    setLegacyFavorites([])
  }, [legacyFavorites, user])

  const value = useMemo(() => ({ favorites, favoritesLoading, legacyFavoritesCount: legacyFavorites.length, isFavorite, toggleFavorite, importLegacyFavorites }), [favorites, favoritesLoading, legacyFavorites.length, isFavorite, toggleFavorite, importLegacyFavorites])
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites() {
  const context = useContext(FavoritesContext)
  if (!context) throw new Error('useFavorites must be used inside FavoritesProvider')
  return context
}
