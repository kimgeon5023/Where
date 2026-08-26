import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { Place } from '../types'

type Location = { lat: number; lng: number }
type KakaoLatLng = { getLat?: () => number; getLng?: () => number }
type KakaoMap = { setCenter: (latLng: KakaoLatLng) => void; setLevel: (level: number) => void; getCenter: () => KakaoLatLng; getBounds: () => { getSouthWest: () => KakaoLatLng; getNorthEast: () => KakaoLatLng } }
type KakaoMapObject = { setMap: (map: KakaoMap | null) => void; setPosition: (position: KakaoLatLng) => void }
type KakaoMarker = KakaoMapObject
type KakaoPolyline = { setMap: (map: KakaoMap | null) => void }
type KakaoNamespace = { maps: { load: (callback: () => void) => void; Map: new (element: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap; LatLng: new (lat: number, lng: number) => KakaoLatLng; CustomOverlay: new (options: { map: KakaoMap; position: KakaoLatLng; content: HTMLElement; yAnchor: number }) => KakaoMapObject; Polyline: new (options: { map: KakaoMap; path: KakaoLatLng[]; strokeWeight: number; strokeColor: string; strokeOpacity: number; strokeStyle: string }) => KakaoPolyline; event: { addListener: (target: KakaoMarker, type: string, handler: () => void) => void } } }
declare global { interface Window { kakao?: KakaoNamespace } }

const scriptId = 'kakao-map-sdk'
const emptyRouteCoordinates: Location[] = []

function loadKakao(): Promise<KakaoNamespace> {
  if (window.kakao) return new Promise((resolve) => window.kakao?.maps.load(() => resolve(window.kakao as KakaoNamespace)))
  const key = import.meta.env.VITE_KAKAO_MAP_JS_KEY
  if (!key) return Promise.reject(new Error('카카오맵 JavaScript 키가 설정되지 않았습니다.'))
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null
    const script = existing ?? document.createElement('script')
    script.id = scriptId
    script.async = true
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`
    script.addEventListener('load', () => window.kakao?.maps.load(() => resolve(window.kakao as KakaoNamespace)))
    script.addEventListener('error', () => reject(new Error('카카오맵 SDK를 불러오지 못했습니다.')))
    if (!existing) document.head.appendChild(script)
  })
}

function createProfileOverlay(kakao: KakaoNamespace, map: KakaoMap, position: KakaoLatLng, profileImage: string, name: string) {
  const content = document.createElement('div')
  content.className = 'map-profile-location'
  if (profileImage) {
    const image = document.createElement('img')
    image.src = profileImage
    image.alt = `${name}의 현재 위치`
    content.appendChild(image)
  } else {
    content.setAttribute('aria-label', '내 현재 위치')
    content.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>'
  }
  return new kakao.maps.CustomOverlay({ map, position, content, yAnchor: 1 })
}

const categoryMarker = {
  cafe: { color: '#b66a36', path: '<path d="M5 9h12v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9ZM17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 4c0 1 1 1 1 2M12 4c0 1 1 1 1 2M16 4c0 1 1 1 1 2M4 21h15" />' },
  food: { color: '#d26a4b', path: '<path d="M4 3v8M7 3v8M4 7h3M5.5 11v10M15 3v18M15 3c3 2 3 6 0 8" />' },
  lodging: { color: '#6579b8', path: '<path d="M4 19v-8M4 15h16v4M7 11V8h5a3 3 0 0 1 3 3M20 19v-6a2 2 0 0 0-2-2H4" />' },
  activity: { color: '#a365b4', path: '<circle cx="12" cy="12" r="8.5" /><path d="m10 8 5 4-5 4V8Z" />' },
  photo: { color: '#c58b36', path: '<rect x="3" y="5" width="18" height="15" rx="2" /><circle cx="8.5" cy="10" r="1.5" /><path d="m4 17 4.5-4 3.5 3 2.5-2 5.5 5" />' },
  tour: { color: '#41936f', path: '<path d="M12 21V10" /><path d="M12 15c-4 0-6-2-6-6 4 0 6 2 6 6ZM12 13c0-4 2-6 6-6 0 4-2 6-6 6Z" />' },
} as const

function createPlaceOverlay(kakao: KakaoNamespace, map: KakaoMap, place: Place, index: number) {
  const style = categoryMarker[place.category as keyof typeof categoryMarker] || categoryMarker.tour
  const content = document.createElement('button')
  content.type = 'button'
  content.className = 'map-category-marker'
  content.style.setProperty('--marker-color', style.color)
  content.setAttribute('aria-label', `${place.name}, ${place.category}`)
  content.title = place.name
  content.innerHTML = `<span>${index + 1}</span><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${style.path}</svg>`
  return new kakao.maps.CustomOverlay({ map, position: new kakao.maps.LatLng(place.lat, place.lng), content, yAnchor: 1 })
}

export default function MapView({ places, center, routePlaces = places, routeCoordinates = emptyRouteCoordinates, userLocation, onViewportChange }: { places: Place[]; center: [number, number]; routePlaces?: Place[]; routeCoordinates?: Location[]; userLocation?: Location | null; onViewportChange?: (viewport: Location & { radius: number }) => void }) {
  const { user } = useAuth()
  const elementRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<KakaoMap | null>(null)
  const kakaoRef = useRef<KakaoNamespace | null>(null)
  const userMarkerRef = useRef<KakaoMapObject | null>(null)
  const [gpsLocation, setGpsLocation] = useState<Location | null>(null)
  const [status, setStatus] = useState(userLocation ? '내 위치 중심으로 표시 중' : 'GPS 위치를 확인하는 중…')
  const activeLocation = userLocation ?? gpsLocation

  useEffect(() => {
    if (!navigator.geolocation) return setStatus('이 브라우저에서는 GPS를 사용할 수 없습니다.')
    const watchId = navigator.geolocation.watchPosition(
      (position) => setGpsLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => setStatus('GPS 권한을 허용하면 내 위치 중심으로 이동합니다.'),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  useEffect(() => {
    if (!activeLocation || !mapRef.current || !kakaoRef.current) return
    const point = new kakaoRef.current.maps.LatLng(activeLocation.lat, activeLocation.lng)
    if (!userMarkerRef.current) userMarkerRef.current = createProfileOverlay(kakaoRef.current, mapRef.current, point, user?.profileImage ?? '', user?.name ?? '나')
    else userMarkerRef.current.setPosition(point)
    mapRef.current.setCenter(point)
    setStatus('내 위치 중심으로 표시 중')
  }, [activeLocation, user?.name, user?.profileImage])

  useEffect(() => {
    let cancelled = false
    let markers: KakaoMapObject[] = []
    let polylines: KakaoPolyline[] = []
    loadKakao().then((kakao) => {
      if (cancelled || !elementRef.current) return
      kakaoRef.current = kakao
      const initial = activeLocation ?? { lat: center[0], lng: center[1] }
      const map = new kakao.maps.Map(elementRef.current, { center: new kakao.maps.LatLng(initial.lat, initial.lng), level: activeLocation ? 5 : 7 })
      mapRef.current = map
      const reportViewport = () => {
        const point = map.getCenter()
        const southWest = map.getBounds().getSouthWest()
        const northEast = map.getBounds().getNorthEast()
        const lat = point.getLat?.(); const lng = point.getLng?.()
        const south = southWest.getLat?.(); const north = northEast.getLat?.()
        if ([lat, lng, south, north].every((value) => typeof value === 'number')) onViewportChange?.({ lat: lat!, lng: lng!, radius: Math.max(500, Math.round(Math.abs(north! - south!) * 111_000 / 2)) })
      }
      kakao.maps.event.addListener(map as unknown as KakaoMarker, 'dragend', reportViewport)
      kakao.maps.event.addListener(map as unknown as KakaoMarker, 'zoom_changed', reportViewport)
      if (activeLocation) userMarkerRef.current = createProfileOverlay(kakao, map, new kakao.maps.LatLng(activeLocation.lat, activeLocation.lng), user?.profileImage ?? '', user?.name ?? '나')
      markers = places.map((place, index) => createPlaceOverlay(kakao, map, place, index))
      const route = (routeCoordinates.length > 1 ? routeCoordinates : routePlaces).map((place) => new kakao.maps.LatLng(place.lat, place.lng))
      if (route.length > 1) polylines = [new kakao.maps.Polyline({ map, path: route, strokeWeight: 4, strokeColor: '#1d9b77', strokeOpacity: .8, strokeStyle: 'dashed' })]
      setStatus(activeLocation ? '내 위치 중심으로 표시 중' : 'GPS 권한을 허용하면 내 위치 중심으로 이동합니다.')
    }).catch((error: unknown) => { if (!cancelled) setStatus(error instanceof Error ? error.message : '카카오맵을 불러오지 못했습니다.') })
    return () => {
      cancelled = true
      markers.forEach((marker) => marker.setMap(null))
      polylines.forEach((line) => line.setMap(null))
      userMarkerRef.current?.setMap(null)
      userMarkerRef.current = null
      mapRef.current = null
    }
  }, [center, places, routePlaces, routeCoordinates, user?.name, user?.profileImage, onViewportChange])

  function returnToMyLocation() {
    if (!activeLocation || !mapRef.current || !kakaoRef.current) return setStatus('GPS 위치를 확인하는 중입니다.')
    mapRef.current.setCenter(new kakaoRef.current.maps.LatLng(activeLocation.lat, activeLocation.lng))
    mapRef.current.setLevel(4)
    setStatus('내 위치로 돌아왔습니다.')
  }

  return <div className="trip-map kakao-map-wrap"><div ref={elementRef} className="kakao-map-canvas" aria-label="카카오맵" /><button type="button" className="map-my-location-button" onClick={returnToMyLocation} aria-label="내 현재 위치로 돌아가기"><span aria-hidden="true">⌖</span> 내 위치</button><span className="map-gps-status">{status}</span></div>
}
