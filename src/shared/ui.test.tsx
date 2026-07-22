import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppPageShell, EmptyState, PageHeader, SectionCard, StatusBadge } from './ui'

describe('shared UI primitives', () => {
  it('renders the shared shell, header, card, status, and empty state', () => {
    render(<AppPageShell><PageHeader title="Example" description="A short description" /><SectionCard labelledBy="example-heading"><h2 id="example-heading">Section</h2><StatusBadge tone="active">Active</StatusBadge><EmptyState>Nothing here yet.</EmptyState></SectionCard></AppPageShell>)
    expect(screen.getByRole('main')).toHaveClass('app-page-shell')
    expect(screen.getByRole('heading', { name: 'Example' })).toBeInTheDocument()
    expect(screen.getByText('Active')).toHaveClass('status-badge')
    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument()
  })
})