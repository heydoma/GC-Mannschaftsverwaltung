import { useEffect, useMemo, useRef, useState } from 'react'
import { createCourse, createRound, getCourses, getPlayers, updateCourse } from '@/lib/api'
import type { Course, Player } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'

const HOLES = Array.from({ length: 18 }, (_, i) => i + 1)

export default function ScoreEntryPage() {
  const { user } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [playerId, setPlayerId] = useState<string>('')
  const [courses, setCourses] = useState<Course[]>([])
  const [courseName, setCourseName] = useState('')
  const [courseId, setCourseId] = useState<number | null>(null)
  const [courseModalOpen, setCourseModalOpen] = useState(false)
  const [courseModalMode, setCourseModalMode] = useState<'create' | 'edit'>('create')
  const [courseDraft, setCourseDraft] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [cr, setCr] = useState<string>('')
  const [slope, setSlope] = useState<string>('')
  const [scores, setScores] = useState<string[]>(Array(18).fill(''))
  const [submitting, setSubmitting] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    getPlayers().then(setPlayers).catch((e) => toast.error(e.message))
    getCourses().then(setCourses).catch((e) => toast.error(e.message))
  }, [])

  useEffect(() => {
    if (!user || user.isCaptain) return
    const own = players.find((p) => p.keycloak_user_id === user.id)
    if (own) setPlayerId(String(own.id))
  }, [players, user])

  const courseOptions = useMemo(
    () => courses.map((course) => ({ id: course.id, name: course.name })),
    [courses]
  )

  const canEditCourses = !!user?.isAdmin

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

  const handleCourseInput = (value: string) => {
    setCourseName(value)
    const match = courseOptions.find((c) => c.name.toLowerCase() === value.toLowerCase())
    setCourseId(match ? match.id : null)
  }

  const openCourseModal = (mode: 'create' | 'edit') => {
    setCourseModalMode(mode)
    setCourseDraft(mode === 'edit' ? courseName : '')
    setCourseModalOpen(true)
  }

  const submitCourse = async () => {
    const trimmed = courseDraft.trim()
    if (!trimmed) return
    try {
      if (courseModalMode === 'create') {
        const created = await createCourse(trimmed)
        setCourses((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
        setCourseName(created.name)
        setCourseId(created.id)
        toast.success('Platz angelegt.')
      } else if (courseId) {
        const updated = await updateCourse(courseId, trimmed)
        setCourses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
        setCourseName(updated.name)
        setCourseId(updated.id)
        toast.success('Platz aktualisiert.')
      }
      setCourseModalOpen(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Fehler beim Speichern')
    }
  }

  const handleSubmit = async () => {
    if (!playerId) return toast.error('Bitte Spieler auswählen.')
    if (courseName && !courseId) return toast.error('Bitte einen gueltigen Platz auswaehlen.')
    if (!allFilled) return toast.error('Alle 18 Löcher müssen ausgefüllt sein.')
    setSubmitting(true)
    try {
      await createRound({
        player_id: parseInt(playerId),
        course_id: courseId ?? undefined,
        played_on: date,
        course_rating: crNum,
        slope_rating: slopeNum,
        hole_scores: scores.map(Number),
      })
      toast.success('Runde gespeichert! ⛳')
      setScores(Array(18).fill(''))
      if (user?.isCaptain) setPlayerId('')
      inputRefs.current[0]?.focus()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Fehler beim Speichern')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-5 sm:p-8 space-y-6">
      <div className="space-y-2">
        <p className="page-kicker">Score Tracking</p>
        <h2 className="page-title text-2xl font-semibold sm:text-3xl">Runde erfassen</h2>
        <p className="text-sm text-muted-foreground">
          Kursdaten, Spieltag und 18-Loch-Score in einem klaren Ablauf.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Runden-Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Spieler</Label>
              <Select value={playerId} onValueChange={(v) => setPlayerId(v ?? '')}>
                <SelectTrigger disabled={!user?.isCaptain}><SelectValue placeholder="Spieler wählen…" /></SelectTrigger>
                <SelectContent>
                  {players.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {!user?.isCaptain && (
                <p className="text-xs text-muted-foreground">
                  Du kannst nur deine eigenen Runden eintragen.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Platz</Label>
                {canEditCourses && (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => openCourseModal('create')}
                    >
                      Platz hinzufuegen
                    </button>
                    <button
                      type="button"
                      className="text-primary hover:underline disabled:text-muted-foreground"
                      onClick={() => openCourseModal('edit')}
                      disabled={!courseId}
                    >
                      Platz bearbeiten
                    </button>
                  </div>
                )}
              </div>
              <Input
                list="course-list"
                placeholder="Platz waehlen…"
                value={courseName}
                onChange={(e) => handleCourseInput(e.target.value)}
              />
              <datalist id="course-list">
                {courseOptions.map((course) => (
                  <option key={course.id} value={course.name} />
                ))}
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-3">
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

            <div className="rounded-2xl border bg-muted/40 px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Total</span>
                <span className="font-semibold">{totalScore || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Differenzial</span>
                <span className="font-semibold">{liveDiff ?? '—'}</span>
              </div>
            </div>

            <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Speichern…' : 'Runde speichern'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle>18-Loch-Grid</CardTitle></CardHeader>
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
      </div>

      <Dialog open={courseModalOpen} onOpenChange={setCourseModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {courseModalMode === 'create' ? 'Platz hinzufuegen' : 'Platz bearbeiten'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={courseDraft}
              onChange={(e) => setCourseDraft(e.target.value)}
              placeholder="z.B. Golfclub Musterstadt"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCourseModalOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={submitCourse}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
