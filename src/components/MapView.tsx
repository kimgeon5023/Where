import { useEffect, useRef, useState } from 'react'
import type { Place } from '../types'

type KakaoMap = { setCenter: (latLng: KakaoLatLng) => void }
type KakaoLatLng = { getLat: () => number; getLng: () => number }
type KakaoMarker = { setMap: (map: KakaoMap | null) => void; setPosition: (position: KakaoLatLng) => void }
type KakaoInfoWindow = { open: (map: KakaoMap, marker: KakaoMarker) => void; close: () => void }
type KakaoPolyline = { setMap: (map: KakaoMap | null) => void }
type KakaoNamespace = { maps: { load: (callback: () => void) => void; Map: new (element: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap; LatLng: new (lat: number, lng: number) => KakaoLatLng; Marker: new (options: { map: KakaoMap; position: KakaoLatLng; title?: string }) => KakaoMarker; InfoWindow: new (options: { content: string; removable?: boolean }) => KakaoInfoWindow; Polyline: new (options: { map: KakaoMap; path: KakaoLatLng[]; strokeWeight: number; strokeColor: string; strokeOpacity: number; strokeStyle: string }) => KakaoPolyline; event: { addListener: (target: KakaoMarker, type: string, handler: () => void) => void } } }
declare global { interface Window { kakao?: KakaoNamespace } }
const scriptId = 'kakao-map-sdk'

function loadKakao(): Promise<KakaoNamespace> {
  if (window.kakao) return new Promise((resolve) => window.kakao?.maps.load(() => resolve(window.kakao as KakaoNamespace)))
  const key = import.meta.env.VITE_KAKAO_MAP_JS_KEY
  if (!key) return Promise.reject(new Error('VITE_KAKAO_MAP_JS_KEY가 설정되지 않았습니다.'))
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(scriptId)
    const script = (existing as HTMLScriptElement | null) ?? document.createElement('script')
    script.id = scriptId; script.async = true
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`
    script.addEventListener('load', () => window.kakao?.maps.load(() => resolve(window.kakao as KakaoNamespace)))
    script.addEventListener('error', () => reject(new Error('카카오맵 SDK를 불러오지 못했습니다.')))
    if (!existing) document.head.appendChild(script)
  })
}

export default function MapView({ places, center, routePlaces = places }: { places: Place[]; center: [number, number]; routePlaces?: Place[] }) {
  const elementRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState('카카오맵을 불러오는 중…')
  useEffect(() => {
    let cancelled = false; let watchId: number | undefined; let markers: KakaoMarker[] = []; let infoWindows: KakaoInfoWindow[] = []; let polylines: KakaoPolyline[] = []
    loadKakao().then((kakao) => {
      if (cancelled || !elementRef.current) return
      const map = new kakao.maps.Map(elementRef.current, { center: new kakao.maps.LatLng(center[0], center[1]), level: 7 })
      markers = places.map((place, index) => {
        const marker = new kakao.maps.Marker({ map, position: new kakao.maps.LatLng(place.lat, place.lng), title: place.name })
        const info = new kakao.maps.InfoWindow({ content: `<div style="padding:10px 12px;font-size:12px;line-height:1.5"><strong>${index + 1}. ${place.name}</strong><br>${place.area} · ${place.price > 0 ? `${place.price.toLocaleString()}원` : '무료/가격 미정'}</div>`, removable: true })
        kakao.maps.event.addListener(marker, 'click', () => { infoWindows.forEach((item) => item.close()); info.open(map, marker) }); infoWindows.push(info); return marker
      })
      const route = routePlaces.map((place) => new kakao.maps.LatLng(place.lat, place.lng))
      if (route.length > 1) polylines = [new kakao.maps.Polyline({ map, path: route, strokeWeight: 4, strokeColor: '#1d9b77', strokeOpacity: .8, strokeStyle: 'dashed' })]
      setStatus('GPS 위치를 확인하는 중…')
      if (!navigator.geolocation) return setStatus('이 브라우저에서는 GPS를 사용할 수 없습니다.')
      watchId = navigator.geolocation.watchPosition((position) => {
        const point = new kakao.maps.LatLng(position.coords.latitude, position.coords.longitude)
        const marker = new kakao.maps.Marker({ map, position: point, title: '내 위치' }); marker.setMap(map)
        map.setCenter(point); setStatus('내 위치 기준으로 표시 중')
      }, () => setStatus('GPS 권한이 없어 서울 추천 장소를 표시합니다.'), { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 })
    }).catch((error: unknown) => { if (!cancelled) setStatus(error instanceof Error ? error.message : '카카오맵을 불러오지 못했습니다.') })
    return () => { cancelled = true; if (watchId !== undefined) navigator.geolocation?.clearWatch(watchId); markers.forEach((marker) => marker.setMap(null)); polylines.forEach((line) => line.setMap(null)); infoWindows.forEach((info) => info.close()) }
  }, [center, places, routePlaces])
  return <div className="trip-map kakao-map-wrap"><div ref={elementRef} className="kakao-map-canvas" aria-label="카카오맵" /><span className="map-gps-status">{status}</span></div>
}
