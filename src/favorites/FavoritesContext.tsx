import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { createFavorite, getFavorites, removeFavorite, type FavoriteRecord } from '../lib/favoritesApi'
import type { Category, Place } from '../types'

interface FavoritesContextValue {
  favorites: Place[]
  favoritesLoading: boolean
  isFavorite: (placeId: string) => boolean
  toggleFavorite: (place: Place) => Promise<void>
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

  useEffect(() => {
    if (!user?.token) {
      setFavorites([])
      setFavoritesLoading(false)
      return
    }
    const controller = new AbortController()
    setFavoritesLoading(true)
    getFavorites(user.token, controller.signal)
      .then((data) => setFavorites(data.map(favoriteToPlace)))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setFavorites([])
      })
      .finally(() => setFavoritesLoading(false))
    return () => controller.abort()
  }, [user?.id, user?.token])

  const isFavorite = useCallback((placeId: string) => favorites.some((place) => place.id === placeId), [favorites])

  const toggleFavorite = useCallback(async (place: Place) => {
    if (!user?.token) throw new Error('AUTH_REQUIRED')
    if (isFavorite(place.id)) {
      await removeFavorite(user.token, place.id)
      setFavorites((current) => current.filter((item) => item.id !== place.id))
      return
    }
    const favorite = await createFavorite(user.token, place)
    setFavorites((current) => [favoriteToPlace(favorite), ...current.filter((item) => item.id !== place.id)])
  }, [isFavorite, user])

  const value = useMemo(() => ({ favorites, favoritesLoading, isFavorite, toggleFavorite }), [favorites, favoritesLoading, isFavorite, toggleFavorite])
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites() {
  const context = useContext(FavoritesContext)
  if (!context) throw new Error('useFavorites must be used inside FavoritesProvider')
  return context
}
