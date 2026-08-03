import React from 'react'

export interface SelectOption {
  value: string | number
  label: string
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options?: SelectOption[]
  error?: string
  children?: React.ReactNode
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, className = '', id, required, children, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    return (
      <div className="s4s-form-field">
        {label && (
          <label htmlFor={selectId} className="s4s-label">
            {label} {required && <span style={{ color: 'var(--s4s-danger)' }}>*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          required={required}
          className={`s4s-select ${className}`.trim()}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        {error && <span style={{ fontSize: '0.75rem', color: 'var(--s4s-danger)' }}>{error}</span>}
      </div>
    )
  }
)
Select.displayName = 'Select'
