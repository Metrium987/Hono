"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, ShieldCheck, Clock } from "lucide-react";
import { toast } from "sonner";

export type MemberRow = {
  user_id: string;
  is_owner: boolean;
  created_at: string;
  role_id: string | null;
  role_name: string | null;
  name: string;
  email: string;
};

export type PendingRow = {
  id: string;
  email: string;
  created_at: string;
  expires_at: string;
  role_name: string | null;
};

export type RoleOption = { id: string; name: string };

export function UsersClient({
  initialMembers, initialPending, roles, teamId, currentUserId,
}: {
  initialMembers: MemberRow[];
  initialPending: PendingRow[];
  roles: RoleOption[];
  teamId: string;
  currentUserId: string;
}) {
  const [members, setMembers] = useState<MemberRow[]>(initialMembers);
  const [pending, setPending] = useState<PendingRow[]>(initialPending);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  async function changeRole(userId: string, roleId: string) {
    setSavingRole(userId);
    try {
      const res = await fetch(`/api/v1/team/members/${userId}?team_id=${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_id: roleId === "_none" ? null : roleId }),
      });
      if (res.ok) {
        const role = roles.find(r => r.id === roleId);
        setMembers(prev => prev.map(m =>
          m.user_id === userId
            ? { ...m, role_id: roleId === "_none" ? null : roleId, role_name: role?.name ?? null }
            : m
        ));
        toast.success("Rôle mis à jour");
      } else {
        toast.error("Erreur lors du changement de rôle");
      }
    } finally {
      setSavingRole(null);
    }
  }

  async function removeMember(userId: string, name: string) {
    if (!confirm(`Retirer ${name} de l'équipe ? Cette action est irréversible.`)) return;
    setRemovingId(userId);
    try {
      const res = await fetch(`/api/v1/team/members/${userId}?team_id=${teamId}`, { method: "DELETE" });
      if (res.ok) {
        setMembers(prev => prev.filter(m => m.user_id !== userId));
        toast.success("Membre retiré de l'équipe");
      } else {
        toast.error("Erreur lors de la suppression");
      }
    } finally {
      setRemovingId(null);
    }
  }

  async function cancelInvitation(id: string, email: string) {
    if (!confirm(`Annuler l'invitation envoyée à ${email} ?`)) return;
    setCancelingId(id);
    try {
      const res = await fetch(`/api/v1/invitations?team_id=${teamId}&invitation_id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setPending(prev => prev.filter(p => p.id !== id));
        toast.success("Invitation annulée");
      } else {
        toast.error("Erreur lors de l'annulation");
      }
    } finally {
      setCancelingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Active members */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Membres actifs — {members.length}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Depuis</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map(m => (
                <TableRow key={m.user_id} className={removingId === m.user_id ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{m.email}</TableCell>
                  <TableCell>
                    {m.is_owner ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : (
                      <Select
                        value={m.role_id ?? "_none"}
                        onValueChange={v => changeRole(m.user_id, v)}
                        disabled={savingRole === m.user_id || m.user_id === currentUserId}
                      >
                        <SelectTrigger className="h-7 text-xs w-36">
                          <SelectValue placeholder="Aucun rôle" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Aucun rôle</SelectItem>
                          {roles.map(r => (
                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    {m.is_owner
                      ? <Badge>Propriétaire</Badge>
                      : <Badge variant="secondary">Membre</Badge>
                    }
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(m.created_at).toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell>
                    {!m.is_owner && m.user_id !== currentUserId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => removeMember(m.user_id, m.name)}
                        disabled={removingId === m.user_id}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pending invitations */}
      {pending.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <Clock className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-base">Invitations en attente — {pending.length}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Envoyée le</TableHead>
                  <TableHead>Expire le</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map(inv => (
                  <TableRow key={inv.id} className={cancelingId === inv.id ? "opacity-50" : ""}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{inv.role_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(inv.created_at).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(inv.expires_at).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => cancelInvitation(inv.id, inv.email)}
                        disabled={cancelingId === inv.id}
                      >
                        Annuler
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
