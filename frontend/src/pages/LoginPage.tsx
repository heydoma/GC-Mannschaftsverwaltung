import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'
import { registerTeam } from '@/lib/api'

export default function LoginPage() {
  const { login } = useAuth()
  const [showRegister, setShowRegister] = useState(false)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    team_name: '',
    captain_name: '',
    captain_email: '',
    password: '',
  })

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await registerTeam(form)
      toast.success('Mannschaft angelegt! Bitte jetzt einloggen.')
      login()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Registrierung fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Hero */}
      <div className="mb-8 text-center">
        <div className="text-6xl mb-3">⛳</div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Golf Team Manager</h1>
        <p className="text-muted-foreground mt-2 text-sm">Kader-Verwaltung & Performance-Tracking</p>
      </div>

      {!showRegister ? (
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-center">Willkommen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" size="lg" onClick={() => login()}>
              Anmelden
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">oder</span>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setShowRegister(true)}>
              Neue Mannschaft registrieren
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Mannschaft registrieren</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-3">
              <Input
                placeholder="Mannschaftsname"
                value={form.team_name}
                onChange={(e) => setForm({ ...form, team_name: e.target.value })}
                required minLength={2}
              />
              <Input
                placeholder="Captain Name"
                value={form.captain_name}
                onChange={(e) => setForm({ ...form, captain_name: e.target.value })}
                required minLength={2}
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
                required minLength={8}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Wird angelegt…' : 'Mannschaft anlegen'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setShowRegister(false)}
              >
                Zurück zum Login
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
