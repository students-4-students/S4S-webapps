import { useState, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { trpc } from '../trpc'
import {
  Modal,
  Button,
  Input,
  SearchInput,
  PageHeader,
  parseCSV,
  MultiSelectCombobox,
} from '@s4s/ui'
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
  const [selectedSpeakerClassNames, setSelectedSpeakerClassNames] = useState<string[]>([])
  const [selectedAssistantClassNames, setSelectedAssistantClassNames] = useState<string[]>([])
  const [selectedRcClassNames, setSelectedRcClassNames] = useState<string[]>([])

  // Edit Form State
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editSelectedRoles, setEditSelectedRoles] = useState<string[]>([])
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editTelegramUsername, setEditTelegramUsername] = useState('')
  const [editScore, setEditScore] = useState(0)
  const [editSpeakerClassNames, setEditSpeakerClassNames] = useState<string[]>([])
  const [editAssistantClassNames, setEditAssistantClassNames] = useState<string[]>([])
  const [editRcClassNames, setEditRcClassNames] = useState<string[]>([])

  const utils = trpc.useUtils()

  // Queries and Mutations
  const { data: staffs = [], isLoading } = trpc.staffs.list.useQuery()
  const { data: classNames = [] } = trpc.staffs.listClassNames.useQuery()

  const courseOptions = useMemo(() => {
    return classNames.map((name: string) => ({
      id: name,
      label: name,
    }))
  }, [classNames])


  trpc.staffs.onUpdated.useSubscription(undefined, {
    onData: () => {
      utils.staffs.list.invalidate()
    },
    onError: (err) => {
      console.error('[DEBUG] Staffs page subscription error:', err)
    },
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
        speakerClassNames: selectedSpeakerClassNames,
        assistantClassNames: selectedAssistantClassNames,
        rcClassNames: selectedRcClassNames,
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
      setSelectedSpeakerClassNames([])
      setSelectedAssistantClassNames([])
      setSelectedRcClassNames([])

      utils.staffs.list.invalidate()
    } catch (err: any) {
      console.error(err)
      alert('Erreur lors de la création: ' + (err.message || err))
    }
  }

  const handleEditClick = (staff: any) => {
    setEditingStaff(staff)
    setEditFirstName(staff.firstName)
    setEditLastName(staff.lastName)

    const rolesArray = staff.role
      ? staff.role.split(',').map((r: string) => r.trim()).filter(Boolean)
      : []
    setEditSelectedRoles(rolesArray)

    setEditEmail(staff.email || '')
    setEditPhone(staff.phone || '')
    setEditTelegramUsername(staff.telegramUsername || '')
    setEditScore(staff.score || 0)

    const speakerNames = Array.from(
      new Set([
        ...(staff.speakerSlots?.map((s: any) => s.title) || []),
        ...(staff.Class_SpeakerClasses?.map((c: any) => c.name) || []),
      ])
    )
    setEditSpeakerClassNames(speakerNames)

    const assistantNames = Array.from(
      new Set([
        ...(staff.assistantSlots?.map((s: any) => s.title) || []),
        ...(staff.Class_AssistantClasses?.map((c: any) => c.name) || []),
      ])
    )
    setEditAssistantClassNames(assistantNames)

    const rcNames = Array.from(
      new Set([
        ...(staff.rcSlots?.map((s: any) => s.title) || []),
        ...(staff.Class_RcClasses?.map((c: any) => c.name) || []),
      ])
    )
    setEditRcClassNames(rcNames)

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

      await assignToCoursesMutation.mutateAsync({
        staffMemberId: editingStaff.id,
        speakerClassNames: editSpeakerClassNames,
        assistantClassNames: editAssistantClassNames,
        rcClassNames: editRcClassNames,
      })

      alert('Membre du staff modifié avec succès !')
      setShowEditModal(false)
      setEditingStaff(null)
      utils.staffs.list.invalidate()
    } catch (err: any) {
      console.error(err)
      alert('Erreur lors de la modification: ' + (err.message || err))
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
      alert('Erreur lors de la mise à jour: ' + (err.message || err))
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
      alert('Erreur lors de la suppression: ' + (err.message || err))
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
          role: item.role || 'Équipier Logistique',
          status: 'ACTIVE' as const,
          isPresent: false,
          email: item.email,
          phone: item.phone,
          telegramUsername: item.telegramUsername,
          score: 0,
        }))

        await importMutation.mutateAsync(formatted)
        alert(`${formatted.length} membres du staff importés avec succès !`)
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
    const coursesList: string[] = []

    if (isSpeaker) {
      const speakerTitles = Array.from(
        new Set([
          ...(staff.speakerSlots?.map((s: any) => s.title) || []),
          ...(staff.Class_SpeakerClasses?.map((c: any) => c.name) || []),
        ])
      )
      if (speakerTitles.length > 0) {
        coursesList.push(...speakerTitles.map((t) => `${t} (Speaker)`))
      }
    }

    if (isAssistant) {
      const assistantTitles = Array.from(
        new Set([
          ...(staff.assistantSlots?.map((s: any) => s.title) || []),
          ...(staff.Class_AssistantClasses?.map((c: any) => c.name) || []),
        ])
      )
      if (assistantTitles.length > 0) {
        coursesList.push(...assistantTitles.map((t) => `${t} (Assistant)`))
      }
    }

    if (isRc) {
      const rcTitles = Array.from(
        new Set([
          ...(staff.rcSlots?.map((s: any) => s.title) || []),
          ...(staff.Class_RcClasses?.map((c: any) => c.name) || []),
        ])
      )
      if (rcTitles.length > 0) {
        coursesList.push(...rcTitles.map((t) => `${t} (RC)`))
      }
    }

    return coursesList.length > 0 ? coursesList.join(', ') : '-'
  }

  return (
    <div className="staffs-page">
      <PageHeader
        actions={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="primary" onClick={() => setShowAddModal(true)}>
              + Ajouter
            </Button>
            <label style={{ margin: 0 }}>
              <span className="s4s-button s4s-button--secondary s4s-button--md" style={{ cursor: 'pointer' }}>
                📥 Import CSV
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
          placeholder="🔍 Rechercher par nom, prénom ou rôle..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={() => setSearchTerm('')}
        />
      </div>

      <div className="table-card">
        <div className="table-container">
          {isLoading ? (
            <p style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--s4s-text-muted)' }}>
              Chargement des membres du staff...
            </p>
          ) : filteredStaffs.length === 0 ? (
            <p style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--s4s-text-muted)' }}>
              Aucun membre du staff trouvé.
            </p>
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
                  <th style={{ width: '80px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaffs.map((staff) => (
                  <tr key={staff.id} className={getRowClass(staff.isPresent, staff.status)}>
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
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Staff Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Ajouter un membre du staff"
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

          <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Rôles * (Sélection multiple)</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
              {ROLES.map((r) => (
                <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 'normal' }}>
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

          {selectedRoles.some((r) => r.toLowerCase().includes('speaker')) && (
            <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
              <MultiSelectCombobox
                label="Classes / Cours pour Speaker"
                placeholder="Rechercher et sélectionner des cours pour Speaker..."
                options={courseOptions}
                selectedIds={selectedSpeakerClassNames}
                onChange={setSelectedSpeakerClassNames}
              />
            </div>
          )}

          {selectedRoles.some((r) => r.toLowerCase().includes('assistant')) && (
            <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
              <MultiSelectCombobox
                label="Classes / Cours pour Assistant"
                placeholder="Rechercher et sélectionner des cours pour Assistant..."
                options={courseOptions}
                selectedIds={selectedAssistantClassNames}
                onChange={setSelectedAssistantClassNames}
              />
            </div>
          )}

          {selectedRoles.some((r) => r.toLowerCase().includes('rc')) && (
            <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
              <MultiSelectCombobox
                label="Classes / Cours pour Responsable de cours (RC)"
                placeholder="Rechercher et sélectionner des cours pour RC..."
                options={courseOptions}
                selectedIds={selectedRcClassNames}
                onChange={setSelectedRcClassNames}
              />
            </div>
          )}

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Téléphone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            label="Telegram Username"
            placeholder="@username"
            value={telegramUsername}
            onChange={(e) => setTelegramUsername(e.target.value)}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="primary" isLoading={createMutation.isPending}>
              Ajouter
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Staff Modal */}
      <Modal
        isOpen={showEditModal && Boolean(editingStaff)}
        onClose={() => {
          setShowEditModal(false)
          setEditingStaff(null)
        }}
        title="Modifier le membre"
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

          <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Rôles * (Sélection multiple)</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
              {ROLES.map((r) => (
                <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 'normal' }}>
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

          {(editSelectedRoles.some((r) => r.toLowerCase().includes('speaker')) || editSpeakerClassNames.length > 0) && (
            <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
              <MultiSelectCombobox
                label="Classes / Cours pour Speaker"
                placeholder="Rechercher et sélectionner des cours pour Speaker..."
                options={courseOptions}
                selectedIds={editSpeakerClassNames}
                onChange={setEditSpeakerClassNames}
              />
            </div>
          )}

          {(editSelectedRoles.some((r) => r.toLowerCase().includes('assistant')) || editAssistantClassNames.length > 0) && (
            <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
              <MultiSelectCombobox
                label="Classes / Cours pour Assistant"
                placeholder="Rechercher et sélectionner des cours pour Assistant..."
                options={courseOptions}
                selectedIds={editAssistantClassNames}
                onChange={setEditAssistantClassNames}
              />
            </div>
          )}

          {(editSelectedRoles.some((r) => r.toLowerCase().includes('rc')) || editRcClassNames.length > 0) && (
            <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
              <MultiSelectCombobox
                label="Classes / Cours pour Responsable de cours (RC)"
                placeholder="Rechercher et sélectionner des cours pour RC..."
                options={courseOptions}
                selectedIds={editRcClassNames}
                onChange={setEditRcClassNames}
              />
            </div>
          )}

          <Input
            label="Score (Quêtes faites)"
            type="number"
            min="0"
            value={editScore}
            onChange={(e) => setEditScore(Math.max(0, parseInt(e.target.value, 10) || 0))}
          />
          <Input
            label="Email"
            type="email"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
          />
          <Input
            label="Téléphone"
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value)}
          />
          <Input
            label="Telegram Username"
            placeholder="@username"
            value={editTelegramUsername}
            onChange={(e) => setEditTelegramUsername(e.target.value)}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <Button type="button" variant="secondary" onClick={() => setShowEditModal(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="primary" isLoading={updateMutation.isPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Staffs