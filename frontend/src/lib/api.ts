import keycloak from './keycloak'
import type { Player, Round, LeaderboardEntry, RoundCreate, TeamSummary, Course, Matchday, TeamMembership } from './types'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

/** Aktives Team – wird von auth.tsx gesetzt und hier ausgelesen */
export let activeTeamId: number | null = null
export function setActiveTeamId(id: number | null) { activeTeamId = id }

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  // Refresh token if needed before every request; redirect to login if expired
  if (keycloak.authenticated) {
    await keycloak.updateToken(30).catch(() => keycloak.login())
  }
  const token = keycloak.token
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (activeTeamId != null) headers['X-Active-Team'] = String(activeTeamId)

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

export const createPlayer = (name: string, email: string, password: string, role: 'player' | 'captain') =>
  request<PlayerCreateResult>('/players', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, role }),
  })

export const deletePlayer = (id: number) =>
  request<void>(`/players/${id}`, { method: 'DELETE' })

export const updatePlayerRole = (id: number, role: 'player' | 'captain') =>
  request<{ id: number; role: 'player' | 'captain' }>(`/players/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })

export const analyzePlayer = (id: number) =>
  request<{ player_id: number; current_whs_index: number | null; weighted_rating: number | null; momentum_score: number | null }>(
    `/players/${id}/analyze`,
    { method: 'POST' },
  )

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

export const getTeams = () => request<TeamSummary[]>('/auth/teams')

export const deleteTeam = (teamId: number) =>
  request<void>(`/auth/teams/${teamId}`, { method: 'DELETE' })

export const getMyTeams = () => request<TeamMembership[]>('/auth/my-teams')

// ── Courses ─────────────────────────────────────────────────────────
export const getCourses = () => request<Course[]>('/courses')

export interface CoursePayload {
  name: string
  course_rating?: number | null
  slope_rating?: number | null
  hole_pars?: number[] | null
}

export const createCourse = (data: CoursePayload) =>
  request<Course>('/courses', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const updateCourse = (id: number, data: CoursePayload) =>
  request<Course>(`/courses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })

// ── Matchdays ────────────────────────────────────────────────────────
export const getMatchdays = () => request<Matchday[]>('/matchdays')

export interface MatchdayCreatePayload {
  label: string
  match_date?: string | null
  starters?: number[]
  reserves?: number[]
}

export const createMatchday = (data: MatchdayCreatePayload) =>
  request<Matchday>('/matchdays', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const updateMatchday = (id: number, data: Partial<MatchdayCreatePayload>) =>
  request<Matchday>(`/matchdays/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })

export const togglePublishMatchday = (id: number) =>
  request<Matchday>(`/matchdays/${id}/publish`, { method: 'PATCH' })

export const deleteMatchday = (id: number) =>
  request<void>(`/matchdays/${id}`, { method: 'DELETE' })
