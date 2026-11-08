/** Calls to the dashboard API (same origin, session cookie). */
import type { EventPage, Me, Overview, PetSummary } from '../../src/dashTypes.ts'

/** The session ended or never started: show the login page. */
export class LoggedOut extends Error {}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {})
    }
  })
  if (res.status === 401 && path !== '/api/v1/login') throw new LoggedOut()
  const body = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new ApiError(res.status, body.error ?? res.statusText)
  return body
}

export const api = {
  me: () => call<Me>('/api/v1/me'),
  login: (name: string, password: string) =>
    call<Me>('/api/v1/login', { method: 'POST', body: JSON.stringify({ name, password }) }),
  logout: () => call<{ ok: true }>('/api/v1/logout', { method: 'POST', body: '{}' }),
  pets: () => call<PetSummary[]>('/api/v1/dash/pets'),
  overview: (pet: string | null, days: number) =>
    call<Overview>(
      `/api/v1/dash/overview?${new URLSearchParams({ days: String(days), ...(pet ? { pet } : {}) })}`
    ),
  events: (filter: Record<string, string>) =>
    call<EventPage>(`/api/v1/dash/events?${new URLSearchParams(filter)}`)
}
