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
// A provider is always available: OpenWeather is optional and Open-Meteo is the keyless fallback.
export const weatherApiConfigured = true

function conditionFromWeatherId(id: number): WeatherCondition {
  if (id >= 200 && id < 700) return 'rain'
  if (id === 800) return 'sunny'
  return 'cloudy'
}

export async function fetchCurrentWeather(coordinates: Coordinates, signal?: AbortSignal): Promise<CurrentWeather> {
  if (!apiKey) return fetchOpenMeteoWeather(coordinates, signal)

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

function conditionFromOpenMeteoCode(code: number): WeatherCondition {
  if ([0, 1].includes(code)) return 'sunny'
  if (code >= 51) return 'rain'
  return 'cloudy'
}

function descriptionFromOpenMeteoCode(code: number) {
  if (code === 0) return '맑음'
  if (code <= 3) return '구름 조금'
  if (code <= 48) return '흐림'
  if (code <= 67 || code >= 80) return '비'
  if (code <= 77) return '눈'
  return '흐림'
}

async function fetchOpenMeteoWeather(coordinates: Coordinates, signal?: AbortSignal): Promise<CurrentWeather> {
  const params = new URLSearchParams({
    latitude: coordinates.lat.toFixed(6),
    longitude: coordinates.lon.toFixed(6),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
    timezone: 'auto',
  })
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal })
  const payload = await response.json() as { current?: { temperature_2m: number; relative_humidity_2m: number; apparent_temperature: number; weather_code: number; wind_speed_10m: number } }
  if (!response.ok || !payload.current) throw new Error('WEATHER_REQUEST_FAILED')
  const current = payload.current
  return {
    cityName: '현재 위치',
    description: descriptionFromOpenMeteoCode(current.weather_code),
    temp: Math.round(current.temperature_2m),
    feelsLike: Math.round(current.apparent_temperature),
    humidity: current.relative_humidity_2m,
    windSpeed: Math.round(current.wind_speed_10m * 10) / 10,
    icon: '',
    condition: conditionFromOpenMeteoCode(current.weather_code),
    updatedAt: Date.now(),
  }
}
