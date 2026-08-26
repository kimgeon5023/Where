import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { Place } from '../types'

type Location = { lat: number; lng: number }
type KakaoLatLng = { getLat?: () => number; getLng?: () => number }
type KakaoMap = { setCenter: (latLng: KakaoLatLng) => void; setLevel: (level: number) => void; getCenter: () => KakaoLatLng; getBounds: () => { getSouthWest: () => KakaoLatLng; getNorthEast: () => KakaoLatLng } }
type KakaoMapObject = { setMap: (map: KakaoMap | null) => void; setPosition: (position: KakaoLatLng) => void }
type KakaoMarker = KakaoMapObject
type KakaoInfoWindow = { open: (map: KakaoMap, marker: KakaoMarker) => void; close: () => void }
type KakaoPolyline = { setMap: (map: KakaoMap | null) => void }
type KakaoNamespace = { maps: { load: (callback: () => void) => void; Map: new (element: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap; LatLng: new (lat: number, lng: number) => KakaoLatLng; Marker: new (options: { map: KakaoMap; position: KakaoLatLng; title?: string }) => KakaoMarker; CustomOverlay: new (options: { map: KakaoMap; position: KakaoLatLng; content: HTMLElement; yAnchor: number }) => KakaoMapObject; InfoWindow: new (options: { content: string; removable?: boolean }) => KakaoInfoWindow; Polyline: new (options: { map: KakaoMap; path: KakaoLatLng[]; strokeWeight: number; strokeColor: string; strokeOpacity: number; strokeStyle: string }) => KakaoPolyline; event: { addListener: (target: KakaoMarker, type: string, handler: () => void) => void } } }
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
    let markers: KakaoMarker[] = []
    let infoWindows: KakaoInfoWindow[] = []
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
      markers = places.map((place, index) => {
        const marker = new kakao.maps.Marker({ map, position: new kakao.maps.LatLng(place.lat, place.lng), title: place.name })
        const price = place.price > 0 ? `${place.price.toLocaleString()}원` : '가격 미정'
        const info = new kakao.maps.InfoWindow({ content: `<div style="padding:10px 12px;font-size:12px;line-height:1.5"><strong>${index + 1}. ${place.name}</strong><br>${place.area} · ${price}</div>`, removable: true })
        kakao.maps.event.addListener(marker, 'click', () => { infoWindows.forEach((item) => item.close()); info.open(map, marker) })
        infoWindows.push(info)
        return marker
      })
      const route = (routeCoordinates.length > 1 ? routeCoordinates : routePlaces).map((place) => new kakao.maps.LatLng(place.lat, place.lng))
      if (route.length > 1) polylines = [new kakao.maps.Polyline({ map, path: route, strokeWeight: 4, strokeColor: '#1d9b77', strokeOpacity: .8, strokeStyle: 'dashed' })]
      setStatus(activeLocation ? '내 위치 중심으로 표시 중' : 'GPS 권한을 허용하면 내 위치 중심으로 이동합니다.')
    }).catch((error: unknown) => { if (!cancelled) setStatus(error instanceof Error ? error.message : '카카오맵을 불러오지 못했습니다.') })
    return () => {
      cancelled = true
      markers.forEach((marker) => marker.setMap(null))
      polylines.forEach((line) => line.setMap(null))
      infoWindows.forEach((info) => info.close())
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
