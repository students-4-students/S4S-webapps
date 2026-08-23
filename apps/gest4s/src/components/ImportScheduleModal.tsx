import React, { useState, useRef } from 'react'
import { Modal, Button } from '@s4s/ui'
import { trpc } from '../trpc'

interface Props {
  onClose: () => void
  onSuccess?: () => void
}

export default function ImportScheduleModal({ onClose, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [parsedSlots, setParsedSlots] = useState<any[] | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [replaceAll, setReplaceAll] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const utils = trpc.useUtils()
  const importMutation = trpc.schedules.importSchedule.useMutation()

  const parseCSVRows = (text: string): any[] => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (lines.length < 2) {
      throw new Error('Le fichier CSV doit contenir une ligne d’en-tête et au moins une ligne de données.')
    }

    const firstLine = lines[0]
    const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ','

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
      return headers.findIndex((h) => names.some((n) => h.includes(n)))
    }

    const titleIdx = getIndex(['titre', 'title', 'nom', 'name', 'cours', 'coursename'])
    const descIdx = getIndex(['description', 'desc', 'details', 'remarque'])
    const typeIdx = getIndex(['type', 'categorie', 'catégorie'])
    const startIdx = getIndex(['start', 'starttime', 'debut', 'début', 'heuredebut', 'heure_debut', 'heure début'])
    const endIdx = getIndex(['end', 'endtime', 'fin', 'heurefin', 'heure_fin', 'heure fin'])
    const locIdx = getIndex(['lieu', 'location', 'salle', 'room', 'local'])
    const sectionsIdx = getIndex(['section', 'sections', 'classe', 'classes', 'groupe'])
    const groupIdx = getIndex(['targetgroup', 'groupe_cible', 'groupe', 'group'])
    const speakerIdx = getIndex(['speaker', 'prof', 'enseignant', 'intervenant'])
    const assistantIdx = getIndex(['assistant', 'assistanat'])
    const rcIdx = getIndex(['rc', 'responsable'])

    if (titleIdx === -1) {
      throw new Error("Le fichier CSV doit contenir une colonne 'Titre' ou 'Nom'.")
    }
    if (startIdx === -1 || endIdx === -1) {
      throw new Error("Le fichier CSV doit contenir des colonnes 'HeureDébut' (Start) et 'HeureFin' (End).")
    }

    const slots: any[] = []

    for (let i = 1; i < lines.length; i++) {
      const row = splitRow(lines[i])
      if (row.length === 0 || !row[titleIdx]) continue

      const title = row[titleIdx]
      const startTime = row[startIdx]
      const endTime = row[endIdx]

      if (!title || !startTime || !endTime) continue

      const startDate = new Date(startTime)
      const endDate = new Date(endTime)

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error(`Format de date invalide à la ligne ${i + 1}: début "${startTime}", fin "${endTime}"`)
      }

      const desc = descIdx !== -1 ? row[descIdx] : null
      const type = typeIdx !== -1 ? row[typeIdx] : 'LECTURE'
      const loc = locIdx !== -1 ? row[locIdx] : null
      const rawSections = sectionsIdx !== -1 ? row[sectionsIdx] : null
      const targetGroup = groupIdx !== -1 ? row[groupIdx] : null
      const speaker = speakerIdx !== -1 ? row[speakerIdx] : null
      const assistant = assistantIdx !== -1 ? row[assistantIdx] : null
      const rc = rcIdx !== -1 ? row[rcIdx] : null

      const sections = rawSections
        ? rawSections.split(/[,;/+]+/).map((s: string) => s.trim()).filter(Boolean)
        : []

      slots.push({
        title,
        description: desc,
        type: type || 'LECTURE',
        startTime: startDate,
        endTime: endDate,
        location: loc,
        sections,
        targetGroup: targetGroup || null,
        speakerName: speaker || null,
        assistantName: assistant || null,
        rcName: rc || null,
      })
    }

    return slots
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setParseError(null)
    setParsedSlots(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (!content) {
        setParseError('Le fichier est vide.')
        return
      }

      try {
        if (selectedFile.name.endsWith('.json') || content.trim().startsWith('[') || content.trim().startsWith('{')) {
          let jsonData = JSON.parse(content)
          if (!Array.isArray(jsonData)) {
            if (Array.isArray(jsonData.slots)) {
              jsonData = jsonData.slots
            } else if (Array.isArray(jsonData.schedule)) {
              jsonData = jsonData.schedule
            } else {
              throw new Error("Le fichier JSON doit être une liste de créneaux (tableau d'objets).")
            }
          }

          if (jsonData.length === 0) {
            throw new Error('Le tableau JSON ne contient aucun créneau.')
          }

          // Validate dates
          for (let idx = 0; idx < jsonData.length; idx++) {
            const item = jsonData[idx]
            if (!item.title) {
              throw new Error(`Créneau #${idx + 1} manquant de titre.`)
            }
            if (!item.startTime || !item.endTime) {
              throw new Error(`Créneau #${idx + 1} "${item.title}" manque d'heure de début ou de fin.`)
            }
            const sDate = new Date(item.startTime)
            const eDate = new Date(item.endTime)
            if (isNaN(sDate.getTime()) || isNaN(eDate.getTime())) {
              throw new Error(`Date invalide pour le créneau #${idx + 1} "${item.title}".`)
            }
          }

          setParsedSlots(jsonData)
        } else {
          // Attempt CSV parse
          const csvSlots = parseCSVRows(content)
          if (csvSlots.length === 0) {
            throw new Error('Aucun créneau valide trouvé dans le fichier CSV.')
          }
          setParsedSlots(csvSlots)
        }
      } catch (err: any) {
        console.error(err)
        setParseError(err.message || 'Erreur lors de la lecture du fichier.')
        setParsedSlots(null)
      }
    }

    reader.readAsText(selectedFile, 'UTF-8')
  }

  const handleImport = async () => {
    if (!parsedSlots || parsedSlots.length === 0) {
      alert('Veuillez d’abord sélectionner un fichier valide.')
      return
    }

    if (replaceAll) {
      const confirmReplace = window.confirm(
        '⚠️ ATTENTION : Vous avez choisi de REMPLACER TOUT le planning.\nTous les cours existants seront supprimés et remplacés par ceux du fichier.\n\nConfirmer le remplacement total ?'
      )
      if (!confirmReplace) return
    }

    setIsSubmitting(true)
    try {
      const res = await importMutation.mutateAsync({
        replaceAll,
        slots: parsedSlots,
      })

      alert(`✅ Importation réussie ! ${res.count} créneaux ont été importés dans le planning.`)
      await utils.schedules.list.invalidate()
      if (onSuccess) onSuccess()
      onClose()
    } catch (err: any) {
      console.error(err)
      alert(`❌ Erreur lors de l'importation: ` + (err.message || err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Importer les données du planning">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', color: '#f8fafc' }}>
        <p style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.75)', margin: 0 }}>
          Sélectionnez un fichier <strong>JSON</strong> ou <strong>CSV</strong> contenant les données de créneaux / cours du planning.
        </p>

        {/* File Input Box */}
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: '2px dashed rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            padding: '1.5rem',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            transition: 'border-color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)')}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv,text/csv,application/json"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
            {file ? file.name : 'Cliquez pour choisir un fichier JSON ou CSV'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '0.25rem' }}>
            {file ? `${(file.size / 1024).toFixed(1)} Ko` : 'Formats supportés : .json, .csv'}
          </div>
        </div>

        {/* Error message */}
        {parseError && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#fca5a5',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              fontSize: '0.875rem',
            }}
          >
            ⚠️ {parseError}
          </div>
        )}

        {/* Preview of detected slots */}
        {parsedSlots && (
          <div
            style={{
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              padding: '0.85rem 1rem',
              borderRadius: '6px',
            }}
          >
            <div style={{ fontWeight: 600, color: '#a5b4fc', marginBottom: '0.25rem' }}>
              ✓ {parsedSlots.length} créneau(x) détecté(s)
            </div>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)' }}>
              Aperçu : {parsedSlots.slice(0, 3).map((s) => s.title).join(', ')}
              {parsedSlots.length > 3 ? ` et ${parsedSlots.length - 3} autres...` : ''}
            </div>
          </div>
        )}

        {/* Import Mode Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0' }}>Mode d'importation :</label>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              background: 'rgba(255, 255, 255, 0.04)',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="importMode"
                checked={!replaceAll}
                onChange={() => setReplaceAll(false)}
                style={{ marginTop: '0.2rem' }}
              />
              <div>
                <span style={{ fontWeight: 500, color: '#f8fafc' }}>➕ Ajouter / Fusionner</span>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                  Conserve les créneaux existants et ajoute les nouveaux créneaux du fichier.
                </p>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="importMode"
                checked={replaceAll}
                onChange={() => setReplaceAll(true)}
                style={{ marginTop: '0.2rem' }}
              />
              <div>
                <span style={{ fontWeight: 500, color: '#f87171' }}>🔄 Remplacer tout le planning</span>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                  Supprime tous les créneaux existants avant d'importer le contenu du fichier.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Actions Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={handleImport}
            disabled={!parsedSlots || parsedSlots.length === 0 || isSubmitting}
          >
            {isSubmitting ? 'Importation en cours...' : `Importer ${parsedSlots ? `(${parsedSlots.length})` : ''}`}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
