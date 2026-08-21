import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import type { Place } from '../types'

function makeIcon(label: string, color: string) {
  return L.divIcon({
    className: 'custom-map-marker',
    html: '<div style="background:' + color + '">' + label + '</div>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

const colors: Record<Place['category'], string> = {
  tour: '#1d9b77', photo: '#7b62c7', cafe: '#d48b48', food: '#e36b4e', activity: '#e05991', lodging: '#4d76bd',
}

export default function MapView({ places, center, routePlaces = places }: { places: Place[]; center: [number, number]; routePlaces?: Place[] }) {
  const positions = routePlaces.map((place) => [place.lat, place.lng] as [number, number])
  return (
    <MapContainer center={center} zoom={12} scrollWheelZoom={false} className="trip-map">
      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {positions.length > 1 && <Polyline positions={positions} pathOptions={{ color: '#1d9b77', weight: 4, opacity: 0.8, dashArray: '8 8' }} />}
      {places.map((place, index) => <Marker key={place.id} position={[place.lat, place.lng]} icon={makeIcon(String(index + 1), colors[place.category])}><Popup><strong>{place.name}</strong><br />{place.area} · {place.rating}점</Popup></Marker>)}
    </MapContainer>
  )
}
