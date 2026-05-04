export interface Player {
  id: number
  name: string
  email: string | null
  current_rating: number | null
  current_whs_index: number | null
  keycloak_user_id: string | null
  created_at: string
  role?: 'player' | 'captain' | null
}

export interface Round {
  id: number
  player_name: string
  played_on: string
  course_id: number | null
  course_name: string | null
  course_rating: number
  slope_rating: number
  hole_scores: number[]
  total_score: number
  differential: number | null
  is_hcp_relevant: boolean
  created_at: string
}

export interface LeaderboardEntry {
  rank: number
  id: number
  name: string
  rounds_count: number
  matchdays_count: number
  avg_differential: number | null
  last3_avg: number | null
  momentum: number | null
  form_icon: string
  consistency: number | null
  current_whs_index: number | null
  ranking_score: number | null
}

export interface RoundCreate {
  player_id: number
  course_id?: number | null
  played_on: string
  course_rating: number
  slope_rating: number
  hole_scores: number[]
  is_hcp_relevant: boolean
}

export interface TeamSummary {
  id: number
  name: string
  created_at: string
}

export interface Course {
  id: number
  name: string
  course_rating: number | null
  slope_rating: number | null
  hole_pars: number[] | null   // 18-element array of par values per hole
  created_at: string
}

export interface LineupSlot {
  id: string
  type: 'starter' | 'reserve'
  position: number
  playerId?: number
}

export interface TeamMembership {
  team_id: number
  team_name: string
  role: 'captain' | 'player' | 'admin'
}

export interface Matchday {
  id: number
  label: string
  match_date: string | null
  starters: number[]   // player IDs in order
  reserves: number[]   // player IDs in order
  published: boolean
  created_at: string
}
