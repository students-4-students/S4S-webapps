import React from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  icon?: React.ReactNode
  children?: React.ReactNode
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseClass = `s4s-button s4s-button--${variant} s4s-button--${size}`
  const combinedClassName = `${baseClass} ${className}`.trim()

  return (
    <button className={combinedClassName} disabled={disabled || isLoading} {...props}>
      {isLoading ? (
        <span className="s4s-spinner" style={{ width: '1rem', height: '1rem' }} />
      ) : icon ? (
        <span className="s4s-button__icon">{icon}</span>
      ) : null}
      {children}
    </button>
  )
}
