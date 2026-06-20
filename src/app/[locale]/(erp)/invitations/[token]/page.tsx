import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { Building2, ShieldCheck, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AcceptButton } from "./accept-button";

type Params = Promise<{ token: string }>;

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export default async function InvitationPage(props: { params: Params }) {
  const { token } = await props.params;

  const admin = createAdminClient();

  const { data: invitation } = await admin
    .from("company_invitations")
    .select(`
      id, email, is_owner, expires_at, accepted_at,
      team:team_id(id, name),
      role:role_id(id, name)
    `)
    .eq("token", token)
    .single();

  if (!invitation) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <XCircle className="mx-auto h-12 w-12 text-destructive" />
            <h1 className="text-xl font-bold">Invitation invalide</h1>
            <p className="text-sm text-muted-foreground">
              Ce lien d&apos;invitation est introuvable, a déjà été utilisé, ou a expiré.
            </p>
            <Button asChild variant="outline">
              <Link href="/">Retour à l&apos;accueil</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired = invitation.expires_at ? new Date(invitation.expires_at) < new Date() : false;
  const isAccepted = !!invitation.accepted_at;

  if (isExpired || isAccepted) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <Clock className="mx-auto h-12 w-12 text-muted-foreground" />
            <h1 className="text-xl font-bold">
              {isAccepted ? "Invitation déjà acceptée" : "Invitation expirée"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isAccepted
                ? "Cette invitation a déjà été utilisée."
                : `Cette invitation a expiré le ${fmtDate(invitation.expires_at)}.`}
            </p>
            <Button asChild variant="outline">
              <Link href="/">Retour à l&apos;accueil</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  const team = Array.isArray(invitation.team) ? invitation.team[0] : invitation.team;
  const role = Array.isArray(invitation.role) ? invitation.role[0] : invitation.role;

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl">Invitation à rejoindre</CardTitle>
          {team && <p className="text-lg font-semibold text-primary mt-1">{team.name}</p>}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border p-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Email invité</span>
              <span className="font-medium">{invitation.email}</span>
            </div>
            {role && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Rôle</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{role.name}</Badge>
                  {invitation.is_owner && (
                    <Badge variant="default" className="gap-1">
                      <ShieldCheck className="h-3 w-3" />Propriétaire
                    </Badge>
                  )}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Expire le</span>
              <span>{fmtDate(invitation.expires_at)}</span>
            </div>
          </div>

          {!user ? (
            <div className="space-y-3">
              <p className="text-sm text-center text-muted-foreground">
                Vous devez être connecté avec <strong>{invitation.email}</strong> pour accepter cette invitation.
              </p>
              <Button asChild className="w-full" size="lg">
                <Link href={`/login?redirect=/invitations/${token}`}>Se connecter</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/signup?email=${encodeURIComponent(invitation.email)}&redirect=/invitations/${token}`}>
                  Créer un compte
                </Link>
              </Button>
            </div>
          ) : user.email !== invitation.email ? (
            <div className="space-y-3">
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                Vous êtes connecté en tant que <strong>{user.email}</strong>. Cette invitation est destinée à <strong>{invitation.email}</strong>.
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link href="/logout">Se déconnecter et changer de compte</Link>
              </Button>
            </div>
          ) : (
            <AcceptButton token={token} teamId={team?.id ?? ""} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
