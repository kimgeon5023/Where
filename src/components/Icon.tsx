import type { ReactNode, SVGProps } from 'react'

export type IconName =
  | 'pin' | 'calendar' | 'users' | 'card' | 'transit' | 'car' | 'sun' | 'cloud' | 'rain'
  | 'friends' | 'heart' | 'family' | 'person' | 'cafe' | 'food' | 'photo' | 'nature'
  | 'activity' | 'shopping' | 'rest' | 'crowd' | 'mic' | 'pub' | 'fish' | 'arrow'
  | 'bed' | 'star' | 'clock' | 'route' | 'spark' | 'close' | 'check' | 'plus' | 'minus'

const paths: Partial<Record<IconName, ReactNode>> = {
  pin: <><path d="M12 21s7-6.2 7-12A7 7 0 0 0 5 9c0 5.8 7 12 7 12Z" /><circle cx="12" cy="9" r="2.2" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M7 3v4M17 3v4M3.5 9h17M8 13h2M14 13h2M8 16.5h2" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a2.6 2.6 0 0 1 0 5M17.5 13a4.3 4.3 0 0 1 3 4" /></>,
  card: <><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></>,
  transit: <><rect x="5" y="3" width="14" height="17" rx="4" /><path d="M5 13h14M8 7h2M14 7h2M8 17h.01M16 17h.01" /></>,
  car: <><path d="m5 17-1.2-4.5a2 2 0 0 1 1.9-2.5h12.6a2 2 0 0 1 1.9 2.5L19 17" /><path d="M4 17h16v2H4zM7 10l1.3-3h7.4l1.3 3M7 17h.01M17 17h.01" /></>,
  sun: <><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  cloud: <path d="M7.5 18h9a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.7 1A3.5 3.5 0 0 0 7.5 18Z" />,
  rain: <><path d="M7.5 14h9a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.7 1A3.5 3.5 0 0 0 7.5 14Z" /><path d="m8 17-1 3M13 17l-1 3M18 17l-1 3" /></>,
  friends: <><circle cx="9" cy="8" r="2.5" /><circle cx="16.5" cy="9" r="2" /><path d="M4 19a5 5 0 0 1 10 0M14 18a4 4 0 0 1 6 0" /></>,
  heart: <path d="M20 8.8c0 5.5-8 10-8 10s-8-4.5-8-10A4.2 4.2 0 0 1 12 6a4.2 4.2 0 0 1 8 2.8Z" />,
  family: <><circle cx="12" cy="6" r="2.2" /><circle cx="6" cy="9" r="1.8" /><circle cx="18" cy="9" r="1.8" /><path d="M8.5 19a3.5 3.5 0 0 1 7 0M2.5 18a3.5 3.5 0 0 1 7 0M14.5 18a3.5 3.5 0 0 1 7 0" /></>,
  person: <><circle cx="12" cy="7" r="3" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  cafe: <><path d="M5 9h12v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9ZM17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 4c0 1 1 1 1 2M12 4c0 1 1 1 1 2M16 4c0 1 1 1 1 2M4 21h15" /></>,
  food: <><path d="M4 3v8M7 3v8M4 7h3M5.5 11v10M15 3v18M15 3c3 2 3 6 0 8" /></>,
  photo: <><rect x="3" y="5" width="18" height="15" rx="2" /><circle cx="8.5" cy="10" r="1.5" /><path d="m4 17 4.5-4 3.5 3 2.5-2 5.5 5" /></>,
  nature: <><path d="M12 21V10" /><path d="M12 15c-4 0-6-2-6-6 4 0 6 2 6 6ZM12 13c0-4 2-6 6-6 0 4-2 6-6 6Z" /></>,
  activity: <><circle cx="12" cy="12" r="8.5" /><path d="m10 8 5 4-5 4V8Z" /></>,
  shopping: <><path d="M5 8h14l-1 12H6L5 8ZM8 9V6a4 4 0 0 1 8 0v3" /></>,
  rest: <><path d="M4 17v-5h16v5M4 17v3M20 17v3M5 12V9a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3M7 12V9h5v3" /></>,
  crowd: <><circle cx="12" cy="7" r="2.5" /><circle cx="5.5" cy="9" r="2" /><circle cx="18.5" cy="9" r="2" /><path d="M7 20a5 5 0 0 1 10 0M1.5 19a4 4 0 0 1 6-3M16.5 16a4 4 0 0 1 6 3" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 10a6.5 6.5 0 0 0 13 0M12 16v5M8.5 21h7" /></>,
  pub: <><path d="M9 3h6M10 3v5.5L5 18a2 2 0 0 0 1.7 3h10.6A2 2 0 0 0 19 18l-5-9.5V3M8 16h8" /></>,
  fish: <><path d="M3 12c3-5 9-5 14 0-5 5-11 5-14 0Z" /><path d="M17 12h4M7 10h.01" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  bed: <><path d="M4 19v-8M4 15h16v4M7 11V8h5a3 3 0 0 1 3 3M20 19v-6a2 2 0 0 0-2-2H4" /></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></>,
  route: <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h3a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3" /></>,
  spark: <path d="m12 2 1.4 6.6L20 10l-6.6 1.4L12 18l-1.4-6.6L4 10l6.6-1.4L12 2ZM19 16l.6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z" />,
  close: <path d="m6 6 12 12M18 6 6 18" />, check: <path d="m5 12 4 4L19 6" />, plus: <path d="M12 5v14M5 12h14" />, minus: <path d="M5 12h14" />,
}

export default function Icon({ name, size = 18, strokeWidth = 1.7, ...props }: { name: IconName; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>
}
