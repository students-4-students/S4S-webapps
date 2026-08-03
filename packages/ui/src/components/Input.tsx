import React from 'react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', id, required, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    return (
      <div className="s4s-form-field">
        {label && (
          <label htmlFor={inputId} className="s4s-label">
            {label} {required && <span style={{ color: 'var(--s4s-danger)' }}>*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          className={`s4s-input ${error ? 's4s-input--error' : ''} ${className}`.trim()}
          {...props}
        />
        {error && <span style={{ fontSize: '0.75rem', color: 'var(--s4s-danger)' }}>{error}</span>}
        {helperText && !error && (
          <span style={{ fontSize: '0.75rem', color: 'var(--s4s-text-muted)' }}>{helperText}</span>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'
