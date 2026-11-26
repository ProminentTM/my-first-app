export type ApiUser = {
  id: number
  username: string
  role: 'branch_manager' | 'managing_director' | null
}

type TokenPair = {
  access: string
  refresh: string
}

type TokenResponse = {
  access: string
  refresh?: string
}

const TOKEN_STORAGE_KEY = 'fentras.api-session.v1'
let refreshInFlight: Promise<void> | null = null

function readTokens(): TokenPair | null {
  const saved = window.sessionStorage.getItem(TOKEN_STORAGE_KEY)
  if (!saved) return null
  try {
    const parsed: unknown = JSON.parse(saved)
    if (parsed && typeof parsed === 'object'
      && typeof (parsed as Record<string, unknown>).access === 'string'
      && typeof (parsed as Record<string, unknown>).refresh === 'string') {
      return parsed as TokenPair
    }
  } catch {
    window.sessionStorage.removeItem(TOKEN_STORAGE_KEY)
    throw new Error('Saved sign-in data is invalid. Please sign in again.')
  }
  window.sessionStorage.removeItem(TOKEN_STORAGE_KEY)
  throw new Error('Saved sign-in data is invalid. Please sign in again.')
}

function saveTokens(tokens: TokenPair) {
  window.sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens))
}

export function clearApiSession() {
  window.sessionStorage.removeItem(TOKEN_STORAGE_KEY)
}

export function hasApiSession(): boolean {
  return readTokens() !== null
}

export async function apiLogin(username: string, password: string): Promise<ApiUser> {
  const response = await fetch('/api/auth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!response.ok) throw new Error(await getResponseError(response))
  const tokens = await response.json() as TokenPair
  saveTokens(tokens)
  try {
    return await apiRequest<ApiUser>('/api/auth/me/')
  } catch (error) {
    clearApiSession()
    throw error
  }
}

export async function apiCurrentUser(): Promise<ApiUser> {
  return apiRequest<ApiUser>('/api/auth/me/')
}

export async function apiLogout(): Promise<void> {
  if (!readTokens()) return
  await refreshTokens()
  const tokens = readTokens()
  if (!tokens) throw new Error('Your sign-in has expired. Please sign in again.')
  await apiRequest<void>('/api/auth/logout/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: tokens.refresh }),
  })
}

export async function apiPost<T>(path: string, data: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function apiList<T>(path: string): Promise<T[]> {
  const results: T[] = []
  let next: string | null = path
  while (next) {
    const response = await apiRequest<unknown>(next)
    if (Array.isArray(response)) {
      results.push(...response as T[])
      next = null
    } else if (response && typeof response === 'object' && Array.isArray((response as { results?: unknown }).results)) {
      const page = response as { results: T[]; next: string | null }
      results.push(...page.results)
      if (page.next) {
        const nextUrl = new URL(page.next, window.location.origin)
        next = `${nextUrl.pathname}${nextUrl.search}`
      } else {
        next = null
      }
    } else {
      throw new Error('The API returned an unexpected list response.')
    }
  }
  return results
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const request = async (access: string | null) => {
    const headers = new Headers(init.headers)
    if (access) headers.set('Authorization', `Bearer ${access}`)
    return fetch(path, { ...init, headers })
  }

  const tokens = readTokens()
  let response = await request(tokens?.access ?? null)
  if (response.status === 401 && tokens?.refresh) {
    await refreshTokens()
    const refreshed = readTokens()
    response = await request(refreshed?.access ?? null)
  }
  if (!response.ok) {
    if (response.status === 401) clearApiSession()
    throw new Error(await getResponseError(response))
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

async function refreshTokens() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const tokens = readTokens()
      if (!tokens) throw new Error('Your sign-in has expired. Please sign in again.')
      const response = await fetch('/api/auth/token/refresh/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: tokens.refresh }),
      })
      if (!response.ok) {
        clearApiSession()
        throw new Error('Your sign-in has expired. Please sign in again.')
      }
      const renewed = await response.json() as TokenResponse
      saveTokens({ access: renewed.access, refresh: renewed.refresh ?? tokens.refresh })
    })().finally(() => {
      refreshInFlight = null
    })
  }
  await refreshInFlight
}

async function getResponseError(response: Response): Promise<string> {
  const text = await response.text()
  if (!text) return `Request failed (${response.status}).`
  try {
    const body: unknown = JSON.parse(text)
    if (typeof body === 'string') return body
    if (body && typeof body === 'object') {
      const messages = Object.values(body as Record<string, unknown>)
        .flatMap((value) => Array.isArray(value) ? value : [value])
        .filter((value): value is string => typeof value === 'string')
      if (messages.length) return messages.join(' ')
    }
  } catch {
    return text
  }
  return `Request failed (${response.status}).`
}
