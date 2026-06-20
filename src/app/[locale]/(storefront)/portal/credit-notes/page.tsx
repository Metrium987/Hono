import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPortalSession } from "@/lib/portal/session";

type PortalCreditNote = {
  id: string;
  credit_note_number: string;
  status: string;
  issue_date: string;
  total_ttc: number | string | null;
  currency: { symbol?: string | null } | Array<{ symbol?: string | null }> | null;
};

function unwrapSym(v: PortalCreditNote["currency"]): string {
  const c = Array.isArray(v) ? v[0] : v;
  return c?.symbol ?? "F";
}

const STATUS_VARIANT: Record<string, "secondary" | "default" | "success" | "destructive"> = {
  draft: "secondary",
  issued: "default",
  applied: "success",
  cancelled: "destructive",
};

export default async function PortalCreditNotesPage() {
  const session = await getPortalSession();
  if (!session) redirect("../portal/auth");

  const [pt, st] = await Promise.all([
    getTranslations("portal"),
    getTranslations("credit_note_status"),
  ]);

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data } = await supabase
    .from("credit_notes")
    .select("id, credit_note_number, status, issue_date, total_ttc, currency:currency_id(symbol)")
    .eq("customer_id", session.customerId)
    .order("issue_date", { ascending: false });

  const notes: PortalCreditNote[] = Array.isArray(data) ? data : [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{pt("my_credit_notes")}</h1>
        <p className="text-sm text-muted-foreground">{pt("credit_note_count", { count: notes.length })}</p>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{pt("credit_note_ref")}</TableHead>
              <TableHead>{pt("issue_date")}</TableHead>
              <TableHead>{pt("status")}</TableHead>
              <TableHead className="text-right">{pt("total_ttc")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  {pt("no_credit_notes")}
                </TableCell>
              </TableRow>
            ) : (
              notes.map((cn) => {
                const sym = unwrapSym(cn.currency);
                const total = typeof cn.total_ttc === "number" ? cn.total_ttc : parseFloat(String(cn.total_ttc ?? 0));
                return (
                  <TableRow key={cn.id}>
                    <TableCell className="font-medium">
                      <Link href={`./credit-notes/${cn.id}`} className="hover:text-primary transition-colors">
                        {cn.credit_note_number}
                      </Link>
                    </TableCell>
                    <TableCell>{new Date(cn.issue_date).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[cn.status] ?? "default"}>
                        {st(cn.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {total.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {sym}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
