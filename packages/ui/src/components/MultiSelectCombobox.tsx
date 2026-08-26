import React, { useState, useMemo, useRef, useEffect } from 'react'

export interface ComboboxOption {
  id: string
  label: string
  sublabel?: string
  category?: string
}

export interface MultiSelectComboboxProps {
  label?: string
  placeholder?: string
  options: ComboboxOption[]
  selectedIds: string[]
  onChange: (selectedIds: string[]) => void
  categories?: string[]
}

export const MultiSelectCombobox: React.FC<MultiSelectComboboxProps> = ({
  label,
  placeholder = 'Rechercher un membre par nom, prénom ou rôle...',
  options,
  selectedIds,
  onChange,
  categories,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const selectedOptions = useMemo(() => {
    return options.filter((o) => selectedIds.includes(o.id))
  }, [options, selectedIds])

  const filteredOptions = useMemo(() => {
    const searchTrimmed = search.trim().toLowerCase()
    return options.filter((o) => {
      let matchesSearch = true

      if (searchTrimmed) {
        const labelLower = o.label.toLowerCase()
        const sublabelLower = (o.sublabel || '').toLowerCase()

        // 1. Exact match or normalized space match
        if (
          labelLower === searchTrimmed ||
          labelLower.replace(/\s+/g, '') === searchTrimmed.replace(/\s+/g, '')
        ) {
          matchesSearch = true
        } else {
          const sTokens = searchTrimmed.split(/\s+/).filter(Boolean)
          const lTokens = labelLower.split(/\s+/).filter(Boolean)

          if (sTokens.length === 1) {
            const sTok = sTokens[0]
            const tokenMatch = lTokens.some((lTok) => lTok === sTok || lTok.startsWith(sTok))
            const subMatch = sublabelLower && (sublabelLower.includes(sTok) || sublabelLower.startsWith(sTok))
            matchesSearch = Boolean(tokenMatch || subMatch)
          } else if (sTokens.length <= lTokens.length) {
            let matchesSequential = true
            for (let i = 0; i < sTokens.length; i++) {
              const sTok = sTokens[i]
              const lTok = lTokens[i]
              const isLastSearchToken = i === sTokens.length - 1

              if (isLastSearchToken) {
                if (sTokens.length === lTokens.length) {
                  if (lTok !== sTok) {
                    matchesSequential = false
                    break
                  }
                } else {
                  if (lTok !== sTok && !lTok.startsWith(sTok)) {
                    matchesSequential = false
                    break
                  }
                }
              } else {
                if (lTok !== sTok) {
                  matchesSequential = false
                  break
                }
              }
            }
            matchesSearch = matchesSequential
          } else {
            matchesSearch = false
          }
        }
      }

      const matchesCat =
        selectedCategory === 'all' ||
        (o.category && o.category.toLowerCase().includes(selectedCategory.toLowerCase()))

      return matchesSearch && matchesCat
    })
  }, [options, search, selectedCategory])

  const toggleOption = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  const removeOption = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(selectedIds.filter((item) => item !== id))
  }

  const selectAllFiltered = () => {
    const filteredIds = filteredOptions.map((o) => o.id)
    const combined = Array.from(new Set([...selectedIds, ...filteredIds]))
    onChange(combined)
  }

  const deselectAllFiltered = () => {
    const filteredIds = new Set(filteredOptions.map((o) => o.id))
    onChange(selectedIds.filter((id) => !filteredIds.has(id)))
  }

  return (
    <div
      className="s4s-form-field"
      ref={containerRef}
      onMouseDown={(e) => e.stopPropagation()}
      style={{ position: 'relative' }}
    >
      {label && <label className="s4s-label">{label}</label>}

      {/* Selected Chips Container */}
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          minHeight: '2.5rem',
          padding: '0.375rem 0.5rem',
          border: '1px solid var(--s4s-border)',
          borderRadius: 'var(--s4s-radius-md)',
          background: 'var(--s4s-bg-card)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.375rem',
          alignItems: 'center',
          cursor: 'pointer',
          boxShadow: isOpen ? '0 0 0 3px rgba(99, 102, 241, 0.15)' : 'none',
          borderColor: isOpen ? 'var(--s4s-primary)' : 'var(--s4s-border)',
          transition: 'all 150ms ease',
        }}
      >
        {selectedOptions.length === 0 ? (
          <span style={{ fontSize: '0.85rem', color: 'var(--s4s-text-muted)', paddingLeft: '0.25rem' }}>
            {placeholder}
          </span>
        ) : (
          selectedOptions.map((item) => (
            <span
              key={item.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.78rem',
                fontWeight: 500,
                background: 'var(--s4s-primary-light)',
                color: 'var(--s4s-primary-dark)',
                padding: '0.2rem 0.5rem',
                borderRadius: 'var(--s4s-radius-sm)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
              }}
            >
              <span>{item.label}</span>
              {item.sublabel && <span style={{ opacity: 0.7, fontSize: '0.7rem' }}>({item.sublabel})</span>}
              <button
                type="button"
                onClick={(e) => removeOption(item.id, e)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  padding: 0,
                  marginTop:0,
                  marginLeft: '0.1rem',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                ✕
              </button>
            </span>
          ))
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--s4s-text-muted)', paddingRight: '0.25rem' }}>
          {selectedIds.length} sélectionné(s) ▾
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
            zIndex: 9999,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '320px',
            animation: 's4s-fade-in 150ms ease-out',
          }}
        >
          {/* Top Search Controls inside Dropdown */}
          <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--s4s-border)', background: 'var(--s4s-bg-subtle)' }}>
            <input
              type="text"
              autoFocus
              className="s4s-input"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
              placeholder="🔍 Tapez un nom ou un rôle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {categories && categories.length > 0 && (
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

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.375rem', fontSize: '0.75rem' }}>
              <button
                type="button"
                onClick={selectAllFiltered}
                style={{ background: 'none', border: 'none', color: 'var(--s4s-primary)', cursor: 'pointer', fontWeight: 600, padding: 0 }}
              >
                Tout sélectionner ({filteredOptions.length})
              </button>
              <button
                type="button"
                onClick={deselectAllFiltered}
                style={{ background: 'none', border: 'none', color: 'var(--s4s-text-muted)', cursor: 'pointer', padding: 0 }}
              >
                Tout désélectionner
              </button>
            </div>
          </div>

          {/* Options List */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '0.25rem 0' }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--s4s-text-muted)' }}>
                Aucun résultat ne correspond à la recherche.
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selectedIds.includes(opt.id)
                return (
                  <div
                    key={opt.id}
                    onClick={() => toggleOption(opt.id)}
                    style={{
                      padding: '0.4rem 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      fontSize: '0.825rem',
                      background: isChecked ? 'var(--s4s-primary-light)' : 'transparent',
                      transition: 'background 100ms ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isChecked) (e.currentTarget.style.background = 'var(--s4s-bg-subtle)')
                    }}
                    onMouseLeave={(e) => {
                      if (!isChecked) (e.currentTarget.style.background = 'transparent')
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: isChecked ? 600 : 400, color: 'var(--s4s-text-primary)' }}>
                        {opt.label}
                      </span>
                      {opt.sublabel && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--s4s-text-muted)' }}>
                          {opt.sublabel}
                        </span>
                      )}
                    </div>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        e.stopPropagation()
                        toggleOption(opt.id)
                      }}
                      style={{ cursor: 'pointer' }}
                    />
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
