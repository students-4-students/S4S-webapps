import React from 'react'

export interface CardProps {
  hoverable?: boolean
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
}

export const Card: React.FC<CardProps> = ({
  hoverable = false,
  children,
  className = '',
  style,
  onClick,
}) => {
  return (
    <div
      className={`s4s-card ${hoverable ? 's4s-card--hoverable' : ''} ${className}`.trim()}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
