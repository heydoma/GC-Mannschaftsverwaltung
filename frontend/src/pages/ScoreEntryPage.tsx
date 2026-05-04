import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { createRound, getCourses, getPlayers, getRounds } from '@/lib/api'
import type { Course, Player, Round } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SideSheet } from '@/components/ui/side-sheet'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'
import { Plus, User } from 'lucide-react'

const DEFAULT_PAR = 4
const HOLES = Array.from({ length: 18 }, (_, i) => i + 1)

const roundSchema = z.object({
  playerId: z.string().min(1, 'Spieler auswählen'),
  courseName: z.string().optional(),
  courseId: z.number().nullable(),
  date: z.string().min(1, 'Datum eingeben'),
  scores: z
    .array(z.string())
    .length(18)
    .refine((s) => s.every((v) => parseInt(v) >= 1), { message: 'Alle 18 Löcher ausfüllen (mind. 1)' }),
})

type RoundFormValues = z.infer<typeof roundSchema>

export default function ScoreEntryPage() {
  const { user, activeTeamId, isCaptain } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [filterPlayerId, setFilterPlayerId] = useState<string>('')
  const [panelOpen, setPanelOpen] = useState(false)
  const [loadingRounds, setLoadingRounds] = useState(false)
  const [isHcpRelevant, setIsHcpRelevant] = useState(true)
  // CR/Slope auto-loaded from last known round for selected course
  const [panelCr, setPanelCr] = useState<number | null>(null)
  const [panelSlope, setPanelSlope] = useState<number | null>(null)
  const scoreInputRefs = useRef<(HTMLInputElement | null)[]>([])

  const form = useForm<RoundFormValues>({
    resolver: zodResolver(roundSchema) as never,
    defaultValues: {
      playerId: '',
      courseName: '',
      courseId: null,
      date: new Date().toISOString().slice(0, 10),
      scores: Array(18).fill(''),
    },
  })

  const { control, handleSubmit, watch, setValue, reset, formState: { errors, isSubmitting } } = form

  const watchedScores = watch('scores')
  const watchedCourseId = watch('courseId')

  // Always load all rounds (client-side filtering for display)
  const loadRounds = useCallback(() => {
    setLoadingRounds(true)
    getRounds()
      .then(setRounds)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoadingRounds(false))
  }, [activeTeamId])

  const loadData = useCallback(() => {
    getPlayers().then(setPlayers).catch((e) => toast.error(e.message))
    getCourses().then(setCourses).catch((e) => toast.error(e.message))
  }, [activeTeamId])

  useEffect(() => { loadData(); loadRounds() }, [loadData, loadRounds])

  // Non-captains are locked to their own player
  useEffect(() => {
    if (!user || isCaptain) return
    const own = players.find((p) => p.keycloak_user_id === user.id)
    if (own) setFilterPlayerId(String(own.id))
  }, [players, user, isCaptain])

  const courseOptions = useMemo(
    () => courses.map((c) => ({ id: c.id, name: c.name, hole_pars: c.hole_pars, course_rating: c.course_rating, slope_rating: c.slope_rating })),
    [courses],
  )

  const selectedCourse = useMemo(
    () => watchedCourseId != null ? courseOptions.find((c) => c.id === watchedCourseId) : undefined,
    [watchedCourseId, courseOptions],
  )

  // Lookup CR/Slope: prefer course master data, fall back to most recent round
  const lookupCourseStats = useCallback((courseId: number | null) => {
    if (courseId == null) { setPanelCr(null); setPanelSlope(null); return }
    const course = courses.find((c) => c.id === courseId)
    if (course?.course_rating != null && course.slope_rating != null) {
      setPanelCr(course.course_rating)
      setPanelSlope(course.slope_rating)
      return
    }
    // Fall back to most recent round on this course
    const matching = rounds
      .filter((r) => r.course_id === courseId)
      .sort((a, b) => b.played_on.localeCompare(a.played_on))
    if (matching.length > 0) {
      setPanelCr(matching[0].course_rating)
      setPanelSlope(matching[0].slope_rating)
    } else {
      setPanelCr(null)
      setPanelSlope(null)
    }
  }, [courses, rounds])

  const totalScore = watchedScores.reduce((s, v) => s + (parseInt(v) || 0), 0)
  const allFilled = watchedScores.every((v) => parseInt(v) >= 1)
  const liveDiff =
    allFilled && panelCr != null && panelSlope != null && panelSlope > 0
      ? ((113 / panelSlope) * (totalScore - panelCr)).toFixed(1)
      : null

  const openPanel = () => {
    setPanelCr(null)
    setPanelSlope(null)
    setIsHcpRelevant(true)
    reset({
      playerId: filterPlayerId,
      courseName: '',
      courseId: null,
      date: new Date().toISOString().slice(0, 10),
      scores: Array(18).fill(''),
    })
    setPanelOpen(true)
  }

  const onSubmit = async (raw: RoundFormValues) => {
    if (panelCr == null || panelSlope == null) {
      return toast.error('Kein CR/Slope für diesen Platz gefunden. Bitte zuerst eine Runde mit CR/Slope manuell anlegen.')
    }
    try {
      await createRound({
        player_id: parseInt(raw.playerId),
        course_id: raw.courseId ?? undefined,
        played_on: raw.date,
        course_rating: panelCr,
        slope_rating: panelSlope,
        hole_scores: raw.scores.map(Number),
        is_hcp_relevant: isHcpRelevant,
      })
      toast.success('Runde gespeichert! ⛳')
      setPanelOpen(false)
      loadRounds()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Fehler beim Speichern')
    }
  }

  const handleScoreInput = (i: number, val: string) => {
    const updated = [...watchedScores]
    updated[i] = val
    setValue('scores', updated)
    if (val.length >= 1 && parseInt(val) >= 1 && i < 17) {
      scoreInputRefs.current[i + 1]?.focus()
    }
  }

  const visibleRounds = useMemo(() => {
    if (!filterPlayerId) return rounds
    return rounds.filter((r) => {
      const player = players.find((p) => String(p.id) === filterPlayerId)
      return player ? r.player_name === player.name : true
    })
  }, [rounds, filterPlayerId, players])

  const sidebarPlayers = isCaptain
    ? players
    : players.filter((p) => p.keycloak_user_id === user?.id)

  return (
    <div className="flex h-full min-h-[600px] flex-col sm:flex-row">
      {/* ── Sidebar ─────────────────────────────── */}
      <aside className="shrink-0 border-b sm:border-b-0 sm:border-r sm:w-56 lg:w-64">
        <div className="px-4 py-5">
          <p className="page-kicker mb-3">Spieler</p>
          <ul className="space-y-1">
            {sidebarPlayers.map((p) => {
              const active = filterPlayerId === String(p.id)
              return (
                <li key={p.id}>
                  <button
                    onClick={() => setFilterPlayerId(active ? '' : String(p.id))}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors
                      ${active
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted text-foreground'
                      }`}
                  >
                    <User className="h-4 w-4 shrink-0 opacity-60" />
                    <span className="truncate font-medium">{p.name}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────── */}
      <div className="flex-1 overflow-hidden p-5 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="page-kicker">Score Tracking</p>
            <h2 className="page-title text-2xl font-semibold sm:text-3xl">Runden-Historie</h2>
          </div>
          <Button onClick={openPanel} className="shrink-0 gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Runde hinzufügen</span>
            <span className="sm:hidden">+</span>
          </Button>
        </div>

        {/* Rounds table */}
        <div className="overflow-x-auto rounded-2xl border bg-background/70">
          {loadingRounds ? (
            <p className="p-6 text-sm text-muted-foreground">Lade Runden…</p>
          ) : visibleRounds.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Keine Runden vorhanden.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">Spieler</th>
                  <th className="p-3 text-left">Datum</th>
                  <th className="p-3 text-left hidden sm:table-cell">Platz</th>
                  <th className="p-3 text-right">Score</th>
                  <th className="p-3 text-right">Differential</th>
                </tr>
              </thead>
              <tbody>
                {visibleRounds.map((r) => (
                  <tr key={r.id} className="border-t transition-colors hover:bg-muted/30">
                    <td className="p-3 font-medium">{r.player_name}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Add Round Side-Sheet ─────────────────── */}
      <SideSheet
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title="Runde hinzufügen"
        fullscreen
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setPanelOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
              {isSubmitting ? 'Speichern…' : 'Runde speichern'}
            </Button>
          </div>
        }
      >
        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {/* Spieler + Platz + Datum */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Player selector – Captain: Dropdown; Spieler: eigener Name als Label */}
            <div className="space-y-1.5">
              <Label>Spieler</Label>
              {isCaptain ? (
                <Controller
                  control={control}
                  name="playerId"
                  render={({ field }) => (
                    <select
                      {...field}
                      className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                    >
                      <option value="">Spieler wählen…</option>
                      {players.map((p) => (
                        <option key={p.id} value={String(p.id)}>{p.name}</option>
                      ))}
                    </select>
                  )}
                />
              ) : (
                <div className="flex h-9 items-center rounded-lg border bg-muted/40 px-3 text-sm font-medium">
                  {players.find((p) => p.keycloak_user_id === user?.id)?.name ?? '—'}
                </div>
              )}
              {errors.playerId && <p className="text-xs text-destructive">{errors.playerId.message}</p>}
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label>Datum</Label>
              <Controller
                control={control}
                name="date"
                render={({ field }) => (
                  <Input type="date" {...field} />
                )}
              />
              {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
            </div>

            {/* Course combobox — full width, triggers CR/Slope lookup */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Platz (Golfclub)</Label>
              <Controller
                control={control}
                name="courseName"
                render={({ field }) => (
                  <>
                    <Input
                      {...field}
                      list="panel-course-list"
                      placeholder="Golfclub eingeben…"
                      autoComplete="off"
                      onChange={(e) => {
                        field.onChange(e)
                        const val = e.target.value
                        const match = courseOptions.find(
                          (c) => c.name.toLowerCase() === val.toLowerCase(),
                        )
                        const newId = match ? match.id : null
                        setValue('courseId', newId)
                        lookupCourseStats(newId)
                      }}
                    />
                    <datalist id="panel-course-list">
                      {courseOptions.map((c) => <option key={c.id} value={c.name} />)}
                    </datalist>
                  </>
                )}
              />
            </div>
          </div>

          {/* CR / Slope — auto aus der DB (letzte bekannte Runde auf diesem Platz) */}
          <div className="rounded-2xl border bg-muted/40 px-5 py-4 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Platzdaten (automatisch geladen)</p>
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Course Rating</span>
                <span className={`font-semibold font-mono ${panelCr == null ? 'text-muted-foreground' : ''}`}>
                  {panelCr != null ? panelCr.toFixed(1) : '—'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Slope</span>
                <span className={`font-semibold font-mono ${panelSlope == null ? 'text-muted-foreground' : ''}`}>
                  {panelSlope ?? '—'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold font-mono">{totalScore || '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Differenzial</span>
                <span className="font-semibold font-mono">{liveDiff ?? '—'}</span>
              </div>
            </div>
            {watchedCourseId != null && panelCr == null && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                CR/Slope für diesen Platz fehlen noch. Bitte im System-Bereich unter „Golfplätze" ergänzen.
              </p>
            )}
          </div>

          {/* HCP-Relevanz */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setIsHcpRelevant((v) => !v)}
            onKeyDown={(e) => e.key === 'Enter' && setIsHcpRelevant((v) => !v)}
            className={`flex cursor-pointer items-center gap-4 rounded-2xl border px-5 py-4 transition-colors select-none
              ${isHcpRelevant ? 'border-primary/50 bg-primary/5' : 'bg-muted/30'}`}
          >
            {/* Toggle pill */}
            <div className={`relative h-6 w-11 rounded-full transition-colors ${isHcpRelevant ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isHcpRelevant ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">
                HCP-relevant&nbsp;
                <span className="font-normal text-muted-foreground">
                  {isHcpRelevant ? '— zählt für Handicap-Index' : '— nur internes Ranking'}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isHcpRelevant
                  ? 'Diese Runde wird für die WHS-Handicap-Berechnung verwendet.'
                  : 'Diese Runde beeinflusst nur das interne Leistungsranking, nicht den Handicap.'}
              </p>
            </div>
          </div>

          {/* Scorecard – 18 holes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Scorecard – 18 Löcher</Label>
              {selectedCourse && (
                <span className="text-xs text-muted-foreground">{selectedCourse.name}</span>
              )}
            </div>
            {errors.scores && (
              <p className="text-xs text-destructive">{errors.scores.message}</p>
            )}
            <div className="grid grid-cols-9 gap-2">
              {HOLES.map((hole, i) => {
                const par = selectedCourse?.hole_pars?.[i] ?? DEFAULT_PAR
                return (
                  <div key={hole} className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] font-semibold text-muted-foreground">#{hole}</span>
                    <Input
                      ref={(el) => { scoreInputRefs.current[i] = el }}
                      inputMode="numeric"
                      maxLength={2}
                      value={watchedScores[i] ?? ''}
                      onChange={(e) => handleScoreInput(i, e.target.value)}
                      className="text-center px-1 h-9 text-sm"
                    />
                    <span className="text-[10px] text-muted-foreground">P{par}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </form>
      </SideSheet>
    </div>
  )
}
