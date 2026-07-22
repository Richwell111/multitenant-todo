import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import AdminNavigation from './AdminNavigation'

describe('AdminNavigation', () => {
  it('marks the current Admin section and exposes business-facing destinations', () => {
    render(<MemoryRouter initialEntries={['/admin#features']}><AdminNavigation /></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Features' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Customization Requests' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Diagnostics' })).toBeInTheDocument()
  })
})