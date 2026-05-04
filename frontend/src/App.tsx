import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import DashboardPage from '@/pages/DashboardPage'
import ScoreEntryPage from '@/pages/ScoreEntryPage'
import AdminPage from '@/pages/AdminPage'
import LineupPage from '@/pages/LineupPage'
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

function RequireCaptain() {
  const { isCaptain } = useAuth()
  if (!isCaptain) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

function RequireAdmin() {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

function TeamPicker() {
  const { teams, switchTeam } = useAuth()
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="text-4xl">⛳</div>
          <h1 className="text-xl font-bold">Team auswählen</h1>
          <p className="text-sm text-muted-foreground">Du bist in mehreren Mannschaften. Welche möchtest du verwalten?</p>
        </div>
        <div className="space-y-2">
          {teams.map((t) => (
            <button
              key={t.team_id}
              onClick={() => switchTeam(t.team_id)}
              className="flex w-full items-center gap-4 rounded-2xl border bg-card px-5 py-4 text-left transition-colors hover:bg-muted/60 active:scale-[0.98]"
            >
              <div className="flex-1">
                <p className="font-semibold">{t.team_name}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {t.role === 'captain' ? '⚑ Captain' : t.role === 'admin' ? '🛡 Admin' : '🏌️ Spieler'}
                </p>
              </div>
              <span className="text-muted-foreground">→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Shell() {
  const { user, teams, activeTeamId, switchTeam, logout, isCaptain, isAdmin } = useAuth()
  const location = useLocation()
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false
    const saved = localStorage.getItem('theme')
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [gdprOpen, setGdprOpen] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    if (!user) return
    if (!isCaptain && !user.isPlayer) return
    const key = `gdprAccepted:${user.id}`
    const accepted = localStorage.getItem(key)
    if (!accepted) setGdprOpen(true)
  }, [user, isCaptain])

  const acceptGdpr = () => {
    if (!user) return
    localStorage.setItem(`gdprAccepted:${user.id}`, new Date().toISOString())
    setGdprOpen(false)
  }

  const navItems = useMemo<NavItem[]>(
    () => [
      { id: 'dashboard', label: 'Leaderboard', icon: '🏆', path: '/dashboard' },
      { id: 'score', label: 'Score', icon: '⛳', path: '/score' },
      { id: 'lineup', label: 'Aufstellung', icon: '🏌️', path: '/lineup' },
      { id: 'admin', label: 'Verwaltung', icon: '⚙️', path: '/admin', requires: 'captain' },
      { id: 'system', label: 'System', icon: '🧭', path: '/system', requires: 'admin' },
    ],
    [],
  )

  const visibleNav = navItems.filter((item) => {
    if (item.requires === 'captain') return isCaptain
    if (item.requires === 'admin') return isAdmin
    return true
  })

  return (
    <div className="min-h-screen text-foreground">
      {/* Background blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-20 right-[-15%] h-72 w-72 rounded-full bg-primary/15 blur-3xl sm:h-96 sm:w-96" />
        <div className="absolute top-52 left-[-20%] h-72 w-72 rounded-full bg-accent/70 blur-3xl sm:h-[28rem] sm:w-[28rem]" />
      </div>

      {/* ── Desktop Sidebar ────────────────────────────────────── */}
      <aside className="hidden md:flex fixed left-0 top-0 z-20 h-full w-52 flex-col border-r bg-background/85 backdrop-blur-md">
        {/* Brand */}
        <div className="flex items-center justify-between gap-3 border-b px-5 py-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⛳</span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none">Golf Team</p>
              <p className="text-sm font-bold text-foreground">Manager</p>
            </div>
          </div>
          <button
            aria-label="Dark Mode"
            onClick={() => setDark((d) => !d)}
            className="flex h-7 w-7 items-center justify-center rounded-full border bg-background text-sm transition-colors hover:bg-muted shrink-0"
          >
            {dark ? '☀️' : '🌙'}
          </button>
        </div>
        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {visibleNav.map((item) => {
            const active = location.pathname.startsWith(item.path)
            return (
              <Link
                key={item.id}
                to={item.path}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors
                  ${active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>
        {/* User controls */}
        <div className="border-t p-4 space-y-2">
          {teams.length > 1 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Team</p>
              <select
                value={activeTeamId ?? ''}
                onChange={(e) => switchTeam(Number(e.target.value))}
                className="w-full rounded-lg border bg-background px-2 py-1.5 text-xs font-medium text-foreground"
              >
                {teams.map((t) => (
                  <option key={t.team_id} value={t.team_id}>
                    {t.team_name}{t.role === 'captain' ? ' (Captain)' : t.role === 'admin' ? ' (Admin)' : ' (Spieler)'}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="text-xs text-muted-foreground truncate">{user?.name ?? user?.email}</p>
          <button
            onClick={logout}
            className="w-full rounded-lg border px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Abmelden
          </button>
        </div>
      </aside>

      {/* ── Main area (offset on desktop) ─────────────────────── */}
      <div className="md:pl-52 flex h-screen flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden shrink-0 pt-4 px-4 sm:pt-6 sm:px-6">
          <div className="flex items-center justify-between gap-3 rounded-2xl border bg-background/80 px-5 py-3 shadow-sm backdrop-blur">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xl">⛳</span>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest leading-none">Golf Team Manager</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden sm:inline-block text-xs text-muted-foreground truncate max-w-[140px]">
                {user?.name ?? user?.email}
              </span>
              <button
                aria-label="Dark Mode umschalten"
                onClick={() => setDark((d) => !d)}
                className="flex h-8 w-8 items-center justify-center rounded-full border bg-background text-sm transition-colors hover:bg-muted"
              >
                {dark ? '☀️' : '🌙'}
              </button>
              <button
                onClick={logout}
                className="rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Abmelden
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0 px-4 pt-6 pb-28 md:pb-6 md:px-6">
          <div className="h-full rounded-3xl border bg-background/80 shadow-sm backdrop-blur overflow-y-auto">
            <Outlet />
          </div>
        </main>

        <Dialog open={gdprOpen} onOpenChange={() => undefined}>
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>Datenschutz & Einwilligung</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Wir verarbeiten deine Daten nur fuer die Teamverwaltung und die Auswertung deiner Runden. Dazu gehoeren Name, E-Mail und gespielte Scores.</p>
              <p>Mit Klick auf "Einverstanden" bestaetigst du die Speicherung und Verarbeitung deiner Daten im Rahmen dieser Anwendung.</p>
            </div>
            <DialogFooter>
              <Button onClick={acceptGdpr}>Einverstanden</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-4 left-1/2 z-10 w-[min(100%,720px)] -translate-x-1/2 px-4">
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
                    ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
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
  const { initialized, authenticated, teams, activeTeamId } = useAuth()

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-4xl animate-pulse">⛳</div>
      </div>
    )
  }

  // Mehrere Teams aber noch keins ausgewählt → Team-Picker
  if (authenticated && teams.length > 1 && activeTeamId == null) {
    return <TeamPicker />
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
          <Route path="/lineup" element={<LineupPage />} />
          <Route element={<RequireCaptain />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
          <Route element={<RequireAdmin />}>
            <Route path="/system" element={<SystemAdminPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
