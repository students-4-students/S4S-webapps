import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { trpc } from '../trpc'
import '../../styles/staffs.css'
import '../../styles/dashboard.css'

const ROLES = [
  'Comité',
  'Équipier Logistique',
  'Équipier Catering',
  'Équipier IT',
  'Équipier Communication',
  'Assistant',
  'RC',
  'Speaker',
  'Staff Logistique',
  'Staff Catering',
  'Staff Animation',
]

function Staffs() {
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState<any>(null)

  // Add Form State
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [telegramUsername, setTelegramUsername] = useState('')
  const [score, setScore] = useState(0)
  const [selectedSpeakerSlotIds, setSelectedSpeakerSlotIds] = useState<string[]>([])
  const [selectedAssistantSlotIds, setSelectedAssistantSlotIds] = useState<string[]>([])
  const [selectedRcSlotIds, setSelectedRcSlotIds] = useState<string[]>([])

  // Edit Form State
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editSelectedRoles, setEditSelectedRoles] = useState<string[]>([])
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editTelegramUsername, setEditTelegramUsername] = useState('')
  const [editScore, setEditScore] = useState(0)
  const [editSpeakerSlotIds, setEditSpeakerSlotIds] = useState<string[]>([])
  const [editAssistantSlotIds, setEditAssistantSlotIds] = useState<string[]>([])
  const [editRcSlotIds, setEditRcSlotIds] = useState<string[]>([])

  const utils = trpc.useUtils()

  // Queries and Mutations
  const { data: staffs = [], isLoading } = trpc.staffs.list.useQuery()
  const { data: courses = [] } = trpc.schedules.list.useQuery()

  trpc.staffs.onUpdated.useSubscription(undefined, {
    onData: () => {
      console.log('[DEBUG] Staffs page subscription event received! Invalidating staffs list.')
      utils.staffs.list.invalidate()
    },
    onError: (err) => {
      console.error('[DEBUG] Staffs page subscription error:', err)
    }
  })

  const createMutation = trpc.staffs.create.useMutation()
  const importMutation = trpc.staffs.importStaffs.useMutation()
  const updateMutation = trpc.staffs.update.useMutation()
  const deleteMutation = trpc.staffs.delete.useMutation()
  const assignToCoursesMutation = trpc.staffs.assignToCourses.useMutation()

  const filteredStaffs = staffs.filter((staff) => {
    const searchString = `${staff.firstName} ${staff.lastName} ${staff.role}`.toLowerCase()
    return searchString.includes(searchTerm.toLowerCase())
  })

  const getRowClass = (isPresent: boolean, status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE') => {
    if (!isPresent) return 'staff-row'
    switch (status) {
      case 'ACTIVE':
        return 'staff-row present-active'
      case 'ON_LEAVE':
        return 'staff-row present-on-leave'
      case 'INACTIVE':
        return 'staff-row present-inactive'
      default:
        return 'staff-row'
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedRoles.length === 0) {
      alert('Veuillez sélectionner au moins un rôle.')
      return
    }
    try {
      const newStaff = await createMutation.mutateAsync({
        firstName,
        lastName,
        role: selectedRoles.join(', '),
        status: 'ACTIVE',
        isPresent: false,
        email: email || null,
        phone: phone || null,
        score,
      })

      // Link newly selected courses
      await assignToCoursesMutation.mutateAsync({
        staffMemberId: newStaff.id,
        speakerSlotIds: selectedSpeakerSlotIds,
        assistantSlotIds: selectedAssistantSlotIds,
        rcSlotIds: selectedRcSlotIds,
      })

      alert('Membre du staff créé avec succès !')
      setShowAddModal(false)
      // Reset form
      setFirstName('')
      setLastName('')
      setSelectedRoles([])
      setEmail('')
      setPhone('')
      setTelegramUsername('')
      setScore(0)
      setSelectedSpeakerSlotIds([])
      setSelectedAssistantSlotIds([])
      setSelectedRcSlotIds([])

      utils.staffs.list.invalidate()
    } catch (err: any) {
      console.error(err)
      alert("Erreur lors de la création: " + (err.message || err))
    }
  }

  const handleEditClick = (staff: any) => {
    setEditingStaff(staff)
    setEditFirstName(staff.firstName)
    setEditLastName(staff.lastName)
    
    // Parse roles string to array
    const rolesArray = staff.role
      ? staff.role.split(',').map((r: string) => r.trim()).filter(Boolean)
      : []
    setEditSelectedRoles(rolesArray)
    
    setEditEmail(staff.email || '')
    setEditPhone(staff.phone || '')
    setEditTelegramUsername(staff.telegramUsername || '')
    setEditScore(staff.score || 0)

    // Parse existing course slot links
    setEditSpeakerSlotIds(staff.speakerSlots?.map((s: any) => s.id) || [])
    setEditAssistantSlotIds(staff.assistantSlots?.map((s: any) => s.id) || [])
    setEditRcSlotIds(staff.rcSlots?.map((s: any) => s.id) || [])

    setShowEditModal(true)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingStaff) return
    if (editSelectedRoles.length === 0) {
      alert('Veuillez sélectionner au moins un rôle.')
      return
    }
    try {
      await updateMutation.mutateAsync({
        id: editingStaff.id,
        firstName: editFirstName,
        lastName: editLastName,
        role: editSelectedRoles.join(', '),
        email: editEmail || null,
        phone: editPhone || null,
        telegramUsername: editTelegramUsername || null,
        score: editScore,
      })

      // Update course assignments
      await assignToCoursesMutation.mutateAsync({
        staffMemberId: editingStaff.id,
        speakerSlotIds: editSpeakerSlotIds,
        assistantSlotIds: editAssistantSlotIds,
        rcSlotIds: editRcSlotIds,
      })

      alert('Membre du staff modifié avec succès !')
      setShowEditModal(false)
      setEditingStaff(null)
      utils.staffs.list.invalidate()
    } catch (err: any) {
      console.error(err)
      alert("Erreur lors de la modification: " + (err.message || err))
    }
  }

  const handleInlineUpdate = async (id: string, fields: any) => {
    try {
      await updateMutation.mutateAsync({
        id,
        ...fields,
      })
      utils.staffs.list.invalidate()
    } catch (err: any) {
      console.error(err)
      alert("Erreur lors de la mise à jour: " + (err.message || err))
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Voulez-vous vraiment supprimer ce membre du staff ?')) return
    try {
      await deleteMutation.mutateAsync({ id })
      alert('Membre du staff supprimé avec succès !')
      utils.staffs.list.invalidate()
    } catch (err: any) {
      console.error(err)
      alert("Erreur lors de la suppression: " + (err.message || err))
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
    const roleIdx = getIndex(['role', 'rôle'])
    const emailIdx = getIndex(['email'])
    const phoneIdx = getIndex(['phone', 'telephone', 'téléphone'])
    const telegramIdx = getIndex(['telegram', 'telegramusername'])

    if (firstNameIdx === -1 || lastNameIdx === -1 || roleIdx === -1) {
      throw new Error("Le fichier CSV doit contenir au moins les colonnes: 'prénom' (firstName), 'nom' (lastName), et 'rôle' (role).")
    }

    const results = []

    for (let i = 1; i < lines.length; i++) {
      const row = splitRow(lines[i])
      if (row.length < 3) continue

      const fName = row[firstNameIdx]
      const lName = row[lastNameIdx]
      const r = row[roleIdx]

      if (!fName || !lName || !r) continue

      const mail = emailIdx !== -1 ? row[emailIdx] : undefined
      const tel = phoneIdx !== -1 ? row[phoneIdx] : undefined
      const telg = telegramIdx !== -1 ? row[telegramIdx] : undefined

      results.push({
        firstName: fName,
        lastName: lName,
        role: r,
        status: 'ACTIVE' as const,
        isPresent: false,
        email: mail,
        phone: tel,
        telegramUsername: telg,
        score: 0,
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
        alert(`${parsedData.length} membres du staff importés avec succès !`)
        utils.staffs.list.invalidate()
      } catch (err: any) {
        console.error(err)
        alert("Erreur lors de l'importation: " + (err.message || err))
      }
    }
    reader.readAsText(file)
  }

  const handleRoleToggle = (selectedList: string[], roleVal: string, setter: (val: string[]) => void) => {
    if (selectedList.includes(roleVal)) {
      setter(selectedList.filter((r) => r !== roleVal))
    } else {
      setter([...selectedList, roleVal])
    }
  }

  const getLinkedCoursesLabel = (staff: any) => {
    const isSpeaker = staff.role.toLowerCase().includes('speaker')
    const isAssistant = staff.role.toLowerCase().includes('assistant')
    const isRc = staff.role.toLowerCase().includes('rc')
    const courses: string[] = []

    if (isSpeaker && staff.speakerSlots && staff.speakerSlots.length > 0) {
      courses.push(...staff.speakerSlots.map((s: any) => `${s.title} (Speaker)`))
    }
    if (isAssistant && staff.assistantSlots && staff.assistantSlots.length > 0) {
      courses.push(...staff.assistantSlots.map((s: any) => `${s.title} (Assistant)`))
    }
    if (isRc && staff.rcSlots && staff.rcSlots.length > 0) {
      courses.push(...staff.rcSlots.map((s: any) => `${s.title} (RC)`))
    }

    return courses.length > 0 ? courses.join(', ') : '-'
  }

  const toggleCourseLink = (list: string[], courseId: string, setter: (val: string[]) => void) => {
    if (list.includes(courseId)) {
      setter(list.filter((id) => id !== courseId))
    } else {
      setter([...list, courseId])
    }
  }

  return (
    <div className="staffs-page">
      <div className="staffs-header-row">
        <h1>Staffs</h1>
      </div>

      <div className="search-controls">
        <input
          type="text"
          placeholder="🔍 Rechercher par nom, prénom ou rôle..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-bar"
        />
        <button className="btn-primary" onClick={() => setShowAddModal(true)} style={{ marginTop: 0 }}>
          + Ajouter
        </button>
        <label className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginTop: 0 }}>
          📥 Import CSV
          <input
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleCsvImport}
          />
        </label>
      </div>

      <div className="table-card">
        <div className="table-container">
          {isLoading ? (
            <p style={{ padding: '1rem', color: 'var(--primary-purple-dark)' }}>Chargement des membres du staff...</p>
          ) : filteredStaffs.length === 0 ? (
            <p style={{ padding: '1rem', color: 'var(--primary-purple-dark)' }}>Aucun membre du staff trouvé.</p>
          ) : (
            <table className="staff-table">
              <thead>
                <tr>
                  <th>Prénom</th>
                  <th>Nom</th>
                  <th>Rôle(s)</th>
                  <th>Statut</th>
                  <th>Présence</th>
                  <th>Telegram</th>
                  <th>Téléphone</th>
                  <th>Email</th>
                  <th style={{ textAlign: 'center', width: '100px' }}>Quêtes (Score)</th>
                  <th>Cours liés</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaffs.map((staff) => {
                  return (
                    <tr
                      key={staff.id}
                      className={getRowClass(staff.isPresent, staff.status)}
                    >
                      <td>{staff.firstName}</td>
                      <td>{staff.lastName}</td>
                      <td>{staff.role}</td>
                      <td>
                        <select
                          value={staff.status}
                          onChange={(e) => handleInlineUpdate(staff.id, { status: e.target.value })}
                        >
                          <option value="ACTIVE">Disponible</option>
                          <option value="ON_LEAVE">Occupé</option>
                          <option value="INACTIVE">Indisponible</option>
                        </select>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={staff.isPresent}
                          onChange={(e) => handleInlineUpdate(staff.id, { isPresent: e.target.checked })}
                        />
                      </td>
                      <td>{staff.telegramUsername || '-'}</td>
                      <td>{staff.phone || '-'}</td>
                      <td>{staff.email || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="action-btn"
                            onClick={() => handleInlineUpdate(staff.id, { score: Math.max(0, staff.score - 1) })}
                            style={{ fontSize: '0.8rem', padding: '0.1rem 0.4rem', background: 'rgba(0,0,0,0.08)', borderRadius: '0.25rem' }}
                          >
                            -
                          </button>
                          <span style={{ fontWeight: 600, minWidth: '1.2rem', textAlign: 'center' }}>{staff.score}</span>
                          <button
                            type="button"
                            className="action-btn"
                            onClick={() => handleInlineUpdate(staff.id, { score: staff.score + 1 })}
                            style={{ fontSize: '0.8rem', padding: '0.1rem 0.4rem', background: 'rgba(0,0,0,0.08)', borderRadius: '0.25rem' }}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td>{getLinkedCoursesLabel(staff)}</td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          className="action-btn"
                          title="Modifier"
                          onClick={() => handleEditClick(staff)}
                        >
                          ✏️
                        </button>
                        <button
                          className="action-btn"
                          title="Supprimer"
                          onClick={() => handleDelete(staff.id)}
                          style={{ marginLeft: '0.25rem' }}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Link to="/" className="back-link">
        ← Dashboard
      </Link>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2>Ajouter un membre</h2>
            <form onSubmit={handleCreate}>
              <label>
                Prénom *
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </label>

              <label>
                Nom *
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </label>

              <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Rôles * (Sélection multiple)</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
                  {ROLES.map((r) => (
                    <label key={r} style={{ flexDirection: 'row', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 'normal' }}>
                      <input
                        type="checkbox"
                        checked={selectedRoles.includes(r)}
                        onChange={() => handleRoleToggle(selectedRoles, r, setSelectedRoles)}
                      />
                      {r}
                    </label>
                  ))}
                </div>
              </div>

              {/* Speaker Slot Links */}
              {selectedRoles.some(r => r.toLowerCase().includes('speaker')) && (
                <div style={{ margin: '0.75rem 0' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Cours à enseigner (Speaker)</span>
                  {courses.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: '#888', fontStyle: 'italic', marginTop: '0.25rem' }}>Aucun cours disponible.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem', maxHeight: '120px', overflowY: 'auto', background: '#f5f5f5', padding: '0.4rem', borderRadius: '0.4rem' }}>
                      {courses.map(c => (
                        <label key={c.id} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'normal' }}>
                          <input
                            type="checkbox"
                            checked={selectedSpeakerSlotIds.includes(c.id)}
                            onChange={() => toggleCourseLink(selectedSpeakerSlotIds, c.id, setSelectedSpeakerSlotIds)}
                          />
                          {c.title}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Assistant Slot Links */}
              {selectedRoles.some(r => r.toLowerCase().includes('assistant')) && (
                <div style={{ margin: '0.75rem 0' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Cours à assister (Assistant)</span>
                  {courses.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: '#888', fontStyle: 'italic', marginTop: '0.25rem' }}>Aucun cours disponible.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem', maxHeight: '120px', overflowY: 'auto', background: '#f5f5f5', padding: '0.4rem', borderRadius: '0.4rem' }}>
                      {courses.map(c => (
                        <label key={c.id} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'normal' }}>
                          <input
                            type="checkbox"
                            checked={selectedAssistantSlotIds.includes(c.id)}
                            onChange={() => toggleCourseLink(selectedAssistantSlotIds, c.id, setSelectedAssistantSlotIds)}
                          />
                          {c.title}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* RC Slot Links */}
              {selectedRoles.some(r => r.toLowerCase().includes('rc')) && (
                <div style={{ margin: '0.75rem 0' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Cours à coordonner (RC)</span>
                  {courses.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: '#888', fontStyle: 'italic', marginTop: '0.25rem' }}>Aucun cours disponible.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem', maxHeight: '120px', overflowY: 'auto', background: '#f5f5f5', padding: '0.4rem', borderRadius: '0.4rem' }}>
                      {courses.map(c => (
                        <label key={c.id} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'normal' }}>
                          <input
                            type="checkbox"
                            checked={selectedRcSlotIds.includes(c.id)}
                            onChange={() => toggleCourseLink(selectedRcSlotIds, c.id, setSelectedRcSlotIds)}
                          />
                          {c.title}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>

              <label>
                Téléphone
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>

              <label>
                Telegram Username
                <input
                  type="text"
                  placeholder="@username"
                  value={telegramUsername}
                  onChange={(e) => setTelegramUsername(e.target.value)}
                />
              </label>

              <div className="modal-actions" style={{ marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddModal(false)}
                  style={{ background: '#eee', color: '#333' }}
                >
                  Annuler
                </button>
                <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'En cours...' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {showEditModal && editingStaff && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2>Modifier un membre</h2>
            <form onSubmit={handleUpdate}>
              <label>
                Prénom *
                <input
                  type="text"
                  required
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                />
              </label>

              <label>
                Nom *
                <input
                  type="text"
                  required
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                />
              </label>

              <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Rôles * (Sélection multiple)</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
                  {ROLES.map((r) => (
                    <label key={r} style={{ flexDirection: 'row', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 'normal' }}>
                      <input
                        type="checkbox"
                        checked={editSelectedRoles.includes(r)}
                        onChange={() => handleRoleToggle(editSelectedRoles, r, setEditSelectedRoles)}
                      />
                      {r}
                    </label>
                  ))}
                </div>
              </div>

              {/* Speaker Slot Links */}
              {editSelectedRoles.some(r => r.toLowerCase().includes('speaker')) && (
                <div style={{ margin: '0.75rem 0' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Cours enseignés (Speaker)</span>
                  {courses.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: '#888', fontStyle: 'italic', marginTop: '0.25rem' }}>Aucun cours disponible.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem', maxHeight: '120px', overflowY: 'auto', background: '#f5f5f5', padding: '0.4rem', borderRadius: '0.4rem' }}>
                      {courses.map(c => (
                        <label key={c.id} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'normal' }}>
                          <input
                            type="checkbox"
                            checked={editSpeakerSlotIds.includes(c.id)}
                            onChange={() => toggleCourseLink(editSpeakerSlotIds, c.id, setEditSpeakerSlotIds)}
                          />
                          {c.title}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Assistant Slot Links */}
              {editSelectedRoles.some(r => r.toLowerCase().includes('assistant')) && (
                <div style={{ margin: '0.75rem 0' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Cours assistés (Assistant)</span>
                  {courses.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: '#888', fontStyle: 'italic', marginTop: '0.25rem' }}>Aucun cours disponible.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem', maxHeight: '120px', overflowY: 'auto', background: '#f5f5f5', padding: '0.4rem', borderRadius: '0.4rem' }}>
                      {courses.map(c => (
                        <label key={c.id} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'normal' }}>
                          <input
                            type="checkbox"
                            checked={editAssistantSlotIds.includes(c.id)}
                            onChange={() => toggleCourseLink(editAssistantSlotIds, c.id, setEditAssistantSlotIds)}
                          />
                          {c.title}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* RC Slot Links */}
              {editSelectedRoles.some(r => r.toLowerCase().includes('rc')) && (
                <div style={{ margin: '0.75rem 0' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Cours coordonnés (RC)</span>
                  {courses.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: '#888', fontStyle: 'italic', marginTop: '0.25rem' }}>Aucun cours disponible.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem', maxHeight: '120px', overflowY: 'auto', background: '#f5f5f5', padding: '0.4rem', borderRadius: '0.4rem' }}>
                      {courses.map(c => (
                        <label key={c.id} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'normal' }}>
                          <input
                            type="checkbox"
                            checked={editRcSlotIds.includes(c.id)}
                            onChange={() => toggleCourseLink(editRcSlotIds, c.id, setEditRcSlotIds)}
                          />
                          {c.title}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <label>
                Score (Quêtes faites)
                <input
                  type="number"
                  min="0"
                  value={editScore}
                  onChange={(e) => setEditScore(Math.max(0, parseInt(e.target.value, 10) || 0))}
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </label>

              <label>
                Téléphone
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </label>

              <label>
                Telegram Username
                <input
                  type="text"
                  placeholder="@username"
                  value={editTelegramUsername}
                  onChange={(e) => setEditTelegramUsername(e.target.value)}
                />
              </label>

              <div className="modal-actions" style={{ marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingStaff(null)
                  }}
                  style={{ background: '#eee', color: '#333' }}
                >
                  Annuler
                </button>
                <button type="submit" className="btn-primary" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'En cours...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Staffs