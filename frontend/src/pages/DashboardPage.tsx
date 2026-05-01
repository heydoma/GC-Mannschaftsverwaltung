import { useEffect, useState } from 'react'
import { getLeaderboard } from '@/lib/api'
import type { LeaderboardEntry } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export default function DashboardPage() {
  const [data, setData] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getLeaderboard()
      .then(setData)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="p-4 text-muted-foreground">Lade Leaderboard…</p>
  if (data.length === 0)
    return <p className="p-4 text-muted-foreground">Noch keine Spieler oder Runden vorhanden.</p>

  return (
    <div className="p-5 sm:p-8 space-y-6">
      <div className="space-y-2">
        <p className="page-kicker">Team Performance</p>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="page-title text-2xl font-semibold sm:text-3xl">Leaderboard</h2>
          <Badge variant="secondary">Live</Badge>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Sicht auf Rating, Konstanz und Form. Spieler ohne Runden wandern ans Ende.
        </p>
      </div>

      {/* Desktop-Tabelle */}
      <div className="hidden sm:block overflow-x-auto rounded-2xl border bg-background/70">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              <th className="p-3 text-left w-12">#</th>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-right">Weighted Rating</th>
              <th className="p-3 text-right">Runden</th>
              <th className="p-3 text-center">Form</th>
              <th className="p-3 text-right">Konstanz (σ)</th>
            </tr>
          </thead>
          <tbody>
            {data.map((e) => (
              <tr key={e.id} className="border-t hover:bg-muted/40 transition-colors">
                <td className="p-3 font-semibold text-muted-foreground">{e.rank}</td>
                <td className="p-3 font-medium">{e.name}</td>
                <td className="p-3 text-right font-mono">
                  {e.weighted_rating != null ? e.weighted_rating.toFixed(1) : '—'}
                </td>
                <td className="p-3 text-right">{e.rounds_count}</td>
                <td className="p-3 text-center text-lg">{e.form_icon}</td>
                <td className="p-3 text-right">
                  {e.consistency != null ? (
                    <Badge variant={e.consistency < 3 ? 'default' : e.consistency < 6 ? 'secondary' : 'destructive'}>
                      {e.consistency.toFixed(1)}
                    </Badge>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile-Karten */}
      <div className="sm:hidden space-y-3">
        {data.map((e) => (
          <Card key={e.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span><span className="text-muted-foreground mr-2">#{e.rank}</span>{e.name}</span>
                <span className="text-2xl">{e.form_icon}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Weighted Rating</p>
                <p className="font-mono font-semibold">
                  {e.weighted_rating != null ? e.weighted_rating.toFixed(1) : '—'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Runden</p>
                <p className="font-semibold">{e.rounds_count}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Konstanz (σ)</p>
                <p className="font-semibold">{e.consistency != null ? e.consistency.toFixed(1) : '—'}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
