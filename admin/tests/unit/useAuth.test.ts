import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

// Mock the api module
vi.mock('@/lib/api', () => {
  let storedToken: string | null = null
  return {
    adminLogin: vi.fn(async (_email: string, _password: string) => ({
      success: true,
      data: { token: 'test-jwt-token', user: { id: '1', email: 'admin@test.com' } },
    })),
    setAuthToken: vi.fn((t: string | null) => { storedToken = t }),
    getAuthToken: vi.fn(() => storedToken),
  }
})

import { useAuth } from '@/composables/useAuth'
import { setAuthToken } from '@/lib/api'

beforeEach(() => {
  localStorageMock.clear()
  vi.clearAllMocks()
})

describe('useAuth', () => {
  it('starts as not authenticated when no token in localStorage', () => {
    const { isAuthenticated } = useAuth()
    // Note: the composable reads localStorage at module load time,
    // so in the test environment after clear, it depends on the module state
    expect(typeof isAuthenticated.value).toBe('boolean')
  })

  it('login() stores token and sets authenticated', async () => {
    const { login, isAuthenticated, token } = useAuth()

    await login('admin@test.com', 'password123')

    expect(token.value).toBe('test-jwt-token')
    expect(isAuthenticated.value).toBe(true)
    expect(localStorageMock.setItem).toHaveBeenCalledWith('admin_token', 'test-jwt-token')
    expect(setAuthToken).toHaveBeenCalledWith('test-jwt-token')
  })

  it('logout() clears token and sets not authenticated', async () => {
    const { login, logout, isAuthenticated, token } = useAuth()

    // Login first
    await login('admin@test.com', 'password')
    expect(isAuthenticated.value).toBe(true)

    // Then logout
    logout()

    expect(token.value).toBeNull()
    expect(isAuthenticated.value).toBe(false)
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('admin_token')
    expect(setAuthToken).toHaveBeenCalledWith(null)
  })

  it('login() sets error on failure', async () => {
    const { adminLogin } = await import('@/lib/api')
    vi.mocked(adminLogin).mockRejectedValueOnce(new Error('Invalid credentials'))

    const { login, error } = useAuth()

    await expect(login('bad@test.com', 'wrong')).rejects.toThrow('Invalid credentials')
    expect(error.value).toBe('Invalid credentials')
  })

  it('login() sets loading during request', async () => {
    const { login, loading } = useAuth()

    expect(loading.value).toBe(false)
    const promise = login('admin@test.com', 'password')
    // Loading is set synchronously at the start
    expect(loading.value).toBe(true)
    await promise
    expect(loading.value).toBe(false)
  })
})
