import { useEffect, useState } from 'react'
import { Toaster } from '@/components/ui/sonner'
import DashboardPage from '@/pages/DashboardPage'
import ScoreEntryPage from '@/pages/ScoreEntryPage'
import AdminPage from '@/pages/AdminPage'
import LoginPage from '@/pages/LoginPage'
import { useAuth } from '@/lib/auth'

type Tab = 'dashboard' | 'score' | 'admin'

export default function App() {
  const { initialized, authenticated, user, logout } = useAuth()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false
    const saved = localStorage.getItem('theme')
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-4xl animate-pulse">⛳</div>
      </div>
    )
  }

  if (!authenticated) return <LoginPage />

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Leaderboard', icon: '🏆' },
    { id: 'score', label: 'Score', icon: '⛳' },
    ...(user?.isCaptain ? [{ id: 'admin' as Tab, label: 'Verwaltung', icon: '⚙️' }] : []),
  ]

  // If player navigated to admin but isn't captain, reset
  if (tab === 'admin' && !user?.isCaptain) setTab('dashboard')

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-2xl mx-auto">
      <header className="border-b px-4 py-3 flex items-center justify-between sticky top-0 bg-background z-10">
        <h1 className="font-bold text-lg tracking-tight text-primary">⛳ Golf Team Manager</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline truncate max-w-[120px]">
            {user?.name ?? user?.email}
          </span>
          <button
            aria-label="Dark Mode umschalten"
            onClick={() => setDark((d) => !d)}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-sm"
          >
            {dark ? '☀️' : '🌙'}
          </button>
          <button
            onClick={logout}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
          >
            Abmelden
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        {tab === 'dashboard' && <DashboardPage />}
        {tab === 'score' && <ScoreEntryPage />}
        {tab === 'admin' && user?.isCaptain && <AdminPage />}
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl border-t bg-background flex z-10">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex flex-col items-center py-3 gap-0.5 text-xs transition-colors
              ${tab === t.id
                ? 'text-primary font-semibold border-t-2 border-primary -mt-px'
                : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            <span className="text-xl">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      <Toaster richColors position="top-center" />
    </div>
  )
}
