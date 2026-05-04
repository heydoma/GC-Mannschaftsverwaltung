import { useCallback, useEffect, useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AnimatePresence, motion } from 'framer-motion'
import { getLeaderboard, getMatchdays, createMatchday, updateMatchday, togglePublishMatchday, deleteMatchday } from '@/lib/api'
import type { LeaderboardEntry, Matchday } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { GripVertical, X, Plus, Globe, Lock, Trash2, Save, ChevronDown } from 'lucide-react'
import { useAuth } from '@/lib/auth'

const DEFAULT_STARTER = 4
const DEFAULT_RESERVE = 2

type Slot = { id: string; playerId: number | null }

function buildSlots(count: number, prefix: string): Slot[] {
  return Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i}`, playerId: null }))
}

function slotsFromIds(ids: number[], count: number, prefix: string): Slot[] {
  const slots = buildSlots(count, prefix)
  ids.slice(0, count).forEach((pid, i) => { slots[i].playerId = pid })
  return slots
}

function SortableSlot({
  slot,
  index,
  players,
  onOpen,
  onClear,
}: {
  slot: Slot
  index: number
  players: LeaderboardEntry[]
  onOpen: (slotId: string) => void
  onClear: (slotId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slot.id })
  const player = slot.playerId != null ? players.find((p) => p.id === slot.playerId) : undefined

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-shadow ${isDragging ? 'shadow-lg opacity-80 z-10' : ''}`}
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none">
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="w-6 text-sm font-semibold text-muted-foreground">{index + 1}.</span>
      {player ? (
        <div className="flex flex-1 items-center justify-between gap-2">
          <div>
            <p className="font-medium text-sm">{player.name}</p>
            <p className="text-xs text-muted-foreground">{player.form_icon} Rating: {player.weighted_rating?.toFixed(1) ?? '—'}</p>
          </div>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={() => onOpen(slot.id)} title="Spieler tauschen">
              <Plus className="h-4 w-4 rotate-45" />
            </Button>
            <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onClear(slot.id)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <button className="flex-1 text-left text-sm text-muted-foreground hover:text-foreground transition-colors" onClick={() => onOpen(slot.id)}>
          — Spieler wählen —
        </button>
      )}
    </div>
  )
}


export default function LineupPage() {
  const { activeTeamId, isCaptain } = useAuth()

  const [players, setPlayers] = useState<LeaderboardEntry[]>([])
  const [matchdays, setMatchdays] = useState<Matchday[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [starters, setStarters] = useState<Slot[]>(() => buildSlots(DEFAULT_STARTER, 'starter'))
  const [reserves, setReserves] = useState<Slot[]>(() => buildSlots(DEFAULT_RESERVE, 'reserve'))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeSlot, setActiveSlot] = useState<{ listType: 'starters' | 'reserves'; slotId: string } | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const selected = matchdays.find((m) => m.id === selectedId) ?? null

  const loadAll = useCallback(() => {
    setSelectedId(null)
    getLeaderboard().then(setPlayers).catch((e) => toast.error(e.message))
    getMatchdays().then(setMatchdays).catch((e) => toast.error(e.message))
  }, [activeTeamId])

  useEffect(() => { loadAll() }, [loadAll])

  // Wenn Spieltag gewechselt wird → Slots aus DB-Daten befüllen
  useEffect(() => {
    if (!selected) return
    setStarters(slotsFromIds(selected.starters, DEFAULT_STARTER, 'starter'))
    setReserves(slotsFromIds(selected.reserves, DEFAULT_RESERVE, 'reserve'))
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  const openDrawer = (listType: 'starters' | 'reserves', slotId: string) => {
    setActiveSlot({ listType, slotId })
    setDrawerOpen(true)
  }

  const assignPlayer = (pid: number) => {
    if (!activeSlot) return
    const update = (list: Slot[]) => list.map((sl) => sl.id === activeSlot.slotId ? { ...sl, playerId: pid } : sl)
    if (activeSlot.listType === 'starters') setStarters(update(starters))
    else setReserves(update(reserves))
    setDrawerOpen(false)
  }

  const clearSlot = (listType: 'starters' | 'reserves', slotId: string) => {
    const update = (list: Slot[]) => list.map((sl) => sl.id === slotId ? { ...sl, playerId: null } : sl)
    if (listType === 'starters') setStarters(update(starters))
    else setReserves(update(reserves))
  }

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setStarters((prev) => {
      const oldIdx = prev.findIndex((s) => s.id === active.id)
      const newIdx = prev.findIndex((s) => s.id === over.id)
      if (oldIdx < 0 || newIdx < 0) return prev
      return arrayMove(prev, oldIdx, newIdx)
    })
  }

  const handleCreate = async () => {
    const label = newLabel.trim()
    if (!label) return toast.error('Bitte einen Namen eingeben.')
    setCreating(true)
    try {
      const m = await createMatchday({ label })
      setMatchdays((prev) => [m, ...prev])
      setSelectedId(m.id)
      setNewLabel('')
      toast.success(`"${m.label}" angelegt.`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setCreating(false)
    }
  }

  const handleSave = async () => {
    if (!selectedId) return
    setSaving(true)
    try {
      const updated = await updateMatchday(selectedId, {
        starters: starters.map((s) => s.playerId).filter((id): id is number => id !== null),
        reserves: reserves.map((r) => r.playerId).filter((id): id is number => id !== null),
      })
      setMatchdays((prev) => prev.map((m) => m.id === updated.id ? updated : m))
      toast.success('Aufstellung gespeichert.')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!selectedId) return
    try {
      const updated = await togglePublishMatchday(selectedId)
      setMatchdays((prev) => prev.map((m) => m.id === updated.id ? updated : m))
      toast.success(updated.published ? 'Spieltag veröffentlicht ✅' : 'Spieltag zurückgezogen.')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    }
  }

  const handleDelete = async () => {
    if (!selectedId) return
    if (!confirm('Spieltag wirklich löschen?')) return
    try {
      await deleteMatchday(selectedId)
      setMatchdays((prev) => prev.filter((m) => m.id !== selectedId))
      setSelectedId(null)
      setStarters(buildSlots(DEFAULT_STARTER, 'starter'))
      setReserves(buildSlots(DEFAULT_RESERVE, 'reserve'))
      toast.success('Spieltag gelöscht.')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    }
  }

  // ── Spieler-Ansicht (nur veröffentlichte Spieltage) ─────────────────
  if (!isCaptain) {
    const published = matchdays.filter((m) => m.published)
    return (
      <div className="p-5 sm:p-8 space-y-6">
        <div className="space-y-1">
          <p className="page-kicker">Aufstellung</p>
          <h2 className="page-title text-2xl font-semibold sm:text-3xl">Spieltage</h2>
          <p className="text-sm text-muted-foreground">Veröffentlichte Aufstellungen deines Teams.</p>
        </div>
        {published.length === 0 ? (
          <p className="text-muted-foreground text-sm">Noch keine Aufstellung veröffentlicht.</p>
        ) : published.map((m) => (
          <div key={m.id} className="rounded-2xl border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base">{m.label}</h3>
              {m.match_date && <span className="text-xs text-muted-foreground">{m.match_date}</span>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Starter</p>
                <ol className="space-y-1">
                  {m.starters.map((pid, i) => {
                    const p = players.find((pl) => pl.id === pid)
                    return <li key={pid} className="flex items-center gap-2 text-sm">
                      <span className="w-5 text-muted-foreground font-mono">{i + 1}.</span>
                      <span className="font-medium">{p?.name ?? `#${pid}`}</span>
                      <span className="text-muted-foreground">{p?.form_icon}</span>
                    </li>
                  })}
                  {m.starters.length === 0 && <li className="text-sm text-muted-foreground">—</li>}
                </ol>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Reserve</p>
                <ol className="space-y-1">
                  {m.reserves.map((pid, i) => {
                    const p = players.find((pl) => pl.id === pid)
                    return <li key={pid} className="flex items-center gap-2 text-sm">
                      <span className="w-5 text-muted-foreground font-mono">R{i + 1}.</span>
                      <span className="font-medium">{p?.name ?? `#${pid}`}</span>
                    </li>
                  })}
                  {m.reserves.length === 0 && <li className="text-sm text-muted-foreground">—</li>}
                </ol>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="p-5 sm:p-6 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <p className="page-kicker">Captain Workspace</p>
        <h2 className="page-title text-2xl font-semibold sm:text-3xl">Aufstellung</h2>
        <p className="text-sm text-muted-foreground">Spieltag wählen, Aufstellung planen und veröffentlichen.</p>
      </div>

      {/* Spieltag-Auswahl + neuen anlegen */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="relative flex-1 min-w-[180px]">
          <select
            value={selectedId ?? ''}
            onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}
            className="h-9 w-full appearance-none rounded-lg border bg-background pl-3 pr-8 text-sm"
          >
            <option value="">— Spieltag wählen —</option>
            {matchdays.map((m) => (
              <option key={m.id} value={m.id}>
                {m.published ? '✅ ' : '🔒 '}{m.label}{m.match_date ? ` · ${m.match_date}` : ''}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
        </div>
        <Input
          placeholder="Neuer Spieltag…"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          className="h-9 w-44 text-sm"
        />
        <Button size="sm" onClick={handleCreate} disabled={creating || !newLabel.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Anlegen
        </Button>
      </div>

      {/* Aktions-Leiste wenn Spieltag gewählt */}
      {selected && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />{saving ? 'Speichern…' : 'Speichern'}
          </Button>
          <Button size="sm" variant={selected.published ? 'outline' : 'default'} onClick={handlePublish}>
            {selected.published
              ? <><Lock className="h-4 w-4 mr-1" /> Zurückziehen</>
              : <><Globe className="h-4 w-4 mr-1" /> Veröffentlichen</>}
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive ml-auto" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-1" /> Löschen
          </Button>
        </div>
      )}

      {!selected ? (
        <div className="rounded-2xl border border-dashed bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
          Spieltag wählen oder neuen anlegen, um die Aufstellung zu bearbeiten.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-[1fr_1fr]">
          {/* Starter Slots with DnD */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Starter</p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={starters.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {starters.map((slot, i) => (
                    <SortableSlot
                      key={slot.id}
                      slot={slot}
                      index={i}
                      players={players}
                      onOpen={(id) => openDrawer('starters', id)}
                      onClear={(id) => clearSlot('starters', id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* Reserve Slots */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Reserve</p>
            <div className="space-y-2">
              {reserves.map((slot, i) => (
                <div key={slot.id} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
                  <span className="w-6 text-sm font-semibold text-muted-foreground">R{i + 1}.</span>
                  {slot.playerId != null ? (() => {
                    const p = players.find((pl) => pl.id === slot.playerId)
                    return p ? (
                      <div className="flex flex-1 items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.form_icon} {p.weighted_rating?.toFixed(1) ?? '—'}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openDrawer('reserves', slot.id)}><Plus className="h-4 w-4 rotate-45" /></Button>
                          <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => clearSlot('reserves', slot.id)}><X className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    ) : null
                  })() : (
                    <button className="flex-1 text-left text-sm text-muted-foreground hover:text-foreground" onClick={() => openDrawer('reserves', slot.id)}>
                      — Reservespieler wählen —
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Ranking preview */}
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ranking (ML-Score)</p>
              {players.slice(0, 5).map((p, i) => (
                <div key={p.id} className="flex items-center gap-2 rounded-lg border bg-card/60 px-3 py-2 text-sm">
                  <span className="w-5 font-semibold text-muted-foreground">{i + 1}.</span>
                  <span className="flex-1 font-medium">{p.name}</span>
                  <span>{p.form_icon}</span>
                  <span className="text-muted-foreground">{p.weighted_rating?.toFixed(1) ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Drawer – Player Selection */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              key="drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              key="drawer"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-3xl border-t bg-background shadow-2xl"
              style={{ maxHeight: '75vh' }}
            >
              <div className="flex justify-center pt-3 pb-2">
                <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
              </div>
              <div className="flex items-center justify-between px-6 pb-3">
                <h3 className="font-semibold text-lg">Spieler wählen</h3>
                <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(false)}><X className="h-4 w-4" /></Button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-1.5">
                {players.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => assignPlayer(p.id)}
                    className="flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/60 active:scale-[0.98]"
                  >
                    <span className="w-6 text-sm font-semibold text-muted-foreground">{i + 1}.</span>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.form_icon} Momentum: {p.momentum?.toFixed(1) ?? '—'} · Rating: {p.weighted_rating?.toFixed(1) ?? '—'}
                      </p>
                    </div>
                    <span className="text-lg">{p.form_icon}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
