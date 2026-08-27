import React, { useState, useMemo, useRef, useEffect } from 'react'
import { trpc } from '../trpc'

interface SingleStaffComboboxProps {
  multiple?: false
  value: string
  onChange: (staffId: string) => void
  label?: string
  placeholder?: string
  allowUnassigned?: boolean
  required?: boolean
  defaultCategory?: string
  style?: React.CSSProperties
}

interface MultiStaffComboboxProps {
  multiple: true
  value: string[]
  onChange: (staffIds: string[]) => void
  label?: string
  placeholder?: string
  allowUnassigned?: boolean
  required?: boolean
  defaultCategory?: string
  style?: React.CSSProperties
}

export type StaffComboboxProps = SingleStaffComboboxProps | MultiStaffComboboxProps

export default function StaffCombobox(props: StaffComboboxProps) {
  const {
    label,
    placeholder = 'Rechercher par nom, prénom ou rôle...',
    multiple = false,
    allowUnassigned = true,
    required = false,
    defaultCategory,
    style,
  } = props

  const [isOpen, setIsOpen] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>(defaultCategory || 'all')
  const [activeIndex, setActiveIndex] = useState<number>(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

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

  const selectedStaffIds = useMemo(() => {
    if (multiple) {
      return (props.value as string[]) || []
    }
    return (props.value as string) ? [(props.value as string)] : []
  }, [multiple, props.value])

  const selectedStaffs = useMemo(() => {
    return staffs.filter((st) => selectedStaffIds.includes(st.id))
  }, [staffs, selectedStaffIds])

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

  useEffect(() => {
    setActiveIndex(filteredStaffs.length > 0 ? 0 : -1)
  }, [filteredStaffs.length, search, selectedCategory])

  // Scroll active item into view
  useEffect(() => {
    if (isOpen && activeIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement | null
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [isOpen, activeIndex])

  const handleSelect = (id: string) => {
    if (multiple) {
      const current = (props.value as string[]) || []
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
      ;(props.onChange as (ids: string[]) => void)(next)
      setSearch('')
      inputRef.current?.focus()
    } else {
      ;(props.onChange as (id: string) => void)(id)
      setIsOpen(false)
      setSearch('')
      inputRef.current?.focus()
    }
  }

  const handleClearAll = () => {
    if (multiple) {
      ;(props.onChange as (ids: string[]) => void)([])
    } else {
      ;(props.onChange as (id: string) => void)('')
      setIsOpen(false)
    }
    setSearch('')
    inputRef.current?.focus()
  }

  const handleRemoveSingle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (multiple) {
      const current = (props.value as string[]) || []
      ;(props.onChange as (ids: string[]) => void)(current.filter((x) => x !== id))
    } else {
      ;(props.onChange as (id: string) => void)('')
    }
    inputRef.current?.focus()
  }

  const allCategories = useMemo(() => ['all', ...categories], [categories])

  const categoryContainerRef = useRef<HTMLDivElement>(null)

  // Scroll active category into view
  useEffect(() => {
    if (isOpen && categoryContainerRef.current) {
      const activeBtn = categoryContainerRef.current.querySelector('[data-active="true"]') as HTMLElement | null
      if (activeBtn) {
        activeBtn.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }
    }
  }, [isOpen, selectedCategory])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
      } else {
        setActiveIndex((prev) => {
          const next = prev + 1
          return next >= filteredStaffs.length ? 0 : next
        })
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
      } else {
        setActiveIndex((prev) => {
          const next = prev - 1
          return next < 0 ? filteredStaffs.length - 1 : next
        })
      }
    } else if (e.key === 'ArrowRight' && categories.length > 0) {
      const isAtEnd = inputRef.current
        ? inputRef.current.selectionStart === search.length && inputRef.current.selectionEnd === search.length
        : true
      if (search === '' || isAtEnd) {
        e.preventDefault()
        if (!isOpen) setIsOpen(true)
        const currIdx = allCategories.indexOf(selectedCategory)
        const nextIdx = (currIdx + 1) % allCategories.length
        setSelectedCategory(allCategories[nextIdx])
      }
    } else if (e.key === 'ArrowLeft' && categories.length > 0) {
      const isAtStart = inputRef.current
        ? inputRef.current.selectionStart === 0 && inputRef.current.selectionEnd === 0
        : true
      if (search === '' || isAtStart) {
        e.preventDefault()
        if (!isOpen) setIsOpen(true)
        const currIdx = allCategories.indexOf(selectedCategory)
        const prevIdx = (currIdx - 1 + allCategories.length) % allCategories.length
        setSelectedCategory(allCategories[prevIdx])
      }
    } else if (e.key === 'Enter') {
      if (isOpen && activeIndex >= 0 && activeIndex < filteredStaffs.length) {
        e.preventDefault()
        handleSelect(filteredStaffs[activeIndex].id)
      }
    } else if (e.key === 'Backspace' && search === '' && selectedStaffIds.length > 0 && allowUnassigned) {
      const lastId = selectedStaffIds[selectedStaffIds.length - 1]
      if (multiple) {
        const next = (props.value as string[]).filter((id) => id !== lastId)
        ;(props.onChange as (ids: string[]) => void)(next)
      } else {
        ;(props.onChange as (id: string) => void)('')
      }
    } else if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault()
        setIsOpen(false)
      }
    }
  }

  const handleContainerBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setIsOpen(false)
      setIsFocused(false)
    }
  }

  return (
    <div
      className="s4s-form-field"
      ref={containerRef}
      onBlur={handleContainerBlur}
      style={{ position: 'relative', marginBottom: '1rem', ...style }}
    >
      {label && (
        <label className="s4s-label">
          {label} {required && <span style={{ color: 'var(--s4s-danger)' }}>*</span>}
        </label>
      )}

      {/* Main Trigger / Search Field Container */}
      <div
        onClick={() => {
          inputRef.current?.focus()
          setIsOpen(true)
        }}
        style={{
          minHeight: '2.5rem',
          padding: '0.25rem 0.5rem',
          border: '1px solid var(--s4s-border)',
          borderRadius: 'var(--s4s-radius-md)',
          background: 'var(--s4s-bg-card)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.35rem',
          cursor: 'text',
          boxShadow: isOpen || isFocused ? '0 0 0 3px rgba(99, 102, 241, 0.15)' : 'none',
          borderColor: isOpen || isFocused ? 'var(--s4s-primary)' : 'var(--s4s-border)',
          transition: 'all 150ms ease',
        }}
      >
        {selectedStaffs.map((st) => (
          <span
            key={st.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              fontSize: '0.825rem',
              fontWeight: 500,
              background: 'var(--s4s-primary-light)',
              color: 'var(--s4s-primary-dark)',
              padding: '0.15rem 0.45rem',
              borderRadius: 'var(--s4s-radius-sm)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              userSelect: 'none',
            }}
          >
            <span>
              {st.firstName} {st.lastName}
            </span>
            {st.role && (
              <span style={{ opacity: 0.7, fontSize: '0.72rem' }}>({st.role})</span>
            )}
            {allowUnassigned && (
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => handleRemoveSingle(st.id, e)}
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
        ))}

        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            if (!isOpen) setIsOpen(true)
          }}
          onFocus={() => {
            setIsFocused(true)
            setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder={selectedStaffs.length === 0 ? placeholder : ''}
          style={{
            flex: 1,
            minWidth: selectedStaffs.length > 0 ? '80px' : '100%',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: '0.85rem',
            color: 'var(--s4s-text-primary)',
            padding: '0.25rem 0.2rem',
            margin: 0,
          }}
        />

        <span
          onClick={(e) => {
            e.stopPropagation()
            setIsOpen((prev) => !prev)
            inputRef.current?.focus()
          }}
          style={{
            marginLeft: 'auto',
            fontSize: '0.75rem',
            color: 'var(--s4s-text-muted)',
            padding: '0 0.25rem',
            cursor: 'pointer',
          }}
        >
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
          {/* Category Filters */}
          {categories.length > 0 && (
            <div style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--s4s-border)', background: 'var(--s4s-bg-subtle)' }}>
              <div ref={categoryContainerRef} style={{ display: 'flex', gap: '0.25rem', overflowX: 'auto', paddingBottom: '0.1rem' }}>
                <button
                  type="button"
                  tabIndex={-1}
                  data-active={selectedCategory === 'all'}
                  onMouseDown={(e) => e.preventDefault()}
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
                    tabIndex={-1}
                    data-active={selectedCategory === cat}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setSelectedCategory(cat)}
                    className={`s4s-button s4s-button--sm ${selectedCategory === cat ? 's4s-button--primary' : 's4s-button--ghost'}`}
                    style={{ fontSize: '0.72rem', height: '1.5rem', padding: '0 0.4rem', whiteSpace: 'nowrap' }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Options List */}
          <div ref={listRef} role="listbox" style={{ overflowY: 'auto', flex: 1, padding: '0.25rem 0' }}>
            {allowUnassigned && (
              <div
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleClearAll}
                style={{
                  padding: '0.4rem 0.75rem',
                  cursor: 'pointer',
                  fontSize: '0.825rem',
                  fontStyle: 'italic',
                  color: 'var(--s4s-text-muted)',
                  background: selectedStaffIds.length === 0 ? 'var(--s4s-primary-light)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (selectedStaffIds.length !== 0) (e.currentTarget.style.background = 'var(--s4s-bg-subtle)')
                }}
                onMouseLeave={(e) => {
                  if (selectedStaffIds.length !== 0) (e.currentTarget.style.background = 'transparent')
                }}
              >
                -- {multiple ? 'Désélectionner tout' : 'Non assigné'} --
              </div>
            )}

            {filteredStaffs.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--s4s-text-muted)' }}>
                Aucun membre ne correspond à la recherche.
              </div>
            ) : (
              filteredStaffs.map((st, index) => {
                const isSelected = selectedStaffIds.includes(st.id)
                const isHighlighted = index === activeIndex
                return (
                  <div
                    key={st.id}
                    data-index={index}
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(st.id)}
                    onMouseEnter={() => setActiveIndex(index)}
                    style={{
                      padding: '0.45rem 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      fontSize: '0.825rem',
                      background: isSelected
                        ? 'var(--s4s-primary-light)'
                        : isHighlighted
                          ? 'var(--s4s-bg-subtle)'
                          : 'transparent',
                      transition: 'background 100ms ease',
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

