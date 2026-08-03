import React, { useState, useMemo, useRef, useEffect } from 'react'
import { trpc } from '../trpc'

interface StaffComboboxProps {
  label?: string
  placeholder?: string
  value: string
  onChange: (staffId: string) => void
  allowUnassigned?: boolean
  required?: boolean
  defaultCategory?: string
  style?: React.CSSProperties
}

export default function StaffCombobox({
  label,
  placeholder = 'Rechercher par nom, prénom ou rôle...',
  value,
  onChange,
  allowUnassigned = true,
  required = false,
  defaultCategory,
  style,
}: StaffComboboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>(defaultCategory || 'all')
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: staffs = [] } = trpc.staffs.list.useQuery()

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedStaff = useMemo(() => {
    return staffs.find((st) => st.id === value)
  }, [staffs, value])

  const categories = useMemo(() => {
    const set = new Set<string>()
    if (defaultCategory) set.add(defaultCategory)
    staffs.forEach((st) => {
      if (st.role) {
        st.role.split(',').forEach((r) => set.add(r.trim()))
      }
    })
    return Array.from(set)
  }, [staffs, defaultCategory])

  const filteredStaffs = useMemo(() => {
    return staffs.filter((st) => {
      const matchesSearch =
        !search.trim() ||
        `${st.firstName} ${st.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        (st.role && st.role.toLowerCase().includes(search.toLowerCase()))

      const matchesCat =
        selectedCategory === 'all' ||
        (st.role && st.role.toLowerCase().includes(selectedCategory.toLowerCase()))

      return matchesSearch && matchesCat
    })
  }, [staffs, search, selectedCategory])

  const handleSelect = (id: string) => {
    onChange(id)
    setIsOpen(false)
    setSearch('')
  }

  return (
    <div className="s4s-form-field" ref={containerRef} style={{ position: 'relative', marginBottom: '1rem', ...style }}>
      {label && (
        <label className="s4s-label">
          {label} {required && <span style={{ color: 'var(--s4s-danger)' }}>*</span>}
        </label>
      )}

      {/* Trigger Area */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          minHeight: '2.5rem',
          padding: '0.375rem 0.6rem',
          border: '1px solid var(--s4s-border)',
          borderRadius: 'var(--s4s-radius-md)',
          background: 'var(--s4s-bg-card)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          cursor: 'pointer',
          boxShadow: isOpen ? '0 0 0 3px rgba(99, 102, 241, 0.15)' : 'none',
          borderColor: isOpen ? 'var(--s4s-primary)' : 'var(--s4s-border)',
          transition: 'all 150ms ease',
        }}
      >
        {selectedStaff ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              fontSize: '0.825rem',
              fontWeight: 500,
              background: 'var(--s4s-primary-light)',
              color: 'var(--s4s-primary-dark)',
              padding: '0.2rem 0.5rem',
              borderRadius: 'var(--s4s-radius-sm)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
            }}
          >
            <span>
              {selectedStaff.firstName} {selectedStaff.lastName}
            </span>
            {selectedStaff.role && (
              <span style={{ opacity: 0.7, fontSize: '0.72rem' }}>({selectedStaff.role})</span>
            )}
            {allowUnassigned && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleSelect('')
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  padding: 0,
                  marginLeft: '0.2rem',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                ✕
              </button>
            )}
          </span>
        ) : (
          <span style={{ fontSize: '0.85rem', color: 'var(--s4s-text-muted)', paddingLeft: '0.25rem' }}>
            {placeholder}
          </span>
        )}

        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--s4s-text-muted)', paddingRight: '0.25rem' }}>
          ▾
        </span>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '0.25rem',
            background: 'var(--s4s-bg-card)',
            border: '1px solid var(--s4s-border)',
            borderRadius: 'var(--s4s-radius-md)',
            boxShadow: 'var(--s4s-shadow-lg)',
            zIndex: 1100,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '320px',
            animation: 's4s-fade-in 150ms ease-out',
          }}
        >
          {/* Top Search & Category Filters */}
          <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--s4s-border)', background: 'var(--s4s-bg-subtle)' }}>
            <input
              type="text"
              autoFocus
              className="s4s-input"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
              placeholder="🔍 Tapez un nom, prénom ou un rôle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {categories.length > 0 && (
              <div style={{ display: 'flex', gap: '0.25rem', overflowX: 'auto', marginTop: '0.375rem', paddingBottom: '0.2rem' }}>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`s4s-button s4s-button--sm ${selectedCategory === 'all' ? 's4s-button--primary' : 's4s-button--ghost'}`}
                  style={{ fontSize: '0.72rem', height: '1.5rem', padding: '0 0.4rem' }}
                >
                  Tous
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`s4s-button s4s-button--sm ${selectedCategory === cat ? 's4s-button--primary' : 's4s-button--ghost'}`}
                    style={{ fontSize: '0.72rem', height: '1.5rem', padding: '0 0.4rem', whiteSpace: 'nowrap' }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Options List */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '0.25rem 0' }}>
            {allowUnassigned && (
              <div
                onClick={() => handleSelect('')}
                style={{
                  padding: '0.4rem 0.75rem',
                  cursor: 'pointer',
                  fontSize: '0.825rem',
                  fontStyle: 'italic',
                  color: 'var(--s4s-text-muted)',
                  background: value === '' ? 'var(--s4s-primary-light)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (value !== '') (e.currentTarget.style.background = 'var(--s4s-bg-subtle)')
                }}
                onMouseLeave={(e) => {
                  if (value !== '') (e.currentTarget.style.background = 'transparent')
                }}
              >
                -- Non assigné --
              </div>
            )}

            {filteredStaffs.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--s4s-text-muted)' }}>
                Aucun membre ne correspond à la recherche.
              </div>
            ) : (
              filteredStaffs.map((st) => {
                const isSelected = st.id === value
                return (
                  <div
                    key={st.id}
                    onClick={() => handleSelect(st.id)}
                    style={{
                      padding: '0.45rem 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      fontSize: '0.825rem',
                      background: isSelected ? 'var(--s4s-primary-light)' : 'transparent',
                      transition: 'background 100ms ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) (e.currentTarget.style.background = 'var(--s4s-bg-subtle)')
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) (e.currentTarget.style.background = 'transparent')
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: isSelected ? 600 : 400, color: 'var(--s4s-text-primary)' }}>
                        {st.firstName} {st.lastName}
                      </span>
                      {st.role && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--s4s-text-muted)' }}>
                          {st.role}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <span style={{ color: 'var(--s4s-primary)', fontWeight: 600, fontSize: '0.85rem' }}>
                        ✓
                      </span>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
