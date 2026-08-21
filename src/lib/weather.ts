export type WeatherCondition = 'sunny' | 'cloudy' | 'rain'

export interface Coordinates {
  lat: number
  lon: number
}

export interface CurrentWeather {
  cityName: string
  description: string
  temp: number
  feelsLike: number
  humidity: number
  windSpeed: number
  icon: string
  condition: WeatherCondition
  updatedAt: number
}

const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY as string | undefined
export const weatherApiConfigured = Boolean(apiKey)

function conditionFromWeatherId(id: number): WeatherCondition {
  if (id >= 200 && id < 700) return 'rain'
  if (id === 800) return 'sunny'
  return 'cloudy'
}

export async function fetchCurrentWeather(coordinates: Coordinates, signal?: AbortSignal): Promise<CurrentWeather> {
  if (!apiKey) throw new Error('OPENWEATHER_API_KEY_MISSING')

  const params = new URLSearchParams({
    lat: coordinates.lat.toFixed(6),
    lon: coordinates.lon.toFixed(6),
    appid: apiKey,
    units: 'metric',
    lang: 'kr',
  })
  const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?${params}`, { signal })
  const payload = await response.json() as { message?: string; name?: string; main?: { temp: number; feels_like: number; humidity: number }; wind?: { speed: number }; weather?: { id: number; description: string; icon: string }[] }

  if (!response.ok || !payload.main || !payload.weather?.[0]) {
    throw new Error(payload.message || 'WEATHER_REQUEST_FAILED')
  }

  const current = payload.weather[0]
  return {
    cityName: payload.name || '현재 위치',
    description: current.description,
    temp: Math.round(payload.main.temp),
    feelsLike: Math.round(payload.main.feels_like),
    humidity: payload.main.humidity,
    windSpeed: Math.round((payload.wind?.speed || 0) * 10) / 10,
    icon: current.icon,
    condition: conditionFromWeatherId(current.id),
    updatedAt: Date.now(),
  }
}
