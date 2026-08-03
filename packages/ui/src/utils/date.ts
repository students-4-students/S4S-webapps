/**
 * Format a start and end time range in French (Switzerland) locale.
 * Handles same-day formatting nicely (e.g., "lun. 26 août 08:00 - 10:00").
 */
export function formatDateTimeRange(
  startTimeVal: string | Date,
  endTimeVal: string | Date,
  locale = 'fr-CH'
): string {
  const start = new Date(startTimeVal)
  const end = new Date(endTimeVal)

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return ''

  const isSameDay = start.toDateString() === end.toDateString()

  const startStr = start.toLocaleString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  if (isSameDay) {
    const endStr = end.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    })
    return `${startStr} - ${endStr}`
  } else {
    const endStr = end.toLocaleString(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
    return `${startStr} - ${endStr}`
  }
}

/**
 * Convert Date or string to 'YYYY-MM-DDTHH:mm' local string for datetime-local input controls.
 */
export function toLocalDatetimeString(dateVal: Date | string): string {
  const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => n.toString().padStart(2, '0')
  const year = d.getFullYear()
  const month = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  const hours = pad(d.getHours())
  const minutes = pad(d.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

/**
 * Convert local datetime string to ISO string.
 */
export function toISOStringFromLocal(localStr: string): string {
  const d = new Date(localStr)
  return d.toISOString()
}
