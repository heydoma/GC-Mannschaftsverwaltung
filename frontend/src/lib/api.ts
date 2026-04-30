import type { Player, Round, LeaderboardEntry, RoundCreate } from './types'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
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

export const createPlayer = (name: string, current_rating?: number) =>
  request<Player>('/players', {
    method: 'POST',
    body: JSON.stringify({ name, current_rating }),
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
