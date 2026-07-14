import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { trpc } from '../trpc'
import '../../styles/students.css'
import '../../styles/dashboard.css'

export default function Students() {
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState<any>(null)
  const [createdStudentInfo, setCreatedStudentInfo] = useState<{ name: string; setupUrl: string } | null>(null)

  // Add Form State
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [sectionName, setSectionName] = useState('')

  // Edit Form State
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editSectionName, setEditSectionName] = useState('')

  const utils = trpc.useUtils()

  // Queries & Mutations
  const { data: students = [], isLoading } = trpc.students.list.useQuery()
  const { data: sections = [] } = trpc.students.listSections.useQuery()

  // Subscription for live updates
  trpc.students.onUpdated.useSubscription(undefined, {
    onData: () => {
      console.log('[DEBUG] Students subscription event: refetching list.')
      utils.students.list.invalidate()
    },
    onError: (err) => {
      console.error('[DEBUG] Students subscription error:', err)
    }
  })

  const createMutation = trpc.students.create.useMutation()
  const importMutation = trpc.students.importStudents.useMutation()
  const updateMutation = trpc.students.update.useMutation()
  const deleteMutation = trpc.students.delete.useMutation()
  const resetPasswordMutation = trpc.students.resetPassword.useMutation()

  const filteredStudents = students.filter((student) => {
    const sectionNameStr = student.section?.name || ''
    const searchString = `${student.firstName} ${student.lastName} ${student.email} ${sectionNameStr}`.toLowerCase()
    return searchString.includes(searchTerm.toLowerCase())
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const result = await createMutation.mutateAsync({
        firstName,
        lastName,
        email,
        sectionName: sectionName || null,
      })
      
      setShowAddModal(false)
      
      // Set the newly created student's invite details to show QR code
      setCreatedStudentInfo({
        name: `${firstName} ${lastName}`,
        setupUrl: result.setupUrl,
      })

      // Reset Form
      setFirstName('')
      setLastName('')
      setEmail('')
      setSectionName('')
      utils.students.list.invalidate()
    } catch (err: any) {
      console.error(err)
      alert("Erreur lors de la création: " + (err.message || err))
    }
  }

  const handleEditClick = (student: any) => {
    setEditingStudent(student)
    setEditFirstName(student.firstName)
    setEditLastName(student.lastName)
    setEditEmail(student.email)
    setEditSectionName(student.section?.name || '')
    setShowEditModal(true)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingStudent) return
    try {
      await updateMutation.mutateAsync({
        id: editingStudent.id,
        firstName: editFirstName,
        lastName: editLastName,
        email: editEmail,
        sectionName: editSectionName || null,
      })
      alert('Étudiant modifié avec succès !')
      setShowEditModal(false)
      setEditingStudent(null)
      utils.students.list.invalidate()
    } catch (err: any) {
      console.error(err)
      alert("Erreur lors de la modification: " + (err.message || err))
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cet étudiant ?')) return
    try {
      await deleteMutation.mutateAsync({ id })
      alert('Étudiant supprimé avec succès !')
      utils.students.list.invalidate()
    } catch (err: any) {
      console.error(err)
      alert("Erreur lors de la suppression: " + (err.message || err))
    }
  }

  const handleResetPassword = async () => {
    if (!editingStudent) return
    const msg = `Voulez-vous vraiment réinitialiser le mot de passe de ${editFirstName} ${editLastName} ?\nUn nouveau QR Code d'invitation sera généré.`
    if (!window.confirm(msg)) return

    try {
      const result = await resetPasswordMutation.mutateAsync({ id: editingStudent.id })
      setShowEditModal(false)
      setCreatedStudentInfo({
        name: `${editFirstName} ${editLastName}`,
        setupUrl: result.setupUrl,
      })
      setEditingStudent(null)
    } catch (err: any) {
      console.error(err)
      alert("Erreur lors de la réinitialisation: " + (err.message || err))
    }
  }

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    if (lines.length < 2) return []

    const firstLine = lines[0]
    const delimiter = firstLine.includes(';') ? ';' : ','

    const splitRow = (row: string) => {
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
      return result.map(cell => cell.replace(/^["']|["']$/g, '').trim())
    }

    const rawHeaders = splitRow(firstLine)
    const headers = rawHeaders.map(h => h.toLowerCase())

    const getIndex = (names: string[]) => {
      return headers.findIndex(h => names.includes(h))
    }

    const firstNameIdx = getIndex(['firstname', 'prenom', 'prénom'])
    const lastNameIdx = getIndex(['lastname', 'nom'])
    const emailIdx = getIndex(['email'])
    const sectionIdx = getIndex(['section', 'sectionname', 'classe', 'groupe'])

    if (firstNameIdx === -1 || lastNameIdx === -1 || emailIdx === -1) {
      throw new Error("Le fichier CSV doit contenir au moins les colonnes: 'prénom' (firstName), 'nom' (lastName), et 'email'.")
    }

    const results = []

    for (let i = 1; i < lines.length; i++) {
      const row = splitRow(lines[i])
      if (row.length < 3) continue

      const fName = row[firstNameIdx]
      const lName = row[lastNameIdx]
      const mail = row[emailIdx]

      if (!fName || !lName || !mail) continue

      const sect = sectionIdx !== -1 ? row[sectionIdx] : null

      results.push({
        firstName: fName,
        lastName: lName,
        email: mail,
        sectionName: sect,
      })
    }

    return results
  }

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const text = event.target?.result as string
      if (!text) return

      try {
        const parsedData = parseCSV(text)
        if (parsedData.length === 0) {
          alert('Aucune donnée valide trouvée dans le CSV.')
          return
        }

        await importMutation.mutateAsync(parsedData)
        alert(`${parsedData.length} étudiants importés avec succès ! Les liens d'invitation ont été envoyés par email.`)
        utils.students.list.invalidate()
      } catch (err: any) {
        console.error(err)
        alert("Erreur lors de l'importation: " + (err.message || err))
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="students-page">
      <div className="students-header-row">
        <h1>Gestion des Étudiants</h1>
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>
          + Nouvel Étudiant
        </button>
        <div className="import-btn-container">
          <button className="btn-primary" style={{ background: 'var(--primary-purple-dark)' }}>
            📥 Importer CSV
          </button>
          <input
            type="file"
            accept=".csv"
            onChange={handleCsvImport}
            className="import-input"
          />
        </div>
      </div>

      <div className="search-controls">
        <input
          type="text"
          className="search-bar"
          placeholder="Rechercher par nom, prénom, email ou section..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="table-card">
        {isLoading ? (
          <p style={{ textAlign: 'center', padding: '2rem' }}>Chargement des étudiants...</p>
        ) : (
          <div className="table-container">
            <table className="student-table">
              <thead>
                <tr>
                  <th>Prénom</th>
                  <th>Nom</th>
                  <th>Email</th>
                  <th>Section</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((student) => (
                    <tr key={student.id} className="student-row">
                      <td>{student.firstName}</td>
                      <td>{student.lastName}</td>
                      <td>{student.email}</td>
                      <td>{student.section?.name || '—'}</td>
                      <td>
                        <div className="action-buttons">
                          <button className="btn-icon" onClick={() => handleEditClick(student)}>
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                          </button>
                          <button className="btn-icon delete" onClick={() => handleDelete(student.id)}>
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>
                      Aucun étudiant trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Link to="/" className="back-link">
        ← Retour au Tableau de bord
      </Link>

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Nouvel Étudiant</h2>
            <form onSubmit={handleCreate}>
              <label>
                Prénom
                <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </label>
              <label>
                Nom
                <input required value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </label>
              <label>
                Email
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label>
                Section
                <input
                  placeholder="Ex: CMS, IN, SC..."
                  value={sectionName}
                  onChange={(e) => setSectionName(e.target.value)}
                  list="sections-list"
                />
                <datalist id="sections-list">
                  {sections.map((s: any) => <option key={s.id} value={s.name} />)}
                </datalist>
              </label>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowAddModal(false)}>Annuler</button>
                <button type="submit" className="btn-primary" style={{ marginTop: 0 }}>Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Modifier l'Étudiant</h2>
            <form onSubmit={handleUpdate}>
              <label>
                Prénom
                <input required value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} />
              </label>
              <label>
                Nom
                <input required value={editLastName} onChange={(e) => setEditLastName(e.target.value)} />
              </label>
              <label>
                Email
                <input type="email" required value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              </label>
              <label>
                Section
                <input
                  placeholder="Ex: CMS, IN, SC..."
                  value={editSectionName}
                  onChange={(e) => setEditSectionName(e.target.value)}
                  list="sections-list"
                />
              </label>
              
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', border: '1px dashed var(--border-color)', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#666' }}>Sécurité :</span>
                <button 
                  type="button" 
                  onClick={handleResetPassword} 
                  disabled={resetPasswordMutation.isPending}
                  className="btn-primary" 
                  style={{ margin: 0, padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--primary-purple)' }}
                >
                  {resetPasswordMutation.isPending ? 'Réinitialisation...' : '🔄 Réinitialiser le mot de passe'}
                </button>
              </div>

              <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
                <button type="button" onClick={() => { setShowEditModal(false); setEditingStudent(null); }}>
                  Annuler
                </button>
                <button type="submit" className="btn-primary" style={{ marginTop: 0 }}>Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code / Invite link modal */}
      {createdStudentInfo && (
        <div className="modal-overlay">
          <div className="modal" style={{ textAlign: 'center' }}>
            <h2 style={{ color: 'var(--primary-purple-dark)', fontWeight: 700 }}>🔑 Inviter l'Étudiant</h2>
            <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem', lineHeight: '1.4' }}>
              Scannez le QR Code ci-dessous pour configurer le mot de passe de <strong>{createdStudentInfo.name}</strong>, ou copiez le lien d'invitation :
            </p>
            
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(createdStudentInfo.setupUrl)}`}
              alt="QR Code d'invitation"
              style={{ display: 'block', margin: '1.5rem auto', border: '1px solid #ddd', padding: '0.5rem', borderRadius: '0.5rem', background: 'white' }}
            />

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <input 
                type="text" 
                readOnly 
                value={createdStudentInfo.setupUrl} 
                style={{ flex: 1, padding: '0.5rem', border: '1px solid #ddd', borderRadius: '0.4rem', fontSize: '0.8rem', background: '#f5f5f5' }}
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button 
                type="button" 
                className="btn-primary" 
                style={{ margin: 0, padding: '0.5rem 1rem' }}
                onClick={() => {
                  navigator.clipboard.writeText(createdStudentInfo.setupUrl)
                  alert('Lien copié dans le presse-papier !')
                }}
              >
                Copier
              </button>
            </div>

            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button type="button" className="btn-primary" style={{ margin: 0 }} onClick={() => setCreatedStudentInfo(null)}>
                Terminer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
