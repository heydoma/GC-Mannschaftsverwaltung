import { useEffect, useState } from 'react'
import { registerTeam, getTeams } from '@/lib/api'
import type { TeamSummary } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function SystemAdminPage() {
  const [teams, setTeams] = useState<TeamSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(true)
  const [form, setForm] = useState({
    team_name: '',
    captain_name: '',
    captain_email: '',
    password: '',
  })

  const loadTeams = () => {
    setRefreshing(true)
    getTeams()
      .then(setTeams)
      .catch((e) => toast.error(e.message))
      .finally(() => setRefreshing(false))
  }

  useEffect(() => {
    loadTeams()
  }, [])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await registerTeam(form)
      toast.success('Mannschaft angelegt.')
      setForm({ team_name: '', captain_name: '', captain_email: '', password: '' })
      loadTeams()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Registrierung fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-5 sm:p-8 space-y-6">
      <div className="space-y-2">
        <p className="page-kicker">System Admin</p>
        <h2 className="page-title text-2xl font-semibold sm:text-3xl">Mandanten verwalten</h2>
        <p className="text-sm text-muted-foreground">
          Neue Mannschaften anlegen und bestehende Teams im Blick behalten.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Neuen Mandanten anlegen</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-3">
              <Input
                placeholder="Mannschaftsname"
                value={form.team_name}
                onChange={(e) => setForm({ ...form, team_name: e.target.value })}
                required
                minLength={2}
              />
              <Input
                placeholder="Captain Name"
                value={form.captain_name}
                onChange={(e) => setForm({ ...form, captain_name: e.target.value })}
                required
                minLength={2}
              />
              <Input
                type="email"
                placeholder="Captain E-Mail"
                value={form.captain_email}
                onChange={(e) => setForm({ ...form, captain_email: e.target.value })}
                required
              />
              <Input
                type="password"
                placeholder="Passwort (min. 8 Zeichen)"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={8}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Wird angelegt…' : 'Mannschaft anlegen'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bestehende Mannschaften</CardTitle>
          </CardHeader>
          <CardContent>
            {refreshing ? (
              <p className="text-sm text-muted-foreground">Lade Teams…</p>
            ) : teams.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Mannschaften angelegt.</p>
            ) : (
              <div className="space-y-3">
                {teams.map((team) => (
                  <div key={team.id} className="rounded-2xl border bg-muted/30 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{team.name}</p>
                        <p className="text-xs text-muted-foreground">ID: {team.id}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(team.created_at).toLocaleDateString('de-DE')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
