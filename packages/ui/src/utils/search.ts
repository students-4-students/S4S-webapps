/**
 * Normalizes text for search comparison:
 * - lowercase
 * - removes accents/diacritics (é -> e, etc.)
 * - removes whitespace and punctuation (spaces, dashes, dots, etc.)
 */
export function normalizeSearchText(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\-_./\\,]/g, '')
}

/**
 * Checks if a candidate string matches a query with space-insensitive and accent-insensitive matching.
 * E.g. "CM 1 1" matches "CM11", "CM 11", "cm11", "cm 1 1", etc.
 */
export function matchesSearch(source: string | null | undefined, query: string): boolean {
  if (!query || !query.trim()) return true
  if (!source) return false

  const rawSource = source.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const rawQuery = query.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  if (rawSource.includes(rawQuery)) return true

  const normSource = normalizeSearchText(source)
  const normQuery = normalizeSearchText(query)

  if (!normQuery) return true
  return normSource.includes(normQuery)
}
