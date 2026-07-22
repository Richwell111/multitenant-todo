import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App routing', () => {
  it('redirects / to the login page', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { name: 'Company Login' })).toBeInTheDocument()
  })

  it('renders the login page', () => {
    renderAt('/login')
    expect(screen.getByRole('heading', { name: 'Company Login' })).toBeInTheDocument()
  })

  it('renders the register page', () => {
    renderAt('/register')
    expect(screen.getByRole('heading', { name: 'Company Registration' })).toBeInTheDocument()
  })

  it('renders the admin page', () => {
    renderAt('/admin')
    expect(screen.getByRole('heading', { name: 'Platform Admin' })).toBeInTheDocument()
  })

  it('protects the customization requests route with the Platform Admin boundary', async () => {
    renderAt('/admin/customization-requests')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Platform Admin' })).toBeInTheDocument())
  })

  it('redirects an unknown route to the login page', () => {
    renderAt('/does-not-exist')
    expect(screen.getByRole('heading', { name: 'Company Login' })).toBeInTheDocument()
  })
})
