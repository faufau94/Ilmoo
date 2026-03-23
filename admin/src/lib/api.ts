const BASE_URL = import.meta.env.DEV
  ? 'http://localhost:3000'
  : '' // In production, nginx proxies /api → backend

let authToken: string | null = null

export function setAuthToken(token: string | null) {
  authToken = token
}

export function getAuthToken() {
  return authToken
}

async function request<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    authToken = null
    localStorage.removeItem('admin_token')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  const data = await response.json()

  if (!response.ok || data.success === false) {
    throw new Error(data.error || `Request failed: ${response.status}`)
  }

  return data
}

// ── Auth ──

export async function adminLogin(email: string, password: string) {
  return request<{ success: boolean; data: { token: string; user: unknown } }>(
    '/api/admin/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
  )
}

// ── Stats ──

export async function getStats(flavor?: string) {
  const params = flavor ? `?flavor=${flavor}` : ''
  return request<{ success: boolean; data: AdminStats }>(`/api/admin/stats${params}`)
}

// ── Users ──

export async function getUsers(params?: Record<string, string>) {
  const query = params ? '?' + new URLSearchParams(params).toString() : ''
  return request<{ success: boolean; data: unknown[]; pagination: Pagination }>(
    `/api/admin/users${query}`,
  )
}

export async function updateUserStatus(id: string, status: string) {
  return request(`/api/admin/users/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
}

// ── Questions ──

export async function getQuestions(params?: Record<string, string>) {
  const query = params ? '?' + new URLSearchParams(params).toString() : ''
  return request<{ success: boolean; data: unknown[]; pagination: Pagination }>(
    `/api/questions${query}`,
  )
}

export async function createQuestion(body: Record<string, unknown>) {
  return request('/api/questions', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateQuestion(id: string, body: Record<string, unknown>) {
  return request(`/api/questions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function deleteQuestion(id: string) {
  return request(`/api/questions/${id}`, { method: 'DELETE' })
}

export async function importQuestions(questions: Record<string, unknown>[]) {
  return request('/api/questions/import', {
    method: 'POST',
    body: JSON.stringify({ questions }),
  })
}

// ── Categories ──

export async function getCategories() {
  return request<{ success: boolean; data: unknown[] }>('/api/admin/categories')
}

export async function createCategory(body: Record<string, unknown>) {
  return request('/api/categories', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateCategory(id: string, body: Record<string, unknown>) {
  return request(`/api/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function deleteCategory(id: string) {
  return request(`/api/categories/${id}`, { method: 'DELETE' })
}

// ── Reports ──

export async function getReports(params?: Record<string, string>) {
  const query = params ? '?' + new URLSearchParams(params).toString() : ''
  return request<{ success: boolean; data: unknown[] }>(`/api/admin/reports${query}`)
}

export async function resolveReport(id: string, body: Record<string, unknown>) {
  return request(`/api/admin/reports/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

// ── Flavors ──

export async function getFlavors() {
  return request<{ success: boolean; data: unknown[] }>('/api/admin/flavors')
}

export async function getFlavor(slug: string) {
  return request<{ success: boolean; data: unknown }>(`/api/admin/flavors/${slug}`)
}

export async function updateFlavor(slug: string, body: Record<string, unknown>) {
  return request(`/api/admin/flavors/${slug}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

// ── Matches ──

export async function getMatches(params?: Record<string, string>) {
  const query = params ? '?' + new URLSearchParams(params).toString() : ''
  return request<{ success: boolean; data: unknown[]; pagination: Pagination }>(
    `/api/admin/matches${query}`,
  )
}

// ── Tournaments ──

export async function getTournaments() {
  return request<{ success: boolean; data: unknown[] }>('/api/admin/tournaments')
}

export async function createTournament(body: Record<string, unknown>) {
  return request('/api/admin/tournaments', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateTournament(id: string, body: Record<string, unknown>) {
  return request(`/api/admin/tournaments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

// ── Types ──

export interface AdminStats {
  totalUsers: number
  activeToday: number
  totalMatches: number
  matchesToday: number
  totalQuestions: number
  pendingReports: number
}

export interface Pagination {
  total: number
  limit: number
  offset: number
}
