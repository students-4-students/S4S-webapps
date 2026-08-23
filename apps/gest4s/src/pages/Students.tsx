import { useState } from 'react'
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
  const [createdStudentInfo, setCreatedStudentInfo] = useState<{ id?: string; name: string; setupUrl: string } | null>(null)

  // Add Form State
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [sectionName, setSectionName] = useState('')
  const [firstDayGroup, setFirstDayGroup] = useState<'A' | 'B' | ''>('')

  // Edit Form State
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editSectionName, setEditSectionName] = useState('')
  const [editFirstDayGroup, setEditFirstDayGroup] = useState<'A' | 'B' | ''>('')

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
  const updateManyMutation = trpc.students.updateMany.useMutation()
  const deleteMutation = trpc.students.delete.useMutation()
  const resetPasswordMutation = trpc.students.resetPassword.useMutation()
  const sendWelcomeMutation = trpc.students.sendWelcome.useMutation()
  const sendPasswordResetEmailMutation = trpc.students.sendPasswordResetEmail.useMutation()
  const sendWelcomeToAllMutation = trpc.students.sendWelcomeToAll.useMutation()
  const exportCsvMutation = trpc.students.exportCsv.useMutation()

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
        firstDayGroup: (firstDayGroup as 'A' | 'B') || null,
      })

      setShowAddModal(false)

      // Set newly created student info for QR code modal
      setCreatedStudentInfo({
        id: result.student.id,
        name: `${firstName} ${lastName}`,
        setupUrl: result.setupUrl,
      })

      // Reset Form
      setFirstName('')
      setLastName('')
      setEmail('')
      setSectionName('')
      setFirstDayGroup('')
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
    setEditFirstDayGroup((student.firstDayGroup as 'A' | 'B') || '')
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
        firstDayGroup: (editFirstDayGroup as 'A' | 'B') || null,
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
        id: editingStudent.id,
        name: `${editFirstName} ${editLastName}`,
        setupUrl: result.setupUrl,
      })
      setEditingStudent(null)
    } catch (err: any) {
      console.error(err)
      alert('Erreur lors de la réinitialisation: ' + (err.message || err))
    }
  }

  const handleSendWelcome = async (student: any) => {
    if (student.welcomeEmailSentAt) {
      const firstConfirm = window.confirm(
        `Cet étudiant (${student.firstName} ${student.lastName}) a DÉJÀ reçu l'email de bienvenue le ${new Date(
          student.welcomeEmailSentAt
        ).toLocaleString('fr-CH')}.\n\nVoulez-vous quand même lui renvoyer un email ?`
      )
      if (!firstConfirm) return

      const secondConfirm = window.confirm(
        `⚠️ CONFIRMATION SECONDAIRE :\nÊtes-vous absolument sûr(e) de vouloir renvoyer l'email de bienvenue à ${student.firstName} ${student.lastName} ?`
      )
      if (!secondConfirm) return
    } else {
      const confirmMsg = `Envoyer l'email de bienvenue à ${student.firstName} ${student.lastName} (${student.email}) ?`
      if (!window.confirm(confirmMsg)) return
    }

    try {
      await sendWelcomeMutation.mutateAsync({ id: student.id })
      alert(`Email de bienvenue envoyé avec succès à ${student.email} !`)
      utils.students.list.invalidate()
    } catch (err: any) {
      console.error(err)
      alert("Erreur lors de l'envoi de l'email: " + (err.message || err))
    }
  }

  const handleSendWelcomeToAll = async () => {
    const pendingStudents = students.filter((s) => !s.welcomeEmailSentAt)
    if (pendingStudents.length === 0) {
      alert("Tous les étudiants ont déjà reçu l'email de bienvenue !")
      return
    }

    const confirmMsg = `Envoyer l'email de bienvenue aux ${pendingStudents.length} étudiant(s) qui ne l'ont PAS encore reçu ?`
    if (!window.confirm(confirmMsg)) return

    try {
      const res = await sendWelcomeToAllMutation.mutateAsync()
      if (res.errors.length > 0) {
        alert(`${res.sentCount}/${res.total} emails envoyés avec succès.\nErreurs :\n${res.errors.join('\n')}`)
      } else {
        alert(`Les emails de bienvenue ont été envoyés avec succès aux ${res.sentCount} étudiants !`)
      }
      utils.students.list.invalidate()
    } catch (err: any) {
      console.error(err)
      alert("Erreur lors de l'envoi global: " + (err.message || err))
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
        alert(`${formatted.length} étudiants importés avec succès !`)
        utils.students.list.invalidate()
      } catch (err: any) {
        console.error(err)
        alert("Erreur lors de l'importation: " + (err.message || err))
      }
    }
    reader.readAsText(file)
  }

  const setGroupForAllStudents = async () => {
    if (!window.confirm(`Voulez-vous vraiment définir le groupe du premier jour pour tous les étudiants ?`)) return

    try {
      const studentsToAssign = students.filter((s) => !s.firstDayGroup)
      if (studentsToAssign.length === 0) {
        alert('Tous les étudiants ont déjà un groupe défini.')
        return
      }

      // Group unassigned students by section key
      const bySection: Record<string, typeof students> = {}
      studentsToAssign.forEach((student) => {
        const key = student.section?.name || '__no_section__'
        if (!bySection[key]) bySection[key] = []
        bySection[key].push(student)
      })

      // Count existing A/B per section (including already-assigned students)
      const existingCounts: Record<string, { A: number; B: number }> = {}
      let totalExistingA = 0
      let totalExistingB = 0
      students.forEach((student) => {
        const key = student.section?.name || '__no_section__'
        if (!existingCounts[key]) existingCounts[key] = { A: 0, B: 0 }
        if (student.firstDayGroup === 'A') { existingCounts[key].A++; totalExistingA++ }
        else if (student.firstDayGroup === 'B') { existingCounts[key].B++; totalExistingB++ }
      })

      // Pass 1: floor the ideal newA per section.
      type SectionSplit = { key: string; unassigned: typeof students; floorA: number; hasRemainder: boolean }
      const splits: SectionSplit[] = []
      let totalFloorA = 0

      Object.entries(bySection).forEach(([key, unassigned]) => {
        const { A: existingA, B: existingB } = existingCounts[key] || { A: 0, B: 0 }
        const u = unassigned.length
        const raw = existingB - existingA + u
        const floorA = Math.max(0, Math.min(u, Math.floor(raw / 2)))
        const hasRemainder = raw % 2 !== 0
        splits.push({ key, unassigned, floorA, hasRemainder })
        totalFloorA += floorA
      })

      // Pass 2: decide how many of the "remainder" sections should round UP to minimise global imbalance.
      const totalUnassigned = studentsToAssign.length
      const targetNewA = Math.round((totalExistingB - totalExistingA + totalUnassigned) / 2)
      let extraABudget = Math.max(0, targetNewA - totalFloorA)

      const updatedStudents: { id: string; firstDayGroup: 'A' | 'B' }[] = []

      splits.forEach(({ unassigned, floorA, hasRemainder }) => {
        let newACount = floorA
        if (hasRemainder && extraABudget > 0) {
          newACount++
          extraABudget--
        }
        unassigned.forEach((student, i) => {
          updatedStudents.push({
            id: student.id,
            firstDayGroup: i < newACount ? 'A' : 'B',
          })
        })
      })

      // Update all students in a single mutation
      await updateManyMutation.mutateAsync(updatedStudents)
      alert('Groupes du premier jour mis à jour pour tous les étudiants.')
      utils.students.list.invalidate()
    } catch (err: any) {
      console.error(err)
      alert("Erreur lors de la mise à jour des groupes: " + (err.message || err))
    }
  }

  const handleExportCSV = async () => {
    try {
      const data = await exportCsvMutation.mutateAsync()
      if (data.length === 0) {
        alert('Aucun participant à exporter.')
        return
      }

      const escapeCell = (val: string | null | undefined) => {
        if (val == null) return ''
        const str = String(val)
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }

      const headers = ['e-mail', 'nom', 's4s-link', 'groupe', 'qr-code-url']
      const rows = data.map((item) => [
        escapeCell(item.email),
        escapeCell(item.nom),
        escapeCell(item.s4sLink),
        escapeCell(item.groupe),
        escapeCell(item.qrCodeUrl),
      ])

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `participants_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error(err)
      alert("Erreur lors de l'exportation CSV: " + (err.message || err))
    }
  }

  return (
    <div className="students-page">
      <PageHeader
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
            <Button
              variant="secondary"
              onClick={handleExportCSV}
              isLoading={exportCsvMutation.isPending}
            >
              📤 Exporter CSV
            </Button>
            <Button variant="secondary" onClick={() => setGroupForAllStudents()}>
              Définir les groupes du 1er jour
            </Button>
            <Button
              variant="secondary"
              onClick={handleSendWelcomeToAll}
              isLoading={sendWelcomeToAllMutation.isPending}
            >
              ✉️ Envoyer l'email à tous
            </Button>
          </div>
        }
      />

      <div className="table-card">
        {isLoading ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--s4s-text-muted)' }}>
            Chargement des étudiants...
          </p>
        ) : (
          <div className="table-container">
            <div className="search-controls" style={{ marginBottom: '1.25rem', width: '100%' }}>
              <SearchInput
                placeholder="Rechercher par nom, prénom, email ou section..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClear={() => setSearchTerm('')}
              />
            </div>
            <table className="student-table">
              <thead>
                <tr>
                  <th>Prénom</th>
                  <th>Nom</th>
                  <th>Email</th>
                  <th>Section</th>
                  <th>Groupe</th>
                  <th>Email envoyé</th>
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
                      <td>{student.firstDayGroup || '—'}</td>
                      <td>
                        {student.welcomeEmailSentAt ? (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: '#dcfce7',
                              color: '#15803d',
                            }}
                            title={`Envoyé le ${new Date(student.welcomeEmailSentAt).toLocaleString('fr-CH')}`}
                          >
                            ✓ Envoyé
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: '#f1f5f9',
                              color: '#64748b',
                            }}
                          >
                            Non envoyé
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn-icon"
                            title="Envoyer l'email de bienvenue"
                            onClick={() => handleSendWelcome(student)}
                          >
                            ✉️
                          </button>
                          <button className="btn-icon" title="Modifier" onClick={() => handleEditClick(student)}>
                            ✏️
                          </button>
                          <button className="btn-icon delete" title="Supprimer" onClick={() => handleDelete(student.id)}>
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--s4s-text-muted)', padding: '2rem' }}>
                      Aucun étudiant trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
          <div>
            <label className="s4s-label">Groupe du premier jour (optionnel)</label>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              {(['A', 'B'] as const).map((grp) => (
                <label key={grp} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="firstDayGroup"
                    value={grp}
                    checked={firstDayGroup === grp}
                    onChange={() => setFirstDayGroup(grp)}
                  />
                  <span style={{ fontWeight: 600 }}>{grp}</span>
                </label>
              ))}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="firstDayGroup"
                  value=""
                  checked={firstDayGroup === ''}
                  onChange={() => setFirstDayGroup('')}
                />
                <span style={{ color: 'var(--s4s-text-muted)', fontSize: '0.875rem' }}>Aucun</span>
              </label>
            </div>
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

          <div style={{ marginTop: '0.5rem' }}>
            <label className="s4s-label">Groupe du premier jour (optionnel)</label>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              {(['A', 'B'] as const).map((grp) => (
                <label key={grp} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="editFirstDayGroup"
                    value={grp}
                    checked={editFirstDayGroup === grp}
                    onChange={() => setEditFirstDayGroup(grp)}
                  />
                  <span style={{ fontWeight: 600 }}>{grp}</span>
                </label>
              ))}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="editFirstDayGroup"
                  value=""
                  checked={editFirstDayGroup === ''}
                  onChange={() => setEditFirstDayGroup('')}
                />
                <span style={{ color: 'var(--s4s-text-muted)', fontSize: '0.875rem' }}>Aucun</span>
              </label>
            </div>
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

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {createdStudentInfo.id && (
                <Button
                  variant="secondary"
                  style={{ flex: 1 }}
                  isLoading={sendPasswordResetEmailMutation.isPending}
                  onClick={async () => {
                    try {
                      await sendPasswordResetEmailMutation.mutateAsync({ id: createdStudentInfo.id! })
                      alert(`Email de réinitialisation envoyé avec succès à ${createdStudentInfo.name} !`)
                      utils.students.list.invalidate()
                    } catch (err: any) {
                      console.error(err)
                      alert("Erreur lors de l'envoi de l'email: " + (err.message || err))
                    }
                  }}
                >
                  ✉️ Envoyer l'email de réinitialisation
                </Button>
              )}
              <Button variant="primary" style={{ flex: 1 }} onClick={() => setCreatedStudentInfo(null)}>
                Terminer
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
