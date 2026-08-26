export type Companion = 'friends' | 'couple' | 'family' | 'alone'
export type Transport = 'public' | 'car'
export type Weather = 'sunny' | 'rain' | 'cloudy'

export type Tag =
  | 'cafe' | 'foodie' | 'photo' | 'nature' | 'activity' | 'shopping'
  | 'rest' | 'sea' | 'crowded' | 'noraebang' | 'pub' | 'sashimi'

export type Category = 'tour' | 'photo' | 'cafe' | 'food' | 'activity' | 'lodging'

export interface MenuItem { name: string; price: number }
export interface LodgingInfo {
  pricePerNight: number
  capacity: number
  parking: boolean
  bed: string
}

export interface Place {
  id: string
  name: string
  area: string
  category: Category
  lat: number
  lng: number
  distanceKm?: number
  tags: Tag[]
  groupFit: Companion[]
  indoor: boolean
  price: number
  durationMin: number
  rating: number
  reviewCount?: number
  description: string
  image: string
  accent: string
  menu?: MenuItem[]
  lodging?: LodgingInfo
}

export interface TripRequest {
  start: string
  dateStart: string
  dateEnd: string
  companion: Companion
  headcount: number
  budgetPerPerson: number
  transport: Transport
  likes: Tag[]
  dislikes: Tag[]
  weather: Weather
}
