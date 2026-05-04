import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import keycloak from './keycloak'
import type { TeamMembership } from './types'
import { getMyTeams, setActiveTeamId } from './api'

export interface AuthUser {
  id: string
  email: string | undefined
  name: string | undefined
  teamId: number | undefined
  roles: string[]
  isCaptain: boolean
  isAdmin: boolean
  isPlayer: boolean
}

interface AuthContextValue {
  /** true once Keycloak.init() has resolved (regardless of auth state) */
  initialized: boolean
  authenticated: boolean
  user: AuthUser | null
  token: string | undefined
  teams: TeamMembership[]
  activeTeamId: number | null
  /** Rolle des Users im aktuell aktiven Team – aus team_memberships, nicht aus JWT */
  activeRole: 'captain' | 'player' | 'admin' | null
  isCaptain: boolean
  isAdmin: boolean
  /** Aktives Team wechseln – lädt die App-Daten neu */
  switchTeam: (teamId: number) => void
  login: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function parseUser(): AuthUser | null {
  if (!keycloak.authenticated || !keycloak.tokenParsed) return null
  const p = keycloak.tokenParsed as Record<string, unknown>
  const roles = (p.realm_access as { roles?: string[] })?.roles ?? []
  const teamIdRaw = p.team_id
  return {
    id: p.sub as string,
    email: p.email as string | undefined,
    name: (p.name ?? p.preferred_username) as string | undefined,
    teamId: teamIdRaw != null ? Number(teamIdRaw) : undefined,
    roles,
    isCaptain: roles.includes('captain'),
    isAdmin: roles.includes('admin'),
    isPlayer: roles.includes('player'),
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | undefined>(undefined)
  const [teams, setTeams] = useState<TeamMembership[]>([])
  const [activeTeamId, setActiveTeamIdState] = useState<number | null>(() => {
    const saved = localStorage.getItem('activeTeamId')
    return saved ? Number(saved) : null
  })

  const switchTeam = useCallback((teamId: number) => {
    setActiveTeamId(teamId)           // api.ts-Modul-Variable
    setActiveTeamIdState(teamId)      // React-State
    localStorage.setItem('activeTeamId', String(teamId))
  }, [])

  useEffect(() => {
    keycloak
      .init({
        onLoad: 'check-sso',
        checkLoginIframe: false,
        pkceMethod: 'S256',
      })
      .then((auth) => {
        setAuthenticated(auth)
        if (auth) {
          setToken(keycloak.token)
          setUser(parseUser())
          // Teams laden und activeTeamId initialisieren
          getMyTeams()
            .then((myTeams) => {
              setTeams(myTeams)
              const saved = localStorage.getItem('activeTeamId')
              const savedId = saved ? Number(saved) : null
              const valid = savedId && myTeams.some((t) => t.team_id === savedId)
              const resolved = valid ? savedId : myTeams[0]?.team_id ?? null
              if (resolved) switchTeam(resolved)
            })
            .catch(() => { /* Teams nicht kritisch */ })
        }
        setInitialized(true)
      })
      .catch(() => setInitialized(true))

    // Refresh token 60s before expiry; redirect to login if refresh token expired
    keycloak.onTokenExpired = () => {
      keycloak.updateToken(60)
        .then((refreshed) => {
          if (refreshed) {
            setToken(keycloak.token)
            setUser(parseUser())
          }
        })
        .catch(() => {
          // Refresh token abgelaufen (400 invalid_grant) → zurück zur Anmeldung
          keycloak.login()
        })
    }
  }, [])

  // Per-Team Rolle aus teams[] ableiten – nicht aus dem globalen JWT
  const activeRole = teams.find((t) => t.team_id === activeTeamId)?.role ?? null
  const isCaptain = activeRole === 'captain' || activeRole === 'admin'
  const isAdmin = activeRole === 'admin' || (user?.isAdmin ?? false)

  const login = () => keycloak.login()
  const logout = () => keycloak.logout({ redirectUri: window.location.origin })

  return (
    <AuthContext.Provider value={{ initialized, authenticated, user, token, teams, activeTeamId, activeRole, isCaptain, isAdmin, switchTeam, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
