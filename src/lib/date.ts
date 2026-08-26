function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function toDateIso(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function isoDate(offsetDays = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return toDateIso(date)
}

export function shiftIsoDate(iso: string, days: number) {
  const date = new Date(iso + 'T00:00:00')
  if (Number.isNaN(date.getTime())) return iso
  date.setDate(date.getDate() + days)
  return toDateIso(date)
}

export function diffIsoDays(startIso: string, endIso: string) {
  const start = new Date(startIso + 'T00:00:00').getTime()
  const end = new Date(endIso + 'T00:00:00').getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return 0
  return Math.round((end - start) / 86400000)
}
