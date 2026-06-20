import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, StickyNote, MessageSquare, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddNoteForm } from "./add-note-form";

type Params = Promise<{ id: string }>;

type CrmNote = {
  id: string;
  content: string;
  created_at: string;
  author: { full_name: string | null } | Array<{ full_name: string | null }> | null;
};

type CrmRequest = {
  id: string;
  subject: string;
  message: string | null;
  status: string;
  created_at: string;
};

function unwrapAuthor(v: CrmNote["author"]): string {
  const a = Array.isArray(v) ? v[0] : v;
  return a?.full_name ?? "Anonyme";
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const REQUEST_STATUS: Record<string, "secondary" | "default" | "success" | "warning"> = {
  open: "default",
  in_progress: "warning",
  closed: "secondary",
};

export default async function CustomerCrmPage(props: { params: Params }) {
  const { id } = await props.params;

  const [t, common] = await Promise.all([
    getTranslations("customer_detail"),
    getTranslations("common"),
  ]);

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div>{common("not_connected")}</div>;

  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .limit(1);

  const teamId = memberships?.[0]?.team_id;
  if (!teamId) return <div>{common("no_team")}</div>;

  const { data: customer } = await supabase
    .from("customers")
    .select("id, company_name, contact_name")
    .eq("id", id)
    .eq("team_id", teamId)
    .single();

  if (!customer) notFound();

  const [notesRes, requestsRes] = await Promise.all([
    supabase
      .from("crm_notes")
      .select("id, content, created_at, author:author_id(full_name)")
      .eq("customer_id", id)
      .eq("team_id", teamId)
      .order("created_at", { ascending: false }),
    supabase
      .from("crm_requests")
      .select("id, subject, message, status, created_at")
      .eq("customer_id", id)
      .eq("team_id", teamId)
      .order("created_at", { ascending: false }),
  ]);

  const notes: CrmNote[] = Array.isArray(notesRes.data) ? notesRes.data : [];
  const requests: CrmRequest[] = Array.isArray(requestsRes.data) ? requestsRes.data : [];

  const customerName = customer.company_name ?? customer.contact_name;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`../${id}`}><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{t("crm_title")}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{customerName}</p>
        </div>
        <Button variant="outline" asChild size="sm">
          <Link href={`../${id}`}>Fiche client</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">{t("crm_notes_title")}</h2>
            <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">{notes.length}</span>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("add_note")}</CardTitle>
            </CardHeader>
            <CardContent>
              <AddNoteForm customerId={id} teamId={teamId} />
            </CardContent>
          </Card>

          <div className="space-y-3">
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t("no_notes")}</p>
            ) : (
              notes.map((note) => (
                <Card key={note.id}>
                  <CardContent className="p-4">
                    <p className="text-sm whitespace-pre-line">{note.content}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{fmtDateTime(note.created_at)}</span>
                      <span>·</span>
                      <span>{unwrapAuthor(note.author)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">{t("crm_requests_title")}</h2>
            <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">{requests.length}</span>
          </div>

          <div className="space-y-3">
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t("no_requests")}</p>
            ) : (
              requests.map((req) => (
                <Card key={req.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-medium">{req.subject}</p>
                      <Badge variant={REQUEST_STATUS[req.status] ?? "default"} className="shrink-0 text-xs">
                        {req.status === "open" ? t("request_open")
                          : req.status === "in_progress" ? t("request_in_progress")
                          : t("request_closed")}
                      </Badge>
                    </div>
                    {req.message && <p className="text-sm text-muted-foreground">{req.message}</p>}
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{fmtDateTime(req.created_at)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
