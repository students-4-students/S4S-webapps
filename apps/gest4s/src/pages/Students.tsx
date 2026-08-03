import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { trpc } from '../trpc'
import {
  Modal,
  Button,
  Input,
  SearchInput,
  PageHeader,
  parseCSV,
} from '@s4s/ui'
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
      utils.students.list.invalidate()
    },
    onError: (err) => {
      console.error('[DEBUG] Students subscription error:', err)
    },
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

      // Set newly created student info for QR code modal
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
      alert('Erreur lors de la création: ' + (err.message || err))
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
      alert('Erreur lors de la modification: ' + (err.message || err))
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
      alert('Erreur lors de la suppression: ' + (err.message || err))
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
      alert('Erreur lors de la réinitialisation: ' + (err.message || err))
    }
  }

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const text = event.target?.result as string
      if (!text) return

      try {
        const rawParsed = parseCSV(text)
        if (rawParsed.length === 0) {
          alert('Aucune donnée valide trouvée dans le CSV.')
          return
        }

        const formatted = rawParsed.map((item) => ({
          firstName: item.firstName,
          lastName: item.lastName,
          email: item.email || '',
          sectionName: item.sectionName || null,
        }))

        await importMutation.mutateAsync(formatted)
        alert(
          `${formatted.length} étudiants importés avec succès ! Les liens d'invitation ont été envoyés par email.`
        )
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
      <PageHeader
        actions={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="primary" onClick={() => setShowAddModal(true)}>
              + Nouvel Étudiant
            </Button>
            <label style={{ margin: 0 }}>
              <span className="s4s-button s4s-button--secondary s4s-button--md" style={{ cursor: 'pointer' }}>
                📥 Importer CSV
              </span>
              <input
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={handleCsvImport}
              />
            </label>
          </div>
        }
      />

      <div className="search-controls" style={{ marginBottom: '1.25rem' }}>
        <SearchInput
          placeholder="Rechercher par nom, prénom, email ou section..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={() => setSearchTerm('')}
        />
      </div>

      <div className="table-card">
        {isLoading ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--s4s-text-muted)' }}>
            Chargement des étudiants...
          </p>
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
                            ✏️
                          </button>
                          <button className="btn-icon delete" onClick={() => handleDelete(student.id)}>
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--s4s-text-muted)', padding: '2rem' }}>
                      Aucun étudiant trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Link to="/" className="back-link" style={{ marginTop: '1.5rem', display: 'inline-block' }}>
        ← Retour au Tableau de bord
      </Link>

      {/* Add Student Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Nouvel Étudiant"
        size="md"
      >
        <form onSubmit={handleCreate}>
          <Input
            label="Prénom"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <Input
            label="Nom"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div className="s4s-form-field">
            <label className="s4s-label">Section</label>
            <input
              className="s4s-input"
              placeholder="Ex: CMS, IN, SC..."
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              list="sections-list"
            />
            <datalist id="sections-list">
              {sections.map((s: any) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="primary" isLoading={createMutation.isPending}>
              Créer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Student Modal */}
      <Modal
        isOpen={showEditModal && Boolean(editingStudent)}
        onClose={() => {
          setShowEditModal(false)
          setEditingStudent(null)
        }}
        title="Modifier l'Étudiant"
        size="md"
      >
        <form onSubmit={handleUpdate}>
          <Input
            label="Prénom"
            required
            value={editFirstName}
            onChange={(e) => setEditFirstName(e.target.value)}
          />
          <Input
            label="Nom"
            required
            value={editLastName}
            onChange={(e) => setEditLastName(e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            required
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
          />

          <div className="s4s-form-field">
            <label className="s4s-label">Section</label>
            <input
              className="s4s-input"
              placeholder="Ex: CMS, IN, SC..."
              value={editSectionName}
              onChange={(e) => setEditSectionName(e.target.value)}
              list="sections-list"
            />
          </div>

          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.75rem',
              border: '1px dashed var(--s4s-border)',
              borderRadius: '0.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--s4s-text-muted)' }}>Sécurité :</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetPassword}
              isLoading={resetPasswordMutation.isPending}
            >
              🔄 Réinitialiser le mot de passe
            </Button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowEditModal(false)
                setEditingStudent(null)
              }}
            >
              Annuler
            </Button>
            <Button type="submit" variant="primary" isLoading={updateMutation.isPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      </Modal>

      {/* QR Code / Invite link modal */}
      {createdStudentInfo && (
        <Modal
          isOpen={true}
          onClose={() => setCreatedStudentInfo(null)}
          title="🔑 Inviter l'Étudiant"
          size="sm"
        >
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--s4s-text-secondary)', marginTop: 0, lineHeight: '1.4' }}>
              Scannez le QR Code ci-dessous pour configurer le mot de passe de{' '}
              <strong>{createdStudentInfo.name}</strong>, ou copiez le lien d'invitation :
            </p>

            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                createdStudentInfo.setupUrl
              )}`}
              alt="QR Code d'invitation"
              style={{
                display: 'block',
                margin: '1.25rem auto',
                border: '1px solid var(--s4s-border)',
                padding: '0.5rem',
                borderRadius: '0.5rem',
                background: 'white',
              }}
            />

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <input
                type="text"
                readOnly
                value={createdStudentInfo.setupUrl}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  border: '1px solid var(--s4s-border)',
                  borderRadius: '0.4rem',
                  fontSize: '0.8rem',
                  background: '#f8fafc',
                }}
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(createdStudentInfo.setupUrl)
                  alert('Lien copié dans le presse-papier !')
                }}
              >
                Copier
              </Button>
            </div>

            <Button variant="primary" style={{ width: '100%' }} onClick={() => setCreatedStudentInfo(null)}>
              Terminer
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
