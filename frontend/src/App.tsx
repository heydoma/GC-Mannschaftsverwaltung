import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import DashboardPage from '@/pages/DashboardPage'
import ScoreEntryPage from '@/pages/ScoreEntryPage'
import AdminPage from '@/pages/AdminPage'
import SystemAdminPage from '@/pages/SystemAdminPage'
import LoginPage from '@/pages/LoginPage'
import { useAuth } from '@/lib/auth'

type NavItem = {
  id: string
  label: string
  icon: string
  path: string
  requires?: 'captain' | 'admin'
}

function RequireAuth({ authenticated }: { authenticated: boolean }) {
  if (!authenticated) return <Navigate to="/login" replace />
  return <Outlet />
}

function RequireCaptain({ isCaptain }: { isCaptain: boolean }) {
  if (!isCaptain) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

function RequireAdmin({ isAdmin }: { isAdmin: boolean }) {
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

function Shell() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false
    const saved = localStorage.getItem('theme')
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  const navItems = useMemo<NavItem[]>(
    () => [
      { id: 'dashboard', label: 'Leaderboard', icon: '🏆', path: '/dashboard' },
      { id: 'score', label: 'Score', icon: '⛳', path: '/score' },
      { id: 'admin', label: 'Verwaltung', icon: '⚙️', path: '/admin', requires: 'captain' },
      { id: 'system', label: 'System', icon: '🧭', path: '/system', requires: 'admin' },
    ],
    [],
  )

  const visibleNav = navItems.filter((item) => {
    if (item.requires === 'captain') return !!user?.isCaptain
    if (item.requires === 'admin') return !!user?.isAdmin
    return true
  })

  return (
    <div className="min-h-screen text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-20 right-[-15%] h-72 w-72 rounded-full bg-primary/15 blur-3xl sm:h-96 sm:w-96" />
        <div className="absolute top-52 left-[-20%] h-72 w-72 rounded-full bg-accent/70 blur-3xl sm:h-[28rem] sm:w-[28rem]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-28">
        <header className="pt-6 sm:pt-8">
          <div className="flex flex-col gap-4 rounded-3xl border bg-background/80 px-5 py-5 shadow-sm backdrop-blur sm:flex-row sm:items-end sm:justify-between sm:px-7">
            <div>
              <p className="page-kicker">Golf Team Manager</p>
              <h1 className="page-title text-3xl font-semibold text-foreground sm:text-4xl">
                Leistung. Teamgeist. Struktur.
              </h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Leaderboard, Score-Tracking und Mannschaftsverwaltung in einem klaren Workflow.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                {user?.name ?? user?.email}
              </span>
              <button
                aria-label="Dark Mode umschalten"
                onClick={() => setDark((d) => !d)}
                className="rounded-full border bg-background px-3 py-1 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
              >
                {dark ? '☀️ Hell' : '🌙 Dunkel'}
              </button>
              <button
                onClick={logout}
                className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Abmelden
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 pt-6">
          <div className="rounded-3xl border bg-background/80 shadow-sm backdrop-blur">
            <Outlet />
          </div>
        </main>

        <nav className="fixed bottom-4 left-1/2 z-10 w-[min(100%,720px)] -translate-x-1/2 px-4">
          <div
            className="grid rounded-2xl border bg-background/85 p-1 shadow-lg backdrop-blur"
            style={{ gridTemplateColumns: `repeat(${visibleNav.length}, minmax(0, 1fr))` }}
          >
            {visibleNav.map((item) => {
              const active = location.pathname.startsWith(item.path)
              return (
                <Link
                  key={item.id}
                  to={item.path}
                  className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-xs transition-colors
                    ${active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>

        <Toaster richColors position="top-center" />
      </div>
    </div>
  )
}

export default function App() {
  const { initialized, authenticated, user } = useAuth()

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-4xl animate-pulse">⛳</div>
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={authenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route element={<RequireAuth authenticated={authenticated} />}>
        <Route element={<Shell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/score" element={<ScoreEntryPage />} />
          <Route element={<RequireCaptain isCaptain={!!user?.isCaptain} />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
          <Route element={<RequireAdmin isAdmin={!!user?.isAdmin} />}>
            <Route path="/system" element={<SystemAdminPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
