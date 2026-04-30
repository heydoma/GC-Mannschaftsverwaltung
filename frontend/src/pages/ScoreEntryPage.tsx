import { useEffect, useRef, useState } from 'react'
import { getPlayers, createRound } from '@/lib/api'
import type { Player } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

const HOLES = Array.from({ length: 18 }, (_, i) => i + 1)

export default function ScoreEntryPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [playerId, setPlayerId] = useState<string>('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [cr, setCr] = useState<string>('')
  const [slope, setSlope] = useState<string>('')
  const [scores, setScores] = useState<string[]>(Array(18).fill(''))
  const [submitting, setSubmitting] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    getPlayers().then(setPlayers).catch((e) => toast.error(e.message))
  }, [])

  const totalScore = scores.reduce((s, v) => s + (parseInt(v) || 0), 0)
  const allFilled = scores.every((v) => parseInt(v) >= 1)
  const crNum = parseFloat(cr)
  const slopeNum = parseInt(slope)
  const liveDiff =
    allFilled && !isNaN(crNum) && !isNaN(slopeNum) && slopeNum > 0
      ? ((113 / slopeNum) * (totalScore - crNum)).toFixed(1)
      : null

  const handleScore = (i: number, val: string) => {
    const updated = [...scores]
    updated[i] = val
    setScores(updated)
    if (val.length >= 1 && parseInt(val) >= 1 && i < 17) {
      inputRefs.current[i + 1]?.focus()
    }
  }

  const handleSubmit = async () => {
    if (!playerId) return toast.error('Bitte Spieler auswählen.')
    if (!allFilled) return toast.error('Alle 18 Löcher müssen ausgefüllt sein.')
    setSubmitting(true)
    try {
      await createRound({
        player_id: parseInt(playerId),
        played_on: date,
        course_rating: crNum,
        slope_rating: slopeNum,
        hole_scores: scores.map(Number),
      })
      toast.success('Runde gespeichert! ⛳')
      setScores(Array(18).fill(''))
      setPlayerId('')
      inputRefs.current[0]?.focus()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Fehler beim Speichern')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <h2 className="text-xl font-bold">⛳ Score eingeben</h2>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Spieler</Label>
          <Select value={playerId} onValueChange={setPlayerId}>
            <SelectTrigger><SelectValue placeholder="Spieler wählen…" /></SelectTrigger>
            <SelectContent>
              {players.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Datum</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div />
        <div>
          <Label>Course Rating (CR)</Label>
          <Input type="number" step="0.1" placeholder="71.0" value={cr} onChange={(e) => setCr(e.target.value)} />
        </div>
        <div>
          <Label>Slope</Label>
          <Input type="number" placeholder="125" value={slope} onChange={(e) => setSlope(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">18-Loch-Grid</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-6 gap-2">
            {HOLES.map((hole, i) => (
              <div key={hole} className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">{hole}</span>
                <Input
                  ref={(el) => { inputRefs.current[i] = el }}
                  inputMode="numeric"
                  maxLength={2}
                  value={scores[i]}
                  onChange={(e) => handleScore(i, e.target.value)}
                  className="text-center p-1 h-9 text-sm"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm bg-muted rounded-lg px-4 py-2">
        <span>Total: <strong>{totalScore || '—'}</strong></span>
        <span>Differenzial: <strong>{liveDiff ?? '—'}</strong></span>
      </div>

      <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Speichern…' : 'Runde speichern'}
      </Button>
    </div>
  )
}
