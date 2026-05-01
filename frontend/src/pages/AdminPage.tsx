import { useEffect, useState } from 'react'
import { getPlayers, createPlayer, deletePlayer, getRounds, deleteRound, updatePlayerRole, analyzePlayer } from '@/lib/api'
import type { Player, Round } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'

export default function AdminPage() {
  const { user } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'player' | 'captain'>('player')
  const [roleDrafts, setRoleDrafts] = useState<Record<number, 'player' | 'captain'>>({})
  const [adding, setAdding] = useState(false)
  const [tempPw, setTempPw] = useState<{ name: string; pw: string } | null>(null)

  const loadAll = () => {
    getPlayers().then(setPlayers).catch((e) => toast.error(e.message))
    getRounds().then(setRounds).catch((e) => toast.error(e.message))
  }
  useEffect(() => { loadAll() }, [])

  useEffect(() => {
    setRoleDrafts((prev) => {
      const next = { ...prev }
      players.forEach((p) => {
        if (p.role && next[p.id] == null) next[p.id] = p.role
      })
      return next
    })
  }, [players])

  const handleAddPlayer = async () => {
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) return
    setAdding(true)
    try {
      const result = await createPlayer(
        newName.trim(),
        newEmail.trim(),
        newPassword.trim(),
        newRole,
      )
      if (result.temporary_password) {
        setTempPw({ name: result.name, pw: result.temporary_password })
      }
      toast.success(`Spieler "${newName}" angelegt.`)
      setNewName('')
      setNewEmail('')
      setNewPassword('')
      setNewRole('player')
      loadAll()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setAdding(false)
    }
  }

  const handleDeletePlayer = async (p: Player) => {
    if (!confirm(`Spieler "${p.name}" und alle Runden loeschen?`)) return
    try {
      await deletePlayer(p.id)
      toast.success(`${p.name} gelöscht.`)
      loadAll()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    }
  }

  const handleDeleteRound = async (r: Round) => {
    if (!confirm(`Runde von ${r.player_name} am ${r.played_on} loeschen?`)) return
    try {
      await deleteRound(r.id)
      toast.success('Runde geloescht.')
      loadAll()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    }
  }

  const handleRoleSave = async (p: Player) => {
    const role = roleDrafts[p.id]
    if (!role) return
    try {
      await updatePlayerRole(p.id, role)
      toast.success(`Rolle aktualisiert: ${p.name}`)
      loadAll()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    }
  }

  const handleAnalyze = async (p: Player) => {
    try {
      await analyzePlayer(p.id)
      toast.success(`Analyse aktualisiert: ${p.name}`)
      loadAll()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    }
  }

  const captainCount = players.filter((p) => p.role === 'captain').length

  return (
    <div className="p-5 sm:p-8 space-y-6">
      <div className="space-y-2">
        <p className="page-kicker">Captain Workspace</p>
        <h2 className="page-title text-2xl font-semibold sm:text-3xl">Verwaltung</h2>
        <p className="text-sm text-muted-foreground">
          Spieler anlegen, Zugaenge verwalten und Runden pflegen.
        </p>
      </div>

      {/* Temp-Passwort Anzeige */}
      {tempPw && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="pt-4 space-y-2">
            <p className="text-sm font-medium">🔑 Temporaeres Passwort fuer <strong>{tempPw.name}</strong></p>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm bg-muted px-3 py-2 rounded-md select-all">
                {tempPw.pw}
              </code>
              <Button size="sm" variant="outline" onClick={() => {
                navigator.clipboard.writeText(tempPw.pw)
                toast.success('Kopiert!')
              }}>Kopieren</Button>
            </div>
            <p className="text-xs text-muted-foreground">Nur einmal sichtbar. Bitte an Spieler weitergeben.</p>
            <Button size="sm" variant="ghost" onClick={() => setTempPw(null)}>Schließen</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        {/* Spieler anlegen */}
        <Card>
          <CardHeader><CardTitle>Spieler</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2">
              <Input
                placeholder="Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Input
                type="email"
                placeholder="E-Mail"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddPlayer()}
              />
              <Input
                type="password"
                placeholder="Temporaeres Passwort (min. 8 Zeichen)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <label className="text-xs text-muted-foreground">Rolle</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'player' | 'captain')}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="player">Player</option>
                <option value="captain">Captain</option>
              </select>
              <Button onClick={handleAddPlayer} disabled={adding || !newName || !newEmail || !newPassword}>
                Spieler anlegen
              </Button>
            </div>
            <ul className="divide-y">
              {players.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 gap-2">
                  <div>
                    <span className="font-medium">{p.name}</span>
                    {p.email && <span className="text-xs text-muted-foreground ml-2">{p.email}</span>}
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      {(() => {
                        const selectedRole = roleDrafts[p.id] ?? p.role ?? 'player'
                        const isSelf = p.keycloak_user_id === user?.id
                        const isLastCaptain = p.role === 'captain' && captainCount <= 1
                        const blockDowngrade = selectedRole === 'player' && (isSelf || isLastCaptain)
                        return (
                          <>
                            <select
                              value={selectedRole}
                              onChange={(e) =>
                                setRoleDrafts((prev) => ({
                                  ...prev,
                                  [p.id]: e.target.value as 'player' | 'captain',
                                }))
                              }
                              className="h-8 rounded-md border bg-background px-2 text-xs"
                            >
                              <option value="player">Player</option>
                              <option value="captain">Captain</option>
                            </select>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRoleSave(p)}
                              disabled={blockDowngrade}
                            >
                              Rolle aendern
                            </Button>
                            {blockDowngrade && (
                              <span className="text-xs text-muted-foreground">
                                Captain muss bleiben
                              </span>
                            )}
                          </>
                        )
                      })()}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleAnalyze(p)}
                      >
                        Analyse
                      </Button>
                    </div>
                  </div>
                  <Button size="sm" variant="destructive" onClick={() => handleDeletePlayer(p)}>Loeschen</Button>
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
    </div>
  )
}
