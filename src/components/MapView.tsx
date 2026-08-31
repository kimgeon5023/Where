import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { Place } from '../types'

type Location = { lat: number; lng: number }
type KakaoLatLng = { getLat?: () => number; getLng?: () => number }
type KakaoBounds = { getSouthWest: () => KakaoLatLng; getNorthEast: () => KakaoLatLng }
type KakaoMap = { setCenter: (latLng: KakaoLatLng) => void; setLevel: (level: number) => void; getLevel: () => number; getCenter: () => KakaoLatLng; getBounds: () => KakaoBounds }
type KakaoMapObject = { setMap: (map: KakaoMap | null) => void; setPosition: (position: KakaoLatLng) => void }
type KakaoPolyline = { setMap: (map: KakaoMap | null) => void }
type KakaoNamespace = { maps: { load: (callback: () => void) => void; Map: new (element: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap; LatLng: new (lat: number, lng: number) => KakaoLatLng; CustomOverlay: new (options: { map: KakaoMap; position: KakaoLatLng; content: HTMLElement; yAnchor: number }) => KakaoMapObject; Polyline: new (options: { map: KakaoMap; path: KakaoLatLng[]; strokeWeight: number; strokeColor: string; strokeOpacity: number; strokeStyle: string }) => KakaoPolyline; event: { addListener: (target: object, type: string, handler: () => void) => void } } }
declare global { interface Window { kakao?: KakaoNamespace } }

const scriptId = 'kakao-map-sdk'
const emptyRouteCoordinates: Location[] = []
let sdkPromise: Promise<KakaoNamespace> | null = null

function loadKakao(): Promise<KakaoNamespace> {
  if (window.kakao?.maps) return new Promise((resolve) => window.kakao?.maps.load(() => resolve(window.kakao as KakaoNamespace)))
  if (sdkPromise) return sdkPromise
  const key = import.meta.env.VITE_KAKAO_MAP_JS_KEY
  if (!key) return Promise.reject(new Error('카카오맵 JavaScript 키가 설정되지 않았습니다.'))

  sdkPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null
    const script = existing ?? document.createElement('script')
    const finish = () => {
      if (!window.kakao?.maps) {
        sdkPromise = null
        reject(new Error('카카오 개발자 콘솔에 현재 웹 도메인을 등록해 주세요.'))
        return
      }
      window.kakao.maps.load(() => resolve(window.kakao as KakaoNamespace))
    }
    const fail = () => {
      sdkPromise = null
      reject(new Error('카카오맵 SDK를 불러오지 못했습니다. 도메인과 JavaScript 키를 확인해 주세요.'))
    }

    if (existing) {
      existing.addEventListener('load', finish, { once: true })
      existing.addEventListener('error', fail, { once: true })
      return
    }
    script.id = scriptId
    script.async = true
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`
    script.addEventListener('load', finish, { once: true })
    script.addEventListener('error', fail, { once: true })
    document.head.appendChild(script)
  })
  return sdkPromise
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
  tour: { color: '#2878f0', path: '<path d="M12 21V10" /><path d="M12 15c-4 0-6-2-6-6 4 0 6 2 6 6ZM12 13c0-4 2-6 6-6 0 4-2 6-6 6Z" />' },
} as const

function createPlaceOverlay(kakao: KakaoNamespace, map: KakaoMap, place: Place, index: number, selected: boolean, onSelect?: (id: string) => void) {
  const style = categoryMarker[place.category as keyof typeof categoryMarker] || categoryMarker.tour
  const content = document.createElement('button')
  content.type = 'button'
  content.className = 'map-category-marker' + (selected ? ' selected' : '')
  content.style.setProperty('--marker-color', style.color)
  content.setAttribute('aria-label', `${place.name}, ${place.category}`)
  content.title = place.name
  content.addEventListener('click', () => onSelect?.(place.id))
  content.innerHTML = `<span>${index + 1}</span><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${style.path}</svg>`
  return new kakao.maps.CustomOverlay({ map, position: new kakao.maps.LatLng(place.lat, place.lng), content, yAnchor: 1 })
}

export default function MapView({ places, center, routePlaces = places, routeCoordinates = emptyRouteCoordinates, userLocation, onViewportChange, selectedPlaceId, onPlaceSelect }: { places: Place[]; center: [number, number]; routePlaces?: Place[]; routeCoordinates?: Location[]; userLocation?: Location | null; onViewportChange?: (viewport: Location & { radius: number; south: number; north: number; west: number; east: number; zoom: number }) => void; selectedPlaceId?: string; onPlaceSelect?: (id: string) => void }) {
  const { user } = useAuth()
  const elementRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<KakaoMap | null>(null)
  const kakaoRef = useRef<KakaoNamespace | null>(null)
  const userMarkerRef = useRef<KakaoMapObject | null>(null)
  const markerRefs = useRef<KakaoMapObject[]>([])
  const polylineRefs = useRef<KakaoPolyline[]>([])
  const viewportCallbackRef = useRef(onViewportChange)
  const initialCenterRef = useRef(center)
  const activeLocationRef = useRef<Location | null>(userLocation ?? null)
  const [gpsLocation, setGpsLocation] = useState<Location | null>(null)
  const [mapRevision, setMapRevision] = useState(0)
  const [status, setStatus] = useState('카카오 실시간 지도를 연결하는 중…')
  const activeLocation = userLocation ?? gpsLocation

  viewportCallbackRef.current = onViewportChange
  activeLocationRef.current = activeLocation

  useEffect(() => {
    if (!navigator.geolocation) { setStatus('이 브라우저에서는 GPS를 사용할 수 없습니다.'); return }
    const watchId = navigator.geolocation.watchPosition(
      (position) => setGpsLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => setStatus('지도를 표시했습니다. GPS 권한을 허용하면 내 위치를 볼 수 있어요.'),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  useEffect(() => {
    let cancelled = false
    loadKakao().then((kakao) => {
      if (cancelled || !elementRef.current) return
      kakaoRef.current = kakao
      const fallback = initialCenterRef.current
      const initial = activeLocationRef.current ?? { lat: fallback[0], lng: fallback[1] }
      const map = new kakao.maps.Map(elementRef.current, { center: new kakao.maps.LatLng(initial.lat, initial.lng), level: activeLocationRef.current ? 5 : 7 })
      mapRef.current = map
      const reportViewport = () => {
        const point = map.getCenter()
        const southWest = map.getBounds().getSouthWest()
        const northEast = map.getBounds().getNorthEast()
        const lat = point.getLat?.(); const lng = point.getLng?.()
        const south = southWest.getLat?.(); const north = northEast.getLat?.()
        const west = southWest.getLng?.(); const east = northEast.getLng?.()
        if ([lat, lng, south, north, west, east].every((value) => typeof value === 'number')) viewportCallbackRef.current?.({ lat: lat!, lng: lng!, radius: Math.max(500, Math.round(Math.abs(north! - south!) * 111_000 / 2)), south: south!, north: north!, west: west!, east: east!, zoom: map.getLevel() })
      }
      kakao.maps.event.addListener(map, 'dragend', reportViewport)
      kakao.maps.event.addListener(map, 'zoom_changed', reportViewport)
      setMapRevision((value) => value + 1)
      setStatus('카카오 실시간 지도 연결 완료')
    }).catch((error: unknown) => { if (!cancelled) setStatus(error instanceof Error ? error.message : '카카오맵을 불러오지 못했습니다.') })
    return () => {
      cancelled = true
      markerRefs.current.forEach((marker) => marker.setMap(null))
      polylineRefs.current.forEach((line) => line.setMap(null))
      userMarkerRef.current?.setMap(null)
      markerRefs.current = []
      polylineRefs.current = []
      userMarkerRef.current = null
      mapRef.current = null
      kakaoRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const kakao = kakaoRef.current
    if (!map || !kakao || mapRevision === 0) return
    markerRefs.current.forEach((marker) => marker.setMap(null))
    polylineRefs.current.forEach((line) => line.setMap(null))
    markerRefs.current = places.map((place, index) => createPlaceOverlay(kakao, map, place, index, place.id === selectedPlaceId, onPlaceSelect))
    const route = (routeCoordinates.length > 1 ? routeCoordinates : routePlaces).map((place) => new kakao.maps.LatLng(place.lat, place.lng))
    polylineRefs.current = route.length > 1 ? [new kakao.maps.Polyline({ map, path: route, strokeWeight: 5, strokeColor: '#2878f0', strokeOpacity: .85, strokeStyle: 'solid' })] : []
  }, [mapRevision, places, routeCoordinates, routePlaces, selectedPlaceId, onPlaceSelect])

  useEffect(() => {
    const map = mapRef.current
    const kakao = kakaoRef.current
    if (!activeLocation || !map || !kakao || mapRevision === 0) return
    const point = new kakao.maps.LatLng(activeLocation.lat, activeLocation.lng)
    if (!userMarkerRef.current) {
      userMarkerRef.current = createProfileOverlay(kakao, map, point, user?.profileImage ?? '', user?.name ?? '나')
      map.setCenter(point)
    } else userMarkerRef.current.setPosition(point)
    setStatus('카카오 실시간 지도 · 내 위치 연결 완료')
  }, [activeLocation, mapRevision, user?.name, user?.profileImage])

  function returnToMyLocation() {
    if (!activeLocation || !mapRef.current || !kakaoRef.current) { setStatus('GPS 위치를 확인하는 중입니다.'); return }
    mapRef.current.setCenter(new kakaoRef.current.maps.LatLng(activeLocation.lat, activeLocation.lng))
    mapRef.current.setLevel(4)
    setStatus('내 위치로 돌아왔습니다.')
  }

  const failed = status.includes('등록') || status.includes('키') || status.includes('불러오지')
  return <div className="trip-map kakao-map-wrap" data-map-state={failed ? 'error' : 'ready'}><div ref={elementRef} className="kakao-map-canvas" aria-label="카카오 실시간 지도" />{failed && <div className="map-connection-error"><strong>지도를 연결하지 못했어요</strong><span>{status}</span></div>}<button type="button" className="map-my-location-button" onClick={returnToMyLocation} aria-label="내 현재 위치로 돌아가기"><span aria-hidden="true">⌖</span> 내 위치</button><span className="map-gps-status">{status}</span></div>
}
