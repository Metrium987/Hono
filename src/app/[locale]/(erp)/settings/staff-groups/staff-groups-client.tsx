"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type StaffGroupRow = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  member_count: number;
};

export type MemberRow = {
  id: string;
  name: string;
  email: string | null;
};

type GroupMembers = Record<string, string[]>;

const COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#8b5cf6", "#14b8a6"];
const BLANK = { name: "", description: "", color: "#6366f1" };

export function StaffGroupsClient({
  initialGroups, members, groupMembers: initGroupMembers, teamId,
}: {
  initialGroups: StaffGroupRow[];
  members: MemberRow[];
  groupMembers: GroupMembers;
  teamId: string;
}) {
  const [groups, setGroups] = useState<StaffGroupRow[]>(initialGroups);
  const [groupMembers, setGroupMembers] = useState<GroupMembers>(initGroupMembers);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<StaffGroupRow | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);

  function openNew() {
    setEditGroup(null);
    setForm(BLANK);
    setSelectedMembers([]);
    setDialogOpen(true);
  }

  function openEdit(g: StaffGroupRow) {
    setEditGroup(g);
    setForm({ name: g.name, description: g.description ?? "", color: g.color });
    setSelectedMembers(groupMembers[g.id] ?? []);
    setDialogOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), description: form.description || null, color: form.color, member_ids: selectedMembers };

      if (editGroup) {
        const res = await fetch(`/api/v1/staff-groups/${editGroup.id}?team_id=${teamId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        if (res.ok) {
          const { data } = await res.json();
          setGroups(prev => prev.map(g => g.id === editGroup.id
            ? { ...data, member_count: selectedMembers.length }
            : g
          ));
          setGroupMembers(prev => ({ ...prev, [editGroup.id]: selectedMembers }));
          setDialogOpen(false);
          toast.success("Groupe mis à jour");
        } else {
          toast.error("Erreur lors de la mise à jour");
        }
      } else {
        const res = await fetch(`/api/v1/staff-groups?team_id=${teamId}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        if (res.ok) {
          const { data } = await res.json();
          const newGroup: StaffGroupRow = { ...data, member_count: selectedMembers.length };
          setGroups(prev => [...prev, newGroup]);
          setGroupMembers(prev => ({ ...prev, [data.id]: selectedMembers }));
          setDialogOpen(false);
          toast.success("Groupe créé");
        } else {
          toast.error("Erreur lors de la création");
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    const res = await fetch(`/api/v1/staff-groups/${id}?team_id=${teamId}`, { method: "DELETE" });
    if (res.ok) {
      setGroups(prev => prev.filter(g => g.id !== id));
      setGroupMembers(prev => { const n = { ...prev }; delete n[id]; return n; });
      setDialogOpen(false);
      toast.success("Groupe supprimé");
    } else {
      toast.error("Erreur lors de la suppression");
    }
  }

  function toggleMember(uid: string) {
    setSelectedMembers(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{groups.length} groupe{groups.length !== 1 ? "s" : ""}</p>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Nouveau groupe</Button>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Aucun groupe. Créez-en un pour organiser votre agenda par équipe.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map(g => {
            const memberIds = groupMembers[g.id] ?? [];
            const memberNames = memberIds.map(id => members.find(m => m.id === id)?.name ?? id);
            return (
              <Card key={g.id} className="relative">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: g.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{g.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />{g.member_count} membre{g.member_count !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    {g.description && <p className="text-xs text-muted-foreground mt-0.5">{g.description}</p>}
                    {memberNames.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">{memberNames.join(", ")}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => openEdit(g)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editGroup ? "Modifier le groupe" : "Nouveau groupe"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1">
              <Label>Nom *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nom du groupe" autoFocus />
            </div>

            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description optionnelle" rows={2} />
            </div>

            <div className="space-y-1">
              <Label>Couleur</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={cn("w-7 h-7 rounded-full transition-all", form.color === c ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-105")}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                  />
                ))}
              </div>
            </div>

            {members.length > 0 && (
              <div className="space-y-2">
                <Label>Membres</Label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {members.map(m => (
                    <label key={m.id} className="flex items-center gap-2.5 cursor-pointer p-1.5 rounded hover:bg-accent text-sm">
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(m.id)}
                        onChange={() => toggleMember(m.id)}
                        className="rounded"
                      />
                      <span>{m.name}</span>
                      {m.email && <span className="text-muted-foreground text-xs">{m.email}</span>}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            {editGroup
              ? <Button variant="destructive" size="sm" onClick={() => del(editGroup.id)}><Trash2 className="h-3.5 w-3.5 mr-1" />Supprimer</Button>
              : <div />
            }
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button size="sm" onClick={save} disabled={saving || !form.name.trim()}>
                {saving ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
