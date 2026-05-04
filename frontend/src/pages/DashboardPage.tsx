import { Fragment, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { getLeaderboard } from '@/lib/api'
import type { LeaderboardEntry } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { usePagination } from '@/lib/usePagination'
import { TableToolbar } from '@/components/ui/TableToolbar'

function buildSummary(e: LeaderboardEntry): string {
  const parts: string[] = []

  // HCP-Anker
  if (e.current_whs_index != null) {
    if (e.current_whs_index <= 5) {
      parts.push(`Starkes Handicap (${e.current_whs_index.toFixed(1)}) sichert Position`)
    } else if (e.current_whs_index <= 12) {
      parts.push(`Solides Handicap (${e.current_whs_index.toFixed(1)})`)
    } else {
      parts.push(`Handicap ${e.current_whs_index.toFixed(1)}`)
    }
  }

  // Aktuelle Form
  if (e.momentum != null) {
    if (e.momentum > 2) {
      parts.push('Form deutlich verbessert 🔥')
    } else if (e.momentum > 0.5) {
      parts.push('Leicht aufsteigende Form')
    } else if (e.momentum < -2) {
      parts.push('Form zuletzt schwächer ❄️')
    } else if (e.momentum < -0.5) {
      parts.push('Leicht nachgelassene Form')
    } else {
      parts.push('Konstante Form')
    }
  }

  // Letzte 3 vs. Gesamtschnitt
  if (e.last3_avg != null && e.avg_differential != null) {
    const diff = e.avg_differential - e.last3_avg
    if (diff > 1.5) {
      parts.push(`Letzte 3 Runden deutlich besser (Ø ${e.last3_avg.toFixed(1)} vs. ${e.avg_differential.toFixed(1)})`)
    } else if (diff < -1.5) {
      parts.push(`Letzte 3 Runden schwächer (Ø ${e.last3_avg.toFixed(1)} vs. ${e.avg_differential.toFixed(1)})`)
    }
  }

  // Aktivität
  if (e.rounds_count === 0) {
    parts.push('Noch keine Runden eingetragen')
  } else if (e.rounds_count >= 15) {
    parts.push(`Sehr aktiv (${e.rounds_count} Runden)`)
  } else if (e.rounds_count >= 8) {
    parts.push(`Aktiv (${e.rounds_count} Runden)`)
  } else {
    parts.push(`${e.rounds_count} Runden`)
  }

  return parts.join(' · ')
}

export default function DashboardPage() {
  const { activeTeamId } = useAuth()
  const [data, setData] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const pagination = usePagination(data, 25)

  useEffect(() => {
    setLoading(true)
    getLeaderboard()
      .then(setData)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [activeTeamId])

  if (loading) return <p className="p-4 text-muted-foreground">Lade Leaderboard…</p>
  if (data.length === 0)
    return <p className="p-4 text-muted-foreground">Noch keine Spieler oder Runden vorhanden.</p>

  return (
    <div className="h-full flex flex-col p-5 sm:p-8 gap-6">
      <div className="shrink-0 space-y-2">
        <p className="page-kicker">Team Performance</p>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="page-title text-2xl font-semibold sm:text-3xl">Leaderboard</h2>
          <Badge variant="secondary">Live</Badge>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Sicht auf Rating, Konstanz und Form. Spieler ohne Runden wandern ans Ende.
        </p>
      </div>

      {/* Desktop-Tabelle – flex-1 + min-h-0 = füllt restliche Viewport-Höhe und scrollt */}
      <div className="hidden sm:flex flex-col flex-1 min-h-0 rounded-2xl border bg-background/70 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/60 text-muted-foreground">
              <tr>
                <th className="p-3 text-left w-10">#</th>
                <th className="p-3 text-center w-12">Form</th>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-right">HCP</th>
                <th className="p-3 text-right">Runden</th>
                <th className="p-3 text-right">Spieltage</th>
              </tr>
            </thead>
            <tbody>
              {pagination.pageItems.map((e) => (
                <Fragment key={e.id}>
                  <tr
                    className="border-t hover:bg-muted/40 transition-colors cursor-pointer select-none"
                    onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                  >
                    <td className="p-3 font-semibold text-muted-foreground">{e.rank}</td>
                    <td className="p-3 text-center text-xl" title={
                      e.form_icon === '🔥' ? 'Heiße Form' : e.form_icon === '❄️' ? 'Kalte Form' : 'Neutrale Form'
                    }>{e.form_icon}</td>
                    <td className="p-3 font-medium">{e.name}</td>
                    <td className="p-3 text-right font-mono">
                      {e.current_whs_index != null ? e.current_whs_index.toFixed(1) : '—'}
                    </td>
                    <td className="p-3 text-right font-mono text-muted-foreground">
                      {e.rounds_count}
                    </td>
                    <td className="p-3 text-right font-mono text-muted-foreground">
                      {e.matchdays_count}
                    </td>
                  </tr>
                  {expandedId === e.id && (
                    <tr className="bg-muted/20">
                      <td colSpan={6} className="px-4 py-3">
                        <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Warum steht {e.name} hier?</p>
                        <p className="text-sm">{buildSummary(e)}</p>
                        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                          {e.avg_differential != null && (
                            <span>Ø Differential: <span className="font-mono font-semibold text-foreground">{e.avg_differential.toFixed(1)}</span></span>
                          )}
                          {e.last3_avg != null && (
                            <span>Letzte 3: <span className="font-mono font-semibold text-foreground">{e.last3_avg.toFixed(1)}</span></span>
                          )}
                          {e.consistency != null && (
                            <span>Konstanz (StdAbw): <span className="font-mono font-semibold text-foreground">{e.consistency.toFixed(1)}</span></span>
                          )}
                          <span>Spieltage: <span className="font-mono font-semibold text-foreground">{e.matchdays_count}</span></span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground/60">Ranking = 65% aktuelle Form · 35% HCP-Index als Potential-Anker</p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <TableToolbar
          page={pagination.page}
          pageSize={pagination.pageSize}
          totalItems={pagination.totalItems}
          totalPages={pagination.totalPages}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </div>

      {/* Mobile-Karten – flex-1 + overflow-y-auto = scrollbar innerhalb der Seite */}
      <div className="sm:hidden flex-1 min-h-0 overflow-y-auto space-y-3">
        {data.map((e) => (
          <Card
            key={e.id}
            className="cursor-pointer select-none"
            onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span>
                  <span className="text-muted-foreground mr-2">#{e.rank}</span>
                  {e.name}
                </span>
                <span className="text-2xl">{e.form_icon}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">HCP</p>
                  <p className="font-mono font-semibold">
                    {e.current_whs_index != null ? e.current_whs_index.toFixed(1) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Runden</p>
                  <p className="font-mono font-semibold text-muted-foreground">
                    {e.rounds_count}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Spieltage</p>
                  <p className="font-mono font-semibold text-muted-foreground">
                    {e.matchdays_count}
                  </p>
                </div>
              </div>
              {expandedId === e.id && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Warum steht {e.name} hier?</p>
                  <p className="text-sm">{buildSummary(e)}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {e.avg_differential != null && (
                      <span>Ø Diff: <span className="font-mono font-semibold text-foreground">{e.avg_differential.toFixed(1)}</span></span>
                    )}
                    {e.last3_avg != null && (
                      <span>Letzte 3: <span className="font-mono font-semibold text-foreground">{e.last3_avg.toFixed(1)}</span></span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground/60">65% Form · 35% HCP-Anker</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
