export interface Player {
  id: number
  name: string
  current_rating: number | null
  created_at: string
}

export interface Round {
  id: number
  player_name: string
  played_on: string
  course_rating: number
  slope_rating: number
  hole_scores: number[]
  total_score: number
  differential: number | null
  created_at: string
}

export interface LeaderboardEntry {
  rank: number
  id: number
  name: string
  rounds_count: number
  weighted_rating: number | null
  avg_differential: number | null
  last3_avg: number | null
  momentum: number | null
  form_icon: string
  consistency: number | null
}

export interface RoundCreate {
  player_id: number
  played_on: string
  course_rating: number
  slope_rating: number
  hole_scores: number[]
}
