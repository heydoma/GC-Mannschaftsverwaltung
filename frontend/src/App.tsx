import { useState } from 'react'
import { Toaster } from '@/components/ui/sonner'
import DashboardPage from '@/pages/DashboardPage'
import ScoreEntryPage from '@/pages/ScoreEntryPage'
import AdminPage from '@/pages/AdminPage'

type Tab = 'dashboard' | 'score' | 'admin'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Leaderboard', icon: '🏆' },
  { id: 'score', label: 'Score', icon: '⛳' },
  { id: 'admin', label: 'Verwaltung', icon: '⚙️' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard')

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-2xl mx-auto">
      <header className="border-b px-4 py-3 flex items-center justify-between sticky top-0 bg-background z-10">
        <h1 className="font-bold text-lg tracking-tight">⛳ Golf Team Manager</h1>
        <span className="text-xs text-muted-foreground hidden sm:inline">Captain Dashboard</span>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        {tab === 'dashboard' && <DashboardPage />}
        {tab === 'score' && <ScoreEntryPage />}
        {tab === 'admin' && <AdminPage />}
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl border-t bg-background flex z-10">
        {TABS.map((t) => (
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
