import { useCallback, useEffect, useState } from 'react'
import { getPlayers, createPlayer, deletePlayer, getRounds, deleteRound, updatePlayerRole, analyzePlayer } from '@/lib/api'
import type { Player, Round } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SideSheet } from '@/components/ui/side-sheet'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'
import { Plus, Trash2, BarChart2, ChevronDown, Save } from 'lucide-react'

const SETTINGS_KEY = 'lineup-settings'
const SETTINGS_DEFAULTS = { starterCount: 4, reserveCount: 2 }

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...SETTINGS_DEFAULTS, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { ...SETTINGS_DEFAULTS }
}

export default function AdminPage() {
  const { user, activeTeamId } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [panelOpen, setPanelOpen] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'player' | 'captain'>('player')
  const [roleDrafts, setRoleDrafts] = useState<Record<number, 'player' | 'captain'>>({})
  const [adding, setAdding] = useState(false)
  const [tempPw, setTempPw] = useState<{ name: string; pw: string } | null>(null)
  const [showRounds, setShowRounds] = useState(false)
  // Match-Einstellungen
  const [starterDraft, setStarterDraft] = useState(SETTINGS_DEFAULTS.starterCount)
  const [reserveDraft, setReserveDraft] = useState(SETTINGS_DEFAULTS.reserveCount)


  const loadAll = useCallback(() => {
    getPlayers().then(setPlayers).catch((e) => toast.error(e.message))
    getRounds().then(setRounds).catch((e) => toast.error(e.message))
  }, [activeTeamId])

  useEffect(() => {
    loadAll()
    const s = loadSettings()
    setStarterDraft(s.starterCount)
    setReserveDraft(s.reserveCount)
  }, [loadAll])

  const handleSaveSettings = () => {
    const next = {
      starterCount: Math.max(1, Math.min(12, starterDraft)),
      reserveCount: Math.max(0, Math.min(8, reserveDraft)),
    }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
    setStarterDraft(next.starterCount)
    setReserveDraft(next.reserveCount)
    toast.success('Einstellungen gespeichert.')
  }

  useEffect(() => {
    setRoleDrafts((prev) => {
      const next = { ...prev }
      players.forEach((p) => {
        if (p.role && next[p.id] == null) next[p.id] = p.role
      })
      return next
    })
  }, [players])

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()

  const handleAddPlayer = async () => {
    if (!fullName || !newEmail.trim() || !newPassword.trim()) return
    setAdding(true)
    try {
      const result = await createPlayer(fullName, newEmail.trim(), newPassword.trim(), newRole)
      if (result.temporary_password) {
        setTempPw({ name: result.name, pw: result.temporary_password })
      }
      toast.success(`Spieler "${fullName}" angelegt.`)
      setFirstName('')
      setLastName('')
      setNewEmail('')
      setNewPassword('')
      setNewRole('player')
      setPanelOpen(false)
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
    <div className="p-5 sm:p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="page-kicker">Captain Workspace</p>
          <h2 className="page-title text-2xl font-semibold sm:text-3xl">Team-Verwaltung</h2>
          <p className="text-sm text-muted-foreground">Spieler anlegen, Zugänge verwalten und Runden pflegen.</p>
        </div>
        <Button className="shrink-0 gap-2" onClick={() => setPanelOpen(true)}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Spieler einladen</span>
          <span className="sm:hidden">+</span>
        </Button>
      </div>

      {/* Temp-Passwort Banner */}
      {tempPw && (
        <div className="flex flex-col gap-2 rounded-2xl border border-primary/40 bg-primary/5 px-5 py-4">
          <p className="text-sm font-medium">🔑 Temporäres Passwort für <strong>{tempPw.name}</strong></p>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-sm bg-muted px-3 py-2 rounded-lg select-all">{tempPw.pw}</code>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(tempPw!.pw); toast.success('Kopiert!') }}>
              Kopieren
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Nur einmal sichtbar. Bitte sofort an den Spieler weitergeben.</p>
          <Button size="sm" variant="ghost" className="w-fit" onClick={() => setTempPw(null)}>Schließen</Button>
        </div>
      )}

      {/* Players table */}
      <div className="overflow-x-auto rounded-2xl border bg-background/70">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left hidden sm:table-cell">E-Mail</th>
              <th className="p-3 text-right hidden md:table-cell" title="WHS Handicap-Index (nur HCP-relevante Runden)">HCP</th>
              <th className="p-3 text-left hidden md:table-cell">Beitritt</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const selectedRole = roleDrafts[p.id] ?? p.role ?? 'player'
              const isSelf = p.keycloak_user_id === user?.id
              const isLastCaptain = p.role === 'captain' && captainCount <= 1
              const blockDowngrade = selectedRole === 'player' && (isSelf || isLastCaptain)
              return (
                <tr key={p.id} className="border-t transition-colors hover:bg-muted/20">
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3 text-muted-foreground hidden sm:table-cell">{p.email ?? '—'}</td>
                  <td className="p-3 text-right font-mono font-semibold hidden md:table-cell">
                    {p.current_whs_index != null ? p.current_whs_index.toFixed(1) : '—'}
                  </td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">
                    {p.created_at ? new Date(p.created_at).toLocaleDateString('de-DE') : '—'}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={p.role === 'captain' ? 'default' : 'secondary'}>
                        {p.role === 'captain' ? 'Captain' : 'Player'}
                      </Badge>
                      <select
                        value={selectedRole}
                        onChange={(e) => setRoleDrafts((prev) => ({ ...prev, [p.id]: e.target.value as 'player' | 'captain' }))}
                        className="h-7 rounded-md border bg-background px-2 text-xs"
                      >
                        <option value="player">Player</option>
                        <option value="captain">Captain</option>
                      </select>
                      <Button size="sm" variant="outline" onClick={() => handleRoleSave(p)} disabled={blockDowngrade}>
                        Rolle ändern
                      </Button>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" title="Analyse" onClick={() => handleAnalyze(p)}>
                        <BarChart2 className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" title="Löschen" onClick={() => handleDeletePlayer(p)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Match-Einstellungen */}
      <div className="rounded-2xl border bg-background/70 px-5 py-5 space-y-4">
        <div>
          <p className="text-sm font-semibold">Match-Einstellungen</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Legt fest, wie viele Starter- und Reserveplätze in der Aufstellung angezeigt werden.
            Die Werte gelten für dieses Gerät und werden sofort in der Aufstellung übernommen.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="starterCount">Starter-Plätze</Label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setStarterDraft((v) => Math.max(1, v - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-lg border bg-background text-lg font-semibold hover:bg-muted transition-colors"
              >−</button>
              <input
                id="starterCount"
                type="number"
                min={1}
                max={12}
                value={starterDraft}
                onChange={(e) => setStarterDraft(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))}
                className="h-9 w-16 rounded-lg border bg-background px-3 text-center text-sm font-semibold tabular-nums"
              />
              <button
                type="button"
                onClick={() => setStarterDraft((v) => Math.min(12, v + 1))}
                className="flex h-9 w-9 items-center justify-center rounded-lg border bg-background text-lg font-semibold hover:bg-muted transition-colors"
              >+</button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reserveCount">Reserve-Plätze</Label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setReserveDraft((v) => Math.max(0, v - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-lg border bg-background text-lg font-semibold hover:bg-muted transition-colors"
              >−</button>
              <input
                id="reserveCount"
                type="number"
                min={0}
                max={8}
                value={reserveDraft}
                onChange={(e) => setReserveDraft(Math.max(0, Math.min(8, parseInt(e.target.value) || 0)))}
                className="h-9 w-16 rounded-lg border bg-background px-3 text-center text-sm font-semibold tabular-nums"
              />
              <button
                type="button"
                onClick={() => setReserveDraft((v) => Math.min(8, v + 1))}
                className="flex h-9 w-9 items-center justify-center rounded-lg border bg-background text-lg font-semibold hover:bg-muted transition-colors"
              >+</button>
            </div>
          </div>

          <Button onClick={handleSaveSettings} className="gap-2">
            <Save className="h-4 w-4" />
            Speichern
          </Button>
        </div>
      </div>

      {/* Rounds section (collapsible) */}
      <div className="rounded-2xl border bg-background/70 overflow-hidden">
        <button
          className="flex w-full items-center justify-between px-5 py-4 text-sm font-semibold hover:bg-muted/30 transition-colors"
          onClick={() => setShowRounds((v) => !v)}
        >
          <span>Runden-Historie ({rounds.length})</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${showRounds ? 'rotate-180' : ''}`} />
        </button>
        {showRounds && (
          <div className="overflow-x-auto border-t">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">Spieler</th>
                  <th className="p-3 text-left">Datum</th>
                  <th className="p-3 text-left hidden sm:table-cell">Platz</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-right">Differential</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {rounds.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/20">
                    <td className="p-3">{r.player_name}</td>
                    <td className="p-3 text-muted-foreground">{r.played_on}</td>
                    <td className="p-3 text-muted-foreground hidden sm:table-cell">{r.course_name ?? '—'}</td>
                    <td className="p-3 text-right font-mono font-semibold">{r.total_score}</td>
                    <td className="p-3 text-right font-mono">
                      {r.differential != null ? (
                        <span
                          className={r.is_hcp_relevant ? '' : 'line-through text-muted-foreground'}
                          title={r.is_hcp_relevant ? 'HCP-relevant' : 'Nur internes Ranking'}
                        >
                          {r.differential.toFixed(1)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="p-3 text-right">
                      <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDeleteRound(r)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Player Side-Sheet */}
      <SideSheet
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title="Spieler einladen"
        desktopWidth="40%"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setPanelOpen(false)}>Abbrechen</Button>
            <Button onClick={handleAddPlayer} disabled={adding || !fullName || !newEmail || !newPassword}>
              {adding ? 'Anlegen…' : 'Spieler anlegen'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Vorname</Label>
              <Input placeholder="Max" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Nachname</Label>
              <Input placeholder="Mustermann" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>E-Mail</Label>
            <Input type="email" placeholder="max@golfclub.de" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Temporäres Passwort <span className="text-muted-foreground">(min. 8 Zeichen)</span></Label>
            <Input type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Rolle</Label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as 'player' | 'captain')}
              className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
            >
              <option value="player">Player</option>
              <option value="captain">Captain</option>
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            Der Spieler erhält einen Keycloak-Account. Das temporäre Passwort wird nach dem Speichern angezeigt und muss direkt weitergegeben werden.
          </p>
        </div>
      </SideSheet>

    </div>
  )
}
