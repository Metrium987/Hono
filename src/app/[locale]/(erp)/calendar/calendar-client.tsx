"use client";

import "@schedule-x/theme-default/dist/index.css";

import { useState, useEffect, useCallback, useRef } from "react";
import { useCalendarApp, ScheduleXCalendar } from "@schedule-x/react";
import { createViewMonthGrid, createViewWeek, createViewDay } from "@schedule-x/calendar";
import type { CalendarEventExternal } from "@schedule-x/calendar";
import { createDragAndDropPlugin } from "@schedule-x/drag-and-drop";
import { createResizePlugin } from "@schedule-x/resize";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";

export type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  event_type: "meeting" | "call" | "task" | "reminder" | "other";
  is_all_day: boolean;
  customer_id: string | null;
  group_id: string | null;
  location: string | null;
  created_by: string;
  customer?: { contact_name: string; company_name: string | null } | null;
  group?: { name: string; color: string } | null;
};

export type StaffGroup = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  member_count: number;
};

export type CustomerOption = {
  id: string;
  contact_name: string;
  company_name: string | null;
};

// ---- date helpers ----

function toSXDate(isoString: string, isAllDay: boolean): string {
  const d = new Date(isoString);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  if (isAllDay) return `${yyyy}-${mm}-${dd}`;
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function sxDateToISO(sxDate: string): string {
  const s = String(sxDate);
  if (s.length === 10) return new Date(`${s}T00:00:00`).toISOString();
  return new Date(s.replace(" ", "T") + ":00").toISOString();
}

function toDateInput(d: Date) { return d.toISOString().slice(0, 10); }
function toTimeInput(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// schedule-x CalendarEventExternal accepts strings at runtime, despite its type definition
function toSxEvents(events: CalendarEvent[], filterGroups: string[]): any[] {
  return events
    .filter(e => {
      if (filterGroups.length === 0) return true;
      if (!e.group_id) return true;
      return filterGroups.includes(e.group_id);
    })
    .map(e => ({
      id: e.id,
      title: e.title,
      start: toSXDate(e.starts_at, e.is_all_day),
      end: toSXDate(e.ends_at, e.is_all_day),
      calendarId: e.event_type,
    }));
}

const SX_CALENDARS = {
  meeting:  { colorName: "meeting",  lightColors: { main: "#6366f1", container: "#eef2ff", onContainer: "#3730a3" }, darkColors: { main: "#818cf8", container: "#312e81", onContainer: "#c7d2fe" } },
  call:     { colorName: "call",     lightColors: { main: "#10b981", container: "#d1fae5", onContainer: "#064e3b" }, darkColors: { main: "#34d399", container: "#064e3b", onContainer: "#a7f3d0" } },
  task:     { colorName: "task",     lightColors: { main: "#f59e0b", container: "#fef3c7", onContainer: "#78350f" }, darkColors: { main: "#fbbf24", container: "#451a03", onContainer: "#fde68a" } },
  reminder: { colorName: "reminder", lightColors: { main: "#ef4444", container: "#fee2e2", onContainer: "#7f1d1d" }, darkColors: { main: "#f87171", container: "#7f1d1d", onContainer: "#fecaca" } },
  other:    { colorName: "other",    lightColors: { main: "#64748b", container: "#f1f5f9", onContainer: "#1e293b" }, darkColors: { main: "#94a3b8", container: "#1e293b", onContainer: "#cbd5e1" } },
};

const EVENT_LABELS: Record<string, string> = {
  meeting: "Réunion", call: "Appel", task: "Tâche", reminder: "Rappel", other: "Autre",
};

const BLANK = {
  title: "", description: "", event_type: "meeting",
  starts_date: "", starts_time: "09:00",
  ends_date: "", ends_time: "10:00",
  is_all_day: false, customer_id: "", group_id: "", location: "",
};

// ---- Component ----

export function CalendarClient({
  initialEvents, groups, customers, teamId, prefilledCustomerId,
}: {
  initialEvents: CalendarEvent[];
  groups: StaffGroup[];
  customers: CustomerOption[];
  teamId: string;
  prefilledCustomerId?: string;
}) {
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [filterGroups, setFilterGroups] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState({
    ...BLANK,
    starts_date: toDateInput(new Date()),
    ends_date: toDateInput(new Date()),
    customer_id: prefilledCustomerId ?? "",
  });
  const [saving, setSaving] = useState(false);

  // Mutable refs for stable callback closures
  const eventsRef = useRef<CalendarEvent[]>(initialEvents);
  const filterGroupsRef = useRef<string[]>([]);
  const calendarAppRef = useRef<ReturnType<typeof useCalendarApp>>(null);

  // Update refs in effects to avoid violating react-hooks/refs
  useEffect(() => { eventsRef.current = events; }, [events]);
  useEffect(() => { filterGroupsRef.current = filterGroups; }, [filterGroups]);

  const openEdit = useCallback((e: CalendarEvent) => {
    const s = new Date(e.starts_at);
    const en = new Date(e.ends_at);
    setEditEvent(e);
    setForm({
      title: e.title, description: e.description ?? "",
      event_type: e.event_type, is_all_day: e.is_all_day,
      starts_date: toDateInput(s), starts_time: toTimeInput(s),
      ends_date: toDateInput(en), ends_time: toTimeInput(en),
      customer_id: e.customer_id ?? "", group_id: e.group_id ?? "", location: e.location ?? "",
    });
    setDialogOpen(true);
  }, []);

  const openNew = useCallback((date?: Date) => {
    const d = date ?? new Date();
    setEditEvent(null);
    setForm(prev => ({
      ...BLANK,
      starts_date: toDateInput(d),
      ends_date: toDateInput(d),
      customer_id: prefilledCustomerId ?? prev.customer_id ?? "",
    }));
    setDialogOpen(true);
  }, [prefilledCustomerId]);

  const openEditRef = useRef(openEdit);
  const openNewRef = useRef(openNew);
  useEffect(() => { openEditRef.current = openEdit; }, [openEdit]);
  useEffect(() => { openNewRef.current = openNew; }, [openNew]);

  const calendarApp = useCalendarApp({
    locale: "fr-FR",
    defaultView: "month-grid",
    views: [createViewMonthGrid(), createViewWeek(), createViewDay()],
    events: [],
    plugins: [createDragAndDropPlugin(), createResizePlugin()],
    calendars: SX_CALENDARS,
    callbacks: {
      onEventClick(sxEvent) {
        const ev = eventsRef.current.find(e => e.id === String(sxEvent.id));
        if (ev) openEditRef.current(ev);
      },
      onClickDate(date) {
        openNewRef.current(new Date(date.toString() + "T00:00:00"));
      },
      onRangeUpdate(range) {
        const startISO = new Date(String(range.start)).toISOString();
        const endDate = new Date(String(range.end));
        endDate.setDate(endDate.getDate() + 1);
        const endISO = endDate.toISOString();
        fetch(`/api/v1/calendar-events?team_id=${teamId}&starts_at=${startISO}&ends_at=${endISO}`)
          .then(r => r.ok ? r.json() : null)
          .then(json => {
            if (!json) return;
            const newEvents: CalendarEvent[] = json.data ?? [];
            setEvents(newEvents);
            calendarAppRef.current?.events.set(toSxEvents(newEvents, filterGroupsRef.current));
          });
      },
      async onEventUpdate(sxEvent) {
        const id = String(sxEvent.id);
        const starts_at = sxDateToISO(String(sxEvent.start));
        const ends_at = sxDateToISO(String(sxEvent.end));
        const res = await fetch(`/api/v1/calendar-events/${id}?team_id=${teamId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ starts_at, ends_at }),
        });
        if (res.ok) {
          setEvents(prev => prev.map(e => e.id === id ? { ...e, starts_at, ends_at } : e));
          toast.success("Événement mis à jour");
        } else {
          toast.error("Erreur lors de la sauvegarde");
        }
      },
    },
  });

  useEffect(() => { calendarAppRef.current = calendarApp; }, [calendarApp]);

  useEffect(() => {
    if (!calendarApp) return;
    calendarApp.setTheme("dark");
    calendarApp.events.set(toSxEvents(initialEvents, []));
  }, [calendarApp]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- CRUD ----

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description || null,
        starts_at: form.is_all_day ? `${form.starts_date}T00:00:00` : `${form.starts_date}T${form.starts_time}:00`,
        ends_at: form.is_all_day ? `${form.ends_date}T23:59:59` : `${form.ends_date}T${form.ends_time}:00`,
        event_type: form.event_type,
        is_all_day: form.is_all_day,
        customer_id: form.customer_id || null,
        group_id: form.group_id || null,
        location: form.location || null,
      };

      if (editEvent) {
        const res = await fetch(`/api/v1/calendar-events/${editEvent.id}?team_id=${teamId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        if (res.ok) {
          const { data } = await res.json();
          setEvents(prev => prev.map(e => e.id === editEvent.id ? data : e));
          calendarApp?.events.update({
            id: data.id, title: data.title,
            start: toSXDate(data.starts_at, data.is_all_day),
            end: toSXDate(data.ends_at, data.is_all_day),
            calendarId: data.event_type,
          } as unknown as CalendarEventExternal);
          toast.success("Événement modifié");
          setDialogOpen(false);
        } else {
          toast.error("Erreur lors de la modification");
        }
      } else {
        const res = await fetch(`/api/v1/calendar-events?team_id=${teamId}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        if (res.ok) {
          const { data } = await res.json();
          setEvents(prev => [...prev, data]);
          if (!filterGroups.length || !data.group_id || filterGroups.includes(data.group_id)) {
            calendarApp?.events.add({
              id: data.id, title: data.title,
              start: toSXDate(data.starts_at, data.is_all_day),
              end: toSXDate(data.ends_at, data.is_all_day),
              calendarId: data.event_type,
            } as unknown as CalendarEventExternal);
          }
          toast.success("Événement créé");
          setDialogOpen(false);
        } else {
          toast.error("Erreur lors de la création");
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    const res = await fetch(`/api/v1/calendar-events/${id}?team_id=${teamId}`, { method: "DELETE" });
    if (res.ok) {
      setEvents(prev => prev.filter(e => e.id !== id));
      calendarApp?.events.remove(id);
      toast.success("Événement supprimé");
      setDialogOpen(false);
    } else {
      toast.error("Erreur lors de la suppression");
    }
  }

  function toggleGroup(groupId: string) {
    const next = filterGroups.includes(groupId)
      ? filterGroups.filter(x => x !== groupId)
      : [...filterGroups, groupId];
    setFilterGroups(next);
    calendarApp?.events.set(toSxEvents(events, next));
  }

  function clearFilter() {
    setFilterGroups([]);
    calendarApp?.events.set(toSxEvents(events, []));
  }

  // ---- render ----

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {groups.length > 0 ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Groupes :</span>
            <Badge variant={filterGroups.length === 0 ? "default" : "outline"} className="cursor-pointer select-none" onClick={clearFilter}>Tous</Badge>
            {groups.map(g => (
              <Badge
                key={g.id}
                variant="outline"
                className="cursor-pointer select-none transition-colors"
                style={filterGroups.includes(g.id)
                  ? { backgroundColor: g.color, borderColor: g.color, color: "#fff" }
                  : { borderColor: g.color, color: g.color }}
                onClick={() => toggleGroup(g.id)}
              >
                {g.name}
              </Badge>
            ))}
          </div>
        ) : <div />}

        <Button size="sm" onClick={() => openNew()}>
          <Plus className="h-4 w-4 mr-1" />Nouvel événement
        </Button>
      </div>

      <div className="rounded-lg overflow-hidden border" style={{ height: "calc(100vh - 14rem)" }}>
        <ScheduleXCalendar calendarApp={calendarApp} />
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editEvent ? "Modifier l'événement" : "Nouvel événement"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label>Titre *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Titre de l'événement" autoFocus />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={form.event_type} onValueChange={v => setForm(f => ({ ...f, event_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVENT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-0.5">
                <Switch id="allday" checked={form.is_all_day} onCheckedChange={v => setForm(f => ({ ...f, is_all_day: v }))} />
                <Label htmlFor="allday" className="cursor-pointer">Journée entière</Label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Début</Label>
                <Input type="date" value={form.starts_date} onChange={e => setForm(f => ({ ...f, starts_date: e.target.value }))} />
              </div>
              {!form.is_all_day && (
                <div className="space-y-1">
                  <Label>Heure</Label>
                  <Input type="time" value={form.starts_time} onChange={e => setForm(f => ({ ...f, starts_time: e.target.value }))} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Fin</Label>
                <Input type="date" value={form.ends_date} onChange={e => setForm(f => ({ ...f, ends_date: e.target.value }))} />
              </div>
              {!form.is_all_day && (
                <div className="space-y-1">
                  <Label>Heure</Label>
                  <Input type="time" value={form.ends_time} onChange={e => setForm(f => ({ ...f, ends_time: e.target.value }))} />
                </div>
              )}
            </div>

            {customers.length > 0 && (
              <div className="space-y-1">
                <Label>Client (optionnel)</Label>
                <Select value={form.customer_id || "_none"} onValueChange={v => setForm(f => ({ ...f, customer_id: v === "_none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Aucun client" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Aucun client</SelectItem>
                    {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name ?? c.contact_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {groups.length > 0 && (
              <div className="space-y-1">
                <Label>Groupe (optionnel)</Label>
                <Select value={form.group_id || "_none"} onValueChange={v => setForm(f => ({ ...f, group_id: v === "_none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Visible par tous" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Visible par tous</SelectItem>
                    {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label>Lieu (optionnel)</Label>
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Bureau, Zoom, Téléphone..." />
            </div>

            <div className="space-y-1">
              <Label>Description (optionnelle)</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Notes, ordre du jour..." rows={2} />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            {editEvent
              ? <Button variant="destructive" size="sm" onClick={() => del(editEvent.id)}><Trash2 className="h-3.5 w-3.5 mr-1" />Supprimer</Button>
              : <div />
            }
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button size="sm" onClick={save} disabled={saving || !form.title.trim()}>
                {saving ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
