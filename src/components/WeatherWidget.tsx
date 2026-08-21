import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { fetchCurrentWeather, type Coordinates, type CurrentWeather, weatherApiConfigured, type WeatherCondition } from '../lib/weather'

type WeatherStatus = 'idle' | 'locating' | 'loading' | 'ready' | 'error'

interface WeatherWidgetProps {
  compact?: boolean
  onConditionChange?: (condition: WeatherCondition) => void
}

function formatUpdatedAt(timestamp: number) {
  return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit' }).format(timestamp)
}

function getErrorMessage(error: unknown) {
  if (error instanceof GeolocationPositionError) {
    if (error.code === error.PERMISSION_DENIED) return '브라우저에서 위치 권한을 허용해 주세요.'
    if (error.code === error.TIMEOUT) return '위치를 확인하는 데 시간이 걸리고 있어요. 다시 시도해 주세요.'
  }
  if (error instanceof Error && error.message === 'OPENWEATHER_API_KEY_MISSING') return 'VITE_OPENWEATHER_API_KEY를 .env에 설정해 주세요.'
  return '날씨를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'
}

export default function WeatherWidget({ compact = false, onConditionChange }: WeatherWidgetProps) {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null)
  const [weather, setWeather] = useState<CurrentWeather | null>(null)
  const [status, setStatus] = useState<WeatherStatus>('idle')
  const [error, setError] = useState('')
  const abortController = useRef<AbortController | null>(null)

  const refreshWeather = useCallback(async (nextCoordinates: Coordinates) => {
    abortController.current?.abort()
    const controller = new AbortController()
    abortController.current = controller
    setStatus('loading')
    setError('')
    try {
      const nextWeather = await fetchCurrentWeather(nextCoordinates, controller.signal)
      setWeather(nextWeather)
      setStatus('ready')
      onConditionChange?.(nextWeather.condition)
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') return
      setStatus('error')
      setError(getErrorMessage(requestError))
    }
  }, [onConditionChange])

  const connectLocation = useCallback(() => {
    if (!weatherApiConfigured) {
      setStatus('error')
      setError('VITE_OPENWEATHER_API_KEY를 .env에 설정해 주세요.')
      return
    }
    if (!navigator.geolocation) {
      setStatus('error')
      setError('이 브라우저에서는 GPS를 사용할 수 없어요.')
      return
    }
    setStatus('locating')
    setError('')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextCoordinates = { lat: position.coords.latitude, lon: position.coords.longitude }
        setCoordinates(nextCoordinates)
        void refreshWeather(nextCoordinates)
      },
      (positionError) => {
        setStatus('error')
        setError(getErrorMessage(positionError))
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 },
    )
  }, [refreshWeather])

  useEffect(() => {
    if (!coordinates) return
    const interval = window.setInterval(() => void refreshWeather(coordinates), 10 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [coordinates, refreshWeather])

  useEffect(() => () => abortController.current?.abort(), [])

  const isBusy = status === 'locating' || status === 'loading'
  const icon = weather?.condition === 'sunny' ? 'sun' : weather?.condition === 'rain' ? 'rain' : 'cloud'

  return (
    <section className={`weather-widget${compact ? ' weather-widget-compact' : ''}`}>
      <div className="weather-widget-head">
        <div>
          <span className="step-label">LIVE WEATHER</span>
          <h3>내 위치 실시간 날씨</h3>
        </div>
        <button type="button" className="weather-location-button" onClick={connectLocation} disabled={isBusy}>
          <Icon name="pin" size={14} />
          {isBusy ? '확인 중...' : coordinates ? '새로고침' : 'GPS 연결'}
        </button>
      </div>
      {weather && status === 'ready' ? (
        <div className="weather-live-content">
          <div className="weather-live-main"><span className="weather-live-icon"><Icon name={icon} size={26} /></span><div><strong>{weather.temp}°</strong><span>{weather.cityName} · {weather.description}</span></div></div>
          <div className="weather-live-meta"><span>체감 {weather.feelsLike}°</span><span>습도 {weather.humidity}%</span><span>바람 {weather.windSpeed}m/s</span><small>{formatUpdatedAt(weather.updatedAt)} 기준 · 10분마다 갱신</small></div>
        </div>
      ) : (
        <p className={`weather-widget-message${status === 'error' ? ' is-error' : ''}`}>{error || 'GPS를 연결하면 현재 위치의 날씨를 보여드려요.'}</p>
      )}
    </section>
  )
}
