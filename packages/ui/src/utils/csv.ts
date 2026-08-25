export interface CsvParseResult {
  firstName: string
  lastName: string
  role?: string
  email?: string
  phone?: string
  telegramUsername?: string
  sectionName?: string | null
  speakerClassNames?: string[]
  assistantClassNames?: string[]
  rcClassNames?: string[]
  [key: string]: any
}

const normalizeStr = (str: string): string => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const isPureBooleanTrue = (val?: string | null): boolean => {
  if (!val) return false
  const clean = normalizeStr(val)
  return ['true', '1', 'yes', 'y', 'oui', 'o', 'vrai', 'v', 'x', 'checked', 't'].includes(clean)
}

const isFalsy = (val?: string | null): boolean => {
  if (!val) return true
  const clean = normalizeStr(val)
  return ['false', '0', 'no', 'n', 'non', 'faux', 'f', 'null', 'undefined', ''].includes(clean)
}

const isTruthy = (val?: string | null): boolean => {
  if (!val) return false
  return isPureBooleanTrue(val)
}

const extractClassNames = (cellValue?: string | null): string[] => {
  if (!cellValue || isFalsy(cellValue) || isPureBooleanTrue(cellValue)) {
    return []
  }
  // Split multiple class names by comma, semicolon, slash, or pipe
  return cellValue
    .split(/[,;/|]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !isPureBooleanTrue(s) && !isFalsy(s))
}

const BOOLEAN_ROLE_COLUMNS: Array<{ label: string; aliases: string[] }> = [
  { label: 'Staff Catering', aliases: ['staff catering', 'staffs catering', 'catering', 'nourriture', 'bouffe', 'cat'] },
  { label: 'Staff Logistique', aliases: ['staff logistique', 'staffs logistique', 'equipier logistique', 'logistique', 'log'] },
  { label: 'Staff Animation', aliases: ['staff animation', 'staffs animation', 'animation', 'anim'] },
  { label: 'Staff Comm', aliases: ['staff comm', 'staffs comm', 'staff communication', 'staffs communication', 'communication', 'comm', 'com'] },
  { label: 'Comité', aliases: ['comite', 'committee', 'org', 'orga'] },
]

const OTHER_ROLE_ALIASES = [
  'other',
  'others',
  'autre',
  'autres',
  'other roles',
  'other role',
  'autres roles',
  'autre role',
  'extra',
  'role extra',
  'roles extra',
  'divers',
]

/**
 * Robust CSV parser supporting automatic delimiter detection (comma or semicolon),
 * quoted values, RC/Speaker/Assistant class names strings, boolean role columns,
 * extra/custom role columns, and standard single-column roles.
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
  const normalizedHeaders = rawHeaders.map(normalizeStr)

  const getIndex = (aliases: string[]): number => {
    const normAliases = aliases.map(normalizeStr)
    return normalizedHeaders.findIndex((h) => normAliases.includes(h))
  }

  const firstNameIdx = getIndex(['firstname', 'prenom', 'first name', 'prenoms'])
  const lastNameIdx = getIndex(['lastname', 'nom', 'last name', 'noms', 'nom de famille'])
  const singleRoleIdx = getIndex(['role', 'role principal', 'fonction'])
  const emailIdx = getIndex(['email', 'mail', 'e mail', 'courriel', 'adresse email'])
  const phoneIdx = getIndex(['phone', 'telephone', 'tel', 'mobile', 'portable', 'numero'])
  const telegramIdx = getIndex(['telegram', 'telegramusername', 'username telegram', 'pseudo telegram'])
  const sectionIdx = getIndex(['section', 'sectionname', 'classe', 'groupe'])
  
  // Specific role columns for RC, Speaker, Assistant (which can contain class name strings)
  const rcIdx = getIndex(['rc', 'responsable classe', 'responsable de classe', 'responsable cours', 'responsable', 'classe rc', 'cours rc'])
  const speakerIdx = getIndex(['speaker', 'speakers', 'cours speaker', 'classes speaker', 'speaker classes', 'speaker cours'])
  const assistantIdx = getIndex(['assistant', 'assistante', 'assistants', 'ass', 'cours assistant', 'classes assistant', 'assistant classes'])
  
  const otherRoleIdx = getIndex(OTHER_ROLE_ALIASES)

  // Identify boolean role columns present in the headers
  const booleanRoleIndices: Array<{ label: string; index: number }> = []
  for (const roleDef of BOOLEAN_ROLE_COLUMNS) {
    const idx = getIndex(roleDef.aliases)
    if (idx !== -1 && idx !== singleRoleIdx) {
      booleanRoleIndices.push({ label: roleDef.label, index: idx })
    }
  }

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

    if (emailIdx !== -1 && row[emailIdx]) item.email = row[emailIdx]
    if (phoneIdx !== -1 && row[phoneIdx]) item.phone = row[phoneIdx]
    if (telegramIdx !== -1 && row[telegramIdx]) item.telegramUsername = row[telegramIdx]
    if (sectionIdx !== -1) item.sectionName = row[sectionIdx] || null

    // Determine roles and linked classes
    const activeRoles: string[] = []
    const speakerClassNames: string[] = []
    const assistantClassNames: string[] = []
    const rcClassNames: string[] = []

    // 1) Speaker column (string with class name(s) or boolean flag)
    if (speakerIdx !== -1 && row[speakerIdx]) {
      const cellVal = row[speakerIdx].trim()
      if (!isFalsy(cellVal)) {
        activeRoles.push('Speaker')
        speakerClassNames.push(...extractClassNames(cellVal))
      }
    }

    // 2) Assistant column (string with class name(s) or boolean flag)
    if (assistantIdx !== -1 && row[assistantIdx]) {
      const cellVal = row[assistantIdx].trim()
      if (!isFalsy(cellVal)) {
        activeRoles.push('Assistant')
        assistantClassNames.push(...extractClassNames(cellVal))
      }
    }

    // 3) RC column (string with class name or boolean flag)
    if (rcIdx !== -1 && row[rcIdx]) {
      const cellVal = row[rcIdx].trim()
      if (!isFalsy(cellVal)) {
        activeRoles.push('RC')
        rcClassNames.push(...extractClassNames(cellVal))
      }
    }

    // 4) Boolean role columns (Staffs Logistique, Staffs Catering, etc.)
    for (const boolRole of booleanRoleIndices) {
      if (isTruthy(row[boolRole.index])) {
        activeRoles.push(boolRole.label)
      }
    }

    // 5) Extra / other roles column
    if (otherRoleIdx !== -1 && row[otherRoleIdx]) {
      const extraVal = row[otherRoleIdx].trim()
      if (!isFalsy(extraVal) && !isPureBooleanTrue(extraVal)) {
        const extraSplit = extraVal.split(/[,;/]+/).map((s) => s.trim()).filter(Boolean)
        activeRoles.push(...extraSplit)
      }
    }

    // 6) Fallback to generic single role column if no roles were matched
    if (activeRoles.length === 0 && singleRoleIdx !== -1 && row[singleRoleIdx]) {
      const singleVal = row[singleRoleIdx].trim()
      if (singleVal) {
        const splitVal = singleVal.split(/[,;/]+/).map((s) => s.trim()).filter(Boolean)
        activeRoles.push(...splitVal)
      }
    }

    if (activeRoles.length > 0) {
      item.role = Array.from(new Set(activeRoles)).join(', ')
    }
    if (speakerClassNames.length > 0) {
      item.speakerClassNames = Array.from(new Set(speakerClassNames))
    }
    if (assistantClassNames.length > 0) {
      item.assistantClassNames = Array.from(new Set(assistantClassNames))
    }
    if (rcClassNames.length > 0) {
      item.rcClassNames = Array.from(new Set(rcClassNames))
    }

    results.push(item)
  }

  return results
}
