import { useEffect } from 'react'
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import type { LatLngExpression } from 'leaflet'
import type { Place } from '../types'

type Location = { lat: number; lng: number }

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap()

  useEffect(() => {
    map.setView(center)
  }, [center, map])

  return null
}

export default function MapView({ places, center, routePlaces = places, userLocation }: { places: Place[]; center: [number, number]; routePlaces?: Place[]; userLocation?: Location | null }) {
  const route: LatLngExpression[] = routePlaces.map((place) => [place.lat, place.lng])

  return (
    <div className="trip-map leaflet-map-wrap">
      <MapContainer center={center} zoom={13} scrollWheelZoom className="leaflet-map">
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <RecenterMap center={center} />
        {route.length > 1 && <Polyline positions={route} pathOptions={{ color: '#1d9b77', weight: 4, dashArray: '8 8' }} />}
        {places.map((place, index) => (
          <CircleMarker key={place.id} center={[place.lat, place.lng]} radius={10} pathOptions={{ color: '#fff', weight: 3, fillColor: '#1d9b77', fillOpacity: .95 }}>
            <Popup><strong>{index + 1}. {place.name}</strong><br />{place.area} · {place.price > 0 ? `${place.price.toLocaleString()}원` : '무료'}</Popup>
          </CircleMarker>
        ))}
        {userLocation && <CircleMarker center={[userLocation.lat, userLocation.lng]} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: '#e06b57', fillOpacity: .95 }}><Popup>내 현재 위치</Popup></CircleMarker>}
      </MapContainer>
      <span className="map-gps-status">지도를 움직여 주변 장소를 확인해보세요</span>
    </div>
  )
}
