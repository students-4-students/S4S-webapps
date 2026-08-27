import React from 'react'

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void
  icon?: React.ReactNode
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  onClear,
  placeholder = 'Rechercher...',
  className = '',
  icon = '🔍',
  ...props
}) => {
  const hasValue = Boolean(value)

  return (
    <div className="s4s-search-input-wrapper">
      <span className="s4s-search-icon">{icon}</span>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`s4s-input s4s-search-input ${className}`.trim()}
        {...props}
      />
      {hasValue && (
        <button
          type="button"
          className="s4s-search-clear"
          onClick={() => {
            if (onClear) onClear()
          }}
          aria-label="Effacer la recherche"
        >
          ✕
        </button>
      )}
    </div>
  )
}
