import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import AdminNavigation from './AdminNavigation'

describe('AdminNavigation', () => {
  it('links to real Admin routes and marks the active one', () => {
    render(<MemoryRouter initialEntries={['/admin/features']}><AdminNavigation /></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Features' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/admin')
    expect(screen.getByRole('link', { name: 'Companies' })).toHaveAttribute('href', '/admin/companies')
    expect(screen.getByRole('link', { name: 'Licences' })).toHaveAttribute('href', '/admin/licences')
    expect(screen.getByRole('link', { name: 'Customization Requests' })).toHaveAttribute('href', '/admin/customization-requests')
    expect(screen.getByRole('link', { name: 'Diagnostics' })).toHaveAttribute('href', '/admin/diagnostics')
  })

  it('marks Overview active only on the exact index route', () => {
    render(<MemoryRouter initialEntries={['/admin']}><AdminNavigation /></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Companies' })).not.toHaveAttribute('aria-current')
  })
})
