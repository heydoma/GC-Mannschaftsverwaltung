import { useEffect, useState } from 'react'
import { getPlayers, createPlayer, deletePlayer, getRounds, deleteRound } from '@/lib/api'
import type { Player, Round } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function AdminPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  const loadAll = () => {
    getPlayers().then(setPlayers).catch((e) => toast.error(e.message))
    getRounds().then(setRounds).catch((e) => toast.error(e.message))
  }
  useEffect(() => { loadAll() }, [])

  const handleAddPlayer = async () => {
    if (!newName.trim()) return
    setAdding(true)
    try {
      await createPlayer(newName.trim())
      toast.success(`Spieler "${newName}" angelegt.`)
      setNewName('')
      loadAll()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setAdding(false)
    }
  }

  const handleDeletePlayer = async (p: Player) => {
    if (!confirm(`Spieler "${p.name}" und alle Runden löschen?`)) return
    try {
      await deletePlayer(p.id)
      toast.success(`${p.name} gelöscht.`)
      loadAll()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    }
  }

  const handleDeleteRound = async (r: Round) => {
    if (!confirm(`Runde von ${r.player_name} am ${r.played_on} löschen?`)) return
    try {
      await deleteRound(r.id)
      toast.success('Runde gelöscht.')
      loadAll()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    }
  }

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold">⚙️ Verwaltung</h2>

      {/* Spieler */}
      <Card>
        <CardHeader><CardTitle>Spieler</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Neuer Spieler…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddPlayer()}
            />
            <Button onClick={handleAddPlayer} disabled={adding}>Anlegen</Button>
          </div>
          <ul className="divide-y">
            {players.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span>{p.name}</span>
                <Button size="sm" variant="destructive" onClick={() => handleDeletePlayer(p)}>Löschen</Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Runden-Historie */}
      <Card>
        <CardHeader><CardTitle>Runden-Historie ({rounds.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left pb-2">Spieler</th>
                  <th className="text-left pb-2">Datum</th>
                  <th className="text-right pb-2">Total</th>
                  <th className="text-right pb-2">Diff.</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {rounds.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-2">{r.player_name}</td>
                    <td className="py-2">{r.played_on}</td>
                    <td className="py-2 text-right font-mono">{r.total_score}</td>
                    <td className="py-2 text-right font-mono">
                      {r.differential != null ? r.differential.toFixed(1) : '—'}
                    </td>
                    <td className="py-2 text-right">
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteRound(r)}>🗑</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
