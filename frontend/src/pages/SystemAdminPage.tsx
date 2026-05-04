import { useEffect, useState } from 'react'
import { registerTeam, getTeams, getCourses, createCourse, updateCourse, deleteTeam } from '@/lib/api'
import type { Course, TeamSummary } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { SideSheet } from '@/components/ui/side-sheet'
import { toast } from 'sonner'
import { Plus, Pencil, MapPin, Trash2, TriangleAlert } from 'lucide-react'

const DEFAULT_PARS = Array(18).fill(4)
const HOLES = Array.from({ length: 18 }, (_, i) => i + 1)

export default function SystemAdminPage() {
  // ── Teams ────────────────────────────────────────────────────────────
  const [teams, setTeams] = useState<TeamSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(true)
  const [form, setForm] = useState({
    team_name: '',
    captain_name: '',
    captain_email: '',
    password: '',
  })

  // ── Team löschen ─────────────────────────────────────────────────────
  const [deletingTeam, setDeletingTeam] = useState<TeamSummary | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  const openDeleteDialog = (team: TeamSummary) => {
    setDeletingTeam(team)
    setDeleteConfirm('')
  }

  const closeDeleteDialog = () => {
    setDeletingTeam(null)
    setDeleteConfirm('')
  }

  const handleDeleteTeam = async () => {
    if (!deletingTeam || deleteConfirm !== deletingTeam.name) return
    setDeleting(true)
    try {
      await deleteTeam(deletingTeam.id)
      toast.success(`Mannschaft "${deletingTeam.name}" wurde gelöscht.`)
      closeDeleteDialog()
      loadData()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Löschen fehlgeschlagen.')
    } finally {
      setDeleting(false)
    }
  }

  // ── Courses ──────────────────────────────────────────────────────────
  const [courses, setCourses] = useState<Course[]>([])
  const [coursePanelOpen, setCoursePanelOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [savingCourse, setSavingCourse] = useState(false)
  const [courseDraft, setCourseDraft] = useState({
    name: '',
    course_rating: '',
    slope_rating: '',
    hole_pars: [...DEFAULT_PARS] as number[],
  })

  const loadData = () => {
    setRefreshing(true)
    Promise.all([getTeams(), getCourses()])
      .then(([t, c]) => { setTeams(t); setCourses(c) })
      .catch((e) => toast.error(e.message))
      .finally(() => setRefreshing(false))
  }

  useEffect(() => { loadData() }, [])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await registerTeam(form)
      toast.success('Mannschaft angelegt.')
      setForm({ team_name: '', captain_name: '', captain_email: '', password: '' })
      loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Registrierung fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  const openNewCourse = () => {
    setEditingCourse(null)
    setCourseDraft({ name: '', course_rating: '', slope_rating: '', hole_pars: [...DEFAULT_PARS] })
    setCoursePanelOpen(true)
  }

  const openEditCourse = (c: Course) => {
    setEditingCourse(c)
    setCourseDraft({
      name: c.name,
      course_rating: c.course_rating != null ? String(c.course_rating) : '',
      slope_rating: c.slope_rating != null ? String(c.slope_rating) : '',
      hole_pars: c.hole_pars?.length === 18 ? [...c.hole_pars] : [...DEFAULT_PARS],
    })
    setCoursePanelOpen(true)
  }

  const handleSaveCourse = async () => {
    if (!courseDraft.name.trim()) return toast.error('Bitte einen Namen eingeben.')
    const cr = courseDraft.course_rating ? parseFloat(courseDraft.course_rating) : null
    const sl = courseDraft.slope_rating ? parseInt(courseDraft.slope_rating) : null
    if (cr != null && isNaN(cr)) return toast.error('Course Rating ungültig.')
    if (sl != null && (isNaN(sl) || sl < 55 || sl > 155)) return toast.error('Slope muss zwischen 55 und 155 liegen.')
    setSavingCourse(true)
    try {
      const payload = { name: courseDraft.name.trim(), course_rating: cr, slope_rating: sl, hole_pars: courseDraft.hole_pars }
      if (editingCourse) {
        await updateCourse(editingCourse.id, payload)
        toast.success('Platz aktualisiert.')
      } else {
        await createCourse(payload)
        toast.success(`Platz "${courseDraft.name.trim()}" angelegt.`)
      }
      setCoursePanelOpen(false)
      loadData()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Fehler beim Speichern.')
    } finally {
      setSavingCourse(false)
    }
  }

  const setPar = (i: number, val: string) => {
    const v = Math.max(3, Math.min(6, parseInt(val) || 4))
    setCourseDraft((d) => {
      const pars = [...d.hole_pars]
      pars[i] = v
      return { ...d, hole_pars: pars }
    })
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

      {/* ── Golfplätze ──────────────────────────────────────── */}
      <div className="rounded-2xl border bg-background/70 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Golfplätze ({courses.length})</p>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={openNewCourse}>
            <Plus className="h-3.5 w-3.5" /> Neuer Platz
          </Button>
        </div>
        {courses.length > 0 ? (
          <div className="border-t divide-y">
            {courses.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.course_rating != null ? `CR ${c.course_rating.toFixed(1)}` : 'CR —'}
                    {' · '}
                    {c.slope_rating != null ? `Slope ${c.slope_rating}` : 'Slope —'}
                    {' · '}
                    {c.hole_pars ? `Par ${c.hole_pars.reduce((a, b) => a + b, 0)}` : 'Par —'}
                  </p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => openEditCourse(c)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-5 pb-4 text-xs text-muted-foreground">Noch keine Plätze angelegt.</p>
        )}
      </div>

      {/* ── Mandanten ───────────────────────────────────────── */}
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
                  <div key={team.id} className="rounded-2xl border bg-muted/30 overflow-hidden">
                    <div className="flex items-center justify-between p-3">
                      <div>
                        <p className="font-medium">{team.name}</p>
                        <p className="text-xs text-muted-foreground">ID: {team.id}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(team.created_at).toLocaleDateString('de-DE')}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => openDeleteDialog(team)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Inline-Bestätigungsdialog */}
                    {deletingTeam?.id === team.id && (
                      <div className="border-t bg-destructive/5 p-4 space-y-3">
                        <div className="flex items-start gap-2">
                          <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
                          <p className="text-sm text-destructive font-medium">
                            Diese Aktion löscht alle Spieler, Runden und Spieltage dieser Mannschaft unwiderruflich.
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Zur Bestätigung den Mannschaftsnamen eingeben:
                          <span className="ml-1 font-mono font-semibold text-foreground">{team.name}</span>
                        </p>
                        <Input
                          placeholder={team.name}
                          value={deleteConfirm}
                          onChange={(e) => setDeleteConfirm(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && deleteConfirm === team.name) handleDeleteTeam()
                            if (e.key === 'Escape') closeDeleteDialog()
                          }}
                        />
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm" onClick={closeDeleteDialog}>
                            Abbrechen
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={deleteConfirm !== team.name || deleting}
                            onClick={handleDeleteTeam}
                          >
                            {deleting ? 'Wird gelöscht…' : 'Endgültig löschen'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Course Side-Sheet ───────────────────────────────── */}
      <SideSheet
        open={coursePanelOpen}
        onClose={() => setCoursePanelOpen(false)}
        title={editingCourse ? 'Platz bearbeiten' : 'Neuen Platz anlegen'}
        desktopWidth="60%"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setCoursePanelOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSaveCourse} disabled={savingCourse || !courseDraft.name.trim()}>
              {savingCourse ? 'Speichern…' : editingCourse ? 'Änderungen speichern' : 'Platz anlegen'}
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="cName">Name des Golfplatzes</Label>
            <Input
              id="cName"
              placeholder="z. B. GC Mannheim-Viernheim"
              value={courseDraft.name}
              onChange={(e) => setCourseDraft((d) => ({ ...d, name: e.target.value }))}
              autoFocus
            />
          </div>

          {/* CR + Slope */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cCR">Course Rating</Label>
              <Input
                id="cCR"
                inputMode="decimal"
                placeholder="z. B. 72.3"
                value={courseDraft.course_rating}
                onChange={(e) => setCourseDraft((d) => ({ ...d, course_rating: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cSlope">Slope Rating</Label>
              <Input
                id="cSlope"
                inputMode="numeric"
                placeholder="55–155"
                value={courseDraft.slope_rating}
                onChange={(e) => setCourseDraft((d) => ({ ...d, slope_rating: e.target.value }))}
              />
            </div>
          </div>

          {/* Par pro Loch */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Par pro Loch</Label>
              <span className="text-xs text-muted-foreground">
                Gesamt Par: {courseDraft.hole_pars.reduce((a, b) => a + b, 0)}
              </span>
            </div>
            <div className="grid grid-cols-9 gap-2">
              {HOLES.map((hole, i) => (
                <div key={hole} className="flex flex-col items-center gap-0.5">
                  <span className="text-[10px] font-semibold text-muted-foreground">#{hole}</span>
                  <input
                    type="number"
                    min={3}
                    max={6}
                    value={courseDraft.hole_pars[i]}
                    onChange={(e) => setPar(i, e.target.value)}
                    className="h-9 w-full rounded-lg border bg-background px-1 text-center text-sm font-semibold tabular-nums"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </SideSheet>
    </div>
  )
}
