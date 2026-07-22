import type { ReactNode } from 'react'

export function AppPageShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <main className={`app-page-shell ${className}`.trim()}>{children}</main>
}

export function PageHeader({ title, description, actions, nav }: { title: string; description?: ReactNode; actions?: ReactNode; nav?: ReactNode }) {
  return <header className="page-header"><div><h1>{title}</h1>{description && <p>{description}</p>}{nav}</div>{actions && <div className="page-header-actions">{actions}</div>}</header>
}

export function SectionCard({ children, className = '', labelledBy }: { children: ReactNode; className?: string; labelledBy?: string }) {
  return <section className={`section-card ${className}`.trim()} aria-labelledby={labelledBy}>{children}</section>
}

export function StatusBadge({ children, tone = '' }: { children: ReactNode; tone?: string }) {
  return <span className={`status-badge ${tone ? `status-${tone}` : ''}`.trim()}>{children}</span>
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="state empty-state">{children}</p>
}

export function LoadingState({ children }: { children: ReactNode }) {
  return <p className="state loading-state" role="status">{children}</p>
}

export function ErrorState({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return <div className="alert alert-error" role="alert"><p>{children}</p>{onRetry && <div className="state-actions"><button className="button-secondary" type="button" onClick={onRetry}>Retry</button></div>}</div>
}