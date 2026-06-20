import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InviteForm } from "./invite-form";

export default async function UsersPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div>Non connecté</div>;

  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id, is_owner")
    .eq("user_id", user.id)
    .limit(1);

  const teamId = memberships?.[0]?.team_id;
  const isOwner = memberships?.[0]?.is_owner ?? false;

  if (!teamId) notFound();
  if (!isOwner) return <div className="text-center py-12 text-muted-foreground">Accès réservé au propriétaire du compte.</div>;

  const [membersRes, pendingRes, rolesRes] = await Promise.all([
    supabase
      .from("team_members")
      .select("user_id, is_owner, created_at, role:role_id(name), user:user_id(email, full_name)")
      .eq("team_id", teamId)
      .order("created_at"),
    supabase
      .from("company_invitations")
      .select("id, email, created_at, expires_at, role:role_id(name)")
      .eq("team_id", teamId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
    supabase
      .from("team_roles")
      .select("id, name")
      .eq("team_id", teamId)
      .order("name"),
  ]);

  type MemberRow = {
    user_id: string;
    is_owner: boolean;
    created_at: string;
    role: { name: string } | Array<{ name: string }> | null;
    user: { email: string; full_name: string | null } | Array<{ email: string; full_name: string | null }> | null;
  };

  type PendingRow = {
    id: string;
    email: string;
    created_at: string;
    expires_at: string;
    role: { name: string } | Array<{ name: string }> | null;
  };

  const members: MemberRow[] = (membersRes.data ?? []) as MemberRow[];
  const pending: PendingRow[] = (pendingRes.data ?? []) as PendingRow[];
  const roles: { id: string; name: string }[] = rolesRes.data ?? [];

  function getName(m: MemberRow): string {
    const u = Array.isArray(m.user) ? m.user[0] : m.user;
    return u?.full_name ?? u?.email ?? m.user_id;
  }

  function getEmail(m: MemberRow): string {
    const u = Array.isArray(m.user) ? m.user[0] : m.user;
    return u?.email ?? "—";
  }

  function getRoleName(role: { name: string } | Array<{ name: string }> | null): string {
    if (!role) return "—";
    return Array.isArray(role) ? role[0]?.name ?? "—" : role.name;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Utilisateurs</h1>
          <p className="text-sm text-muted-foreground">Gérez les membres de votre équipe et leurs rôles.</p>
        </div>
        <InviteForm teamId={teamId} roles={roles} />
      </div>

      {/* Active members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Membres actifs</CardTitle>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.user_id}>
                  <TableCell className="font-medium">{getName(m)}</TableCell>
                  <TableCell className="text-muted-foreground">{getEmail(m)}</TableCell>
                  <TableCell>{m.is_owner ? "—" : getRoleName(m.role)}</TableCell>
                  <TableCell>
                    {m.is_owner ? (
                      <Badge variant="default">Propriétaire</Badge>
                    ) : (
                      <Badge variant="secondary">Membre</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(m.created_at).toLocaleDateString("fr-FR")}
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
          <CardHeader>
            <CardTitle className="text-base">Invitations en attente</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Envoyée le</TableHead>
                  <TableHead>Expire le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell>{getRoleName(inv.role)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(inv.created_at).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(inv.expires_at).toLocaleDateString("fr-FR")}
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
