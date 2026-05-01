import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth'

export default function LoginPage() {
  const { login } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border bg-background/80 p-8 shadow-sm backdrop-blur">
          <p className="page-kicker">Golf Team Manager</p>
          <h1 className="page-title mt-3 text-3xl font-semibold text-foreground sm:text-4xl">
            Kader und Performance in Bestform.
          </h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-md">
            Erfasse Scores, halte die Formkurve im Blick und verwalte dein Team in einem klaren Ablauf.
          </p>
          <div className="mt-6 grid gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="text-xl">🏌️</span>
              <span>Runden mit Differenzial-Check in Sekunden.</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl">🏆</span>
              <span>Leaderboard mit Form- und Konstanzwerten.</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl">🧭</span>
              <span>Captain-Workflow fuer Spielerzugaenge.</span>
            </div>
          </div>
        </div>

        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-center">Willkommen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" size="lg" onClick={() => login()}>
              Anmelden
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Neue Mannschaften koennen nur durch den System-Admin angelegt werden.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
