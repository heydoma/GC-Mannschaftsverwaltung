import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import keycloak from './keycloak'

export interface AuthUser {
  id: string
  email: string | undefined
  name: string | undefined
  teamId: number | undefined
  roles: string[]
  isCaptain: boolean
  isAdmin: boolean
}

interface AuthContextValue {
  /** true once Keycloak.init() has resolved (regardless of auth state) */
  initialized: boolean
  authenticated: boolean
  user: AuthUser | null
  token: string | undefined
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
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | undefined>(undefined)

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
        }
        setInitialized(true)
      })
      .catch(() => setInitialized(true))

    // Refresh token 60s before expiry
    keycloak.onTokenExpired = () => {
      keycloak.updateToken(60).then((refreshed) => {
        if (refreshed) {
          setToken(keycloak.token)
          setUser(parseUser())
        }
      })
    }
  }, [])

  const login = () => keycloak.login()
  const logout = () => keycloak.logout({ redirectUri: window.location.origin })

  return (
    <AuthContext.Provider value={{ initialized, authenticated, user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
