import { useEffect, useRef, useState } from 'react'
import type { Place } from '../types'

type Location = { lat: number; lng: number }
type KakaoMap = { setCenter: (latLng: KakaoLatLng) => void }
type KakaoLatLng = object
type KakaoMarker = { setMap: (map: KakaoMap | null) => void; setPosition: (position: KakaoLatLng) => void }
type KakaoInfoWindow = { open: (map: KakaoMap, marker: KakaoMarker) => void; close: () => void }
type KakaoPolyline = { setMap: (map: KakaoMap | null) => void }
type KakaoNamespace = { maps: { load: (callback: () => void) => void; Map: new (element: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap; LatLng: new (lat: number, lng: number) => KakaoLatLng; Marker: new (options: { map: KakaoMap; position: KakaoLatLng; title?: string }) => KakaoMarker; InfoWindow: new (options: { content: string; removable?: boolean }) => KakaoInfoWindow; Polyline: new (options: { map: KakaoMap; path: KakaoLatLng[]; strokeWeight: number; strokeColor: string; strokeOpacity: number; strokeStyle: string }) => KakaoPolyline; event: { addListener: (target: KakaoMarker, type: string, handler: () => void) => void } } }
declare global { interface Window { kakao?: KakaoNamespace } }

const scriptId = 'kakao-map-sdk'

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

export default function MapView({ places, center, routePlaces = places, userLocation }: { places: Place[]; center: [number, number]; routePlaces?: Place[]; userLocation?: Location | null }) {
  const elementRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<KakaoMap | null>(null)
  const kakaoRef = useRef<KakaoNamespace | null>(null)
  const userMarkerRef = useRef<KakaoMarker | null>(null)
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
    if (!userMarkerRef.current) userMarkerRef.current = new kakaoRef.current.maps.Marker({ map: mapRef.current, position: point, title: '내 위치' })
    else userMarkerRef.current.setPosition(point)
    mapRef.current.setCenter(point)
    setStatus('내 위치 중심으로 표시 중')
  }, [activeLocation])

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
      if (activeLocation) userMarkerRef.current = new kakao.maps.Marker({ map, position: new kakao.maps.LatLng(activeLocation.lat, activeLocation.lng), title: '내 위치' })
      markers = places.map((place, index) => {
        const marker = new kakao.maps.Marker({ map, position: new kakao.maps.LatLng(place.lat, place.lng), title: place.name })
        const price = place.price > 0 ? `${place.price.toLocaleString()}원` : '가격 미정'
        const info = new kakao.maps.InfoWindow({ content: `<div style="padding:10px 12px;font-size:12px;line-height:1.5"><strong>${index + 1}. ${place.name}</strong><br>${place.area} · ${price}</div>`, removable: true })
        kakao.maps.event.addListener(marker, 'click', () => { infoWindows.forEach((item) => item.close()); info.open(map, marker) })
        infoWindows.push(info)
        return marker
      })
      const route = routePlaces.map((place) => new kakao.maps.LatLng(place.lat, place.lng))
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
  }, [center, places, routePlaces])

  return <div className="trip-map kakao-map-wrap"><div ref={elementRef} className="kakao-map-canvas" aria-label="카카오맵" /><span className="map-gps-status">{status}</span></div>
}
