import React from 'react'

export interface TableProps {
  children: React.ReactNode
  className?: string
}

export const Table: React.FC<TableProps> = ({ children, className = '' }) => {
  return (
    <div className="s4s-table-card">
      <div className="s4s-table-container">
        <table className={`s4s-table ${className}`.trim()}>{children}</table>
      </div>
    </div>
  )
}

export const TableHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => <thead>{children}</thead>
export const TableBody: React.FC<{ children: React.ReactNode }> = ({ children }) => <tbody>{children}</tbody>
export const TableRow: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties; onClick?: () => void }> = ({
  children,
  className = '',
  style,
  onClick,
}) => <tr className={className} style={style} onClick={onClick}>{children}</tr>
export const TableHead: React.FC<{ children?: React.ReactNode; style?: React.CSSProperties; className?: string }> = ({ children, style, className }) => (
  <th style={style} className={className}>{children}</th>
)
export const TableCell: React.FC<{ children?: React.ReactNode; style?: React.CSSProperties; className?: string; colSpan?: number }> = ({ children, style, className, colSpan }) => (
  <td style={style} className={className} colSpan={colSpan}>{children}</td>
)
