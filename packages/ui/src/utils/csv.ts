export interface CsvParseResult {
  firstName: string
  lastName: string
  role?: string
  email?: string
  phone?: string
  telegramUsername?: string
  sectionName?: string | null
  [key: string]: any
}

/**
 * Robust CSV parser supporting automatic delimiter detection (comma or semicolon)
 * and quoted values.
 */
export function parseCSV(text: string): CsvParseResult[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length < 2) return []

  const firstLine = lines[0]
  const delimiter = firstLine.includes(';') ? ';' : ','

  const splitRow = (row: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < row.length; i++) {
      const char = row[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result.map((cell) => cell.replace(/^["']|["']$/g, '').trim())
  }

  const rawHeaders = splitRow(firstLine)
  const headers = rawHeaders.map((h) => h.toLowerCase())

  const getIndex = (names: string[]): number => {
    return headers.findIndex((h) => names.includes(h))
  }

  const firstNameIdx = getIndex(['firstname', 'prenom', 'prénom'])
  const lastNameIdx = getIndex(['lastname', 'nom'])
  const roleIdx = getIndex(['role', 'rôle'])
  const emailIdx = getIndex(['email'])
  const phoneIdx = getIndex(['phone', 'telephone', 'téléphone'])
  const telegramIdx = getIndex(['telegram', 'telegramusername'])
  const sectionIdx = getIndex(['section', 'sectionname', 'classe', 'groupe'])

  if (firstNameIdx === -1 || lastNameIdx === -1) {
    throw new Error(
      "Le fichier CSV doit contenir au moins les colonnes: 'prénom' (firstName) et 'nom' (lastName)."
    )
  }

  const results: CsvParseResult[] = []

  for (let i = 1; i < lines.length; i++) {
    const row = splitRow(lines[i])
    if (row.length < 2) continue

    const fName = row[firstNameIdx]
    const lName = row[lastNameIdx]

    if (!fName || !lName) continue

    const item: CsvParseResult = {
      firstName: fName,
      lastName: lName,
    }

    if (roleIdx !== -1 && row[roleIdx]) item.role = row[roleIdx]
    if (emailIdx !== -1 && row[emailIdx]) item.email = row[emailIdx]
    if (phoneIdx !== -1 && row[phoneIdx]) item.phone = row[phoneIdx]
    if (telegramIdx !== -1 && row[telegramIdx]) item.telegramUsername = row[telegramIdx]
    if (sectionIdx !== -1) item.sectionName = row[sectionIdx] || null

    results.push(item)
  }

  return results
}
