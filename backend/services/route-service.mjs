export function distanceKm(a, b) {
  const radians = (value) => value * Math.PI / 180
  const dLat = radians(b.lat - a.lat)
  const dLng = radians(b.lng - a.lng)
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

export function estimatedTravelMinutes(a, b, transport) {
  const speed = transport === 'walk' ? 4.5 : transport === 'public' ? 18 : 32
  return Math.max(1, distanceKm(a, b) / speed * 60)
}

export function routeMinutes(start, places, transport) {
  return places.reduce((total, place, index) => total + estimatedTravelMinutes(index ? places[index - 1] : start, place, transport), 0)
}

export function optimizePlaces(start, places, transport) {
  if (places.length <= 8) {
    let best = null
    const visit = (remaining, ordered) => {
      if (!remaining.length) {
        const minutes = routeMinutes(start, ordered, transport)
        if (!best || minutes < best.minutes) best = { ordered, minutes }
        return
      }
      for (let index = 0; index < remaining.length; index += 1) visit([...remaining.slice(0, index), ...remaining.slice(index + 1)], [...ordered, remaining[index]])
    }
    visit(places, [])
    return best?.ordered || []
  }
  const remaining = [...places]
  const ordered = []
  let current = start
  while (remaining.length) {
    const nextIndex = remaining.reduce((best, place, index) => estimatedTravelMinutes(current, place, transport) < estimatedTravelMinutes(current, remaining[best], transport) ? index : best, 0)
    current = remaining.splice(nextIndex, 1)[0]
    ordered.push(current)
  }
  return ordered
}
