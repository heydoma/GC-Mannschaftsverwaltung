import keycloak from './keycloak'
import type { Player, Round, LeaderboardEntry, RoundCreate } from './types'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  // Refresh token if needed before every request
  if (keycloak.authenticated) {
    await keycloak.updateToken(30).catch(() => {/* expired – let backend reject */})
  }
  const token = keycloak.token
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// ── Players ─────────────────────────────────────────────────────────
export const getPlayers = () => request<Player[]>('/players')

export interface PlayerCreateResult extends Player {
  temporary_password?: string
  message?: string
}

export const createPlayer = (name: string, email: string) =>
  request<PlayerCreateResult>('/players', {
    method: 'POST',
    body: JSON.stringify({ name, email }),
  })

export const deletePlayer = (id: number) =>
  request<void>(`/players/${id}`, { method: 'DELETE' })

// ── Rounds ──────────────────────────────────────────────────────────
export const getRounds = (player_id?: number) =>
  request<Round[]>(player_id ? `/rounds?player_id=${player_id}` : '/rounds')

export const createRound = (data: RoundCreate) =>
  request<{ id: number; differential: number; total_score: number }>('/rounds', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const deleteRound = (id: number) =>
  request<void>(`/rounds/${id}`, { method: 'DELETE' })

// ── Leaderboard ─────────────────────────────────────────────────────
export const getLeaderboard = () => request<LeaderboardEntry[]>('/leaderboard')

// ── Auth ─────────────────────────────────────────────────────────────
export interface RegisterTeamPayload {
  team_name: string
  captain_name: string
  captain_email: string
  password: string
}

export const registerTeam = (data: RegisterTeamPayload) =>
  request<{ team_id: number; player_id: number; message: string }>('/auth/register-team', {
    method: 'POST',
    body: JSON.stringify(data),
  })
