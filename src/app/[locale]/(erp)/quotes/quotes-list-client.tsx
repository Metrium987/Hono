"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type QuoteRow = {
  id: string;
  quote_number: string;
  status: string;
  total_ttc: number;
  issue_date: string;
  validity_date: string | null;
  customer: { company_name: string | null; contact_name: string } | null;
  currency: { symbol: string } | null;
};

type QuotesListClientProps = {
  quotes: QuoteRow[];
  currentPage: number;
  totalPages: number;
  baseUrl: string;
  currentStatus?: string;
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatCurrency(amount: number, symbol: string | undefined) {
  const formatted = amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return symbol ? `${formatted} ${symbol}` : `${formatted} XPF`;
}

function getStatusBadge(status: string, qt: (key: string) => string) {
  const variants: Record<string, "default" | "success" | "warning" | "destructive" | "secondary" | "info"> = {
    draft: "secondary",
    sent: "info",
    viewed: "info",
    accepted: "success",
    rejected: "destructive",
    expired: "warning",
    converted: "default",
  };
  return <Badge variant={variants[status] ?? "default"}>{qt(status)}</Badge>;
}

export function QuotesListClient({ quotes, currentPage, totalPages, baseUrl, currentStatus }: QuotesListClientProps) {
  const qt = useTranslations("quote_status");
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>N° Devis</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Validité</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Total TTC</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                Aucun devis trouvé
              </TableCell>
            </TableRow>
          ) : (
            quotes.map((q) => (
              <TableRow key={q.id}>
                <TableCell className="font-medium">
                  <Link href={`${baseUrl}/${q.id}`} className="hover:text-primary transition-colors">
                    {q.quote_number}
                  </Link>
                </TableCell>
                <TableCell>{q.customer?.company_name ?? q.customer?.contact_name ?? "—"}</TableCell>
                <TableCell>{formatDate(q.issue_date)}</TableCell>
                <TableCell>{q.validity_date ? formatDate(q.validity_date) : "—"}</TableCell>
                <TableCell>{getStatusBadge(q.status, qt)}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(q.total_ttc, q.currency?.symbol)}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`${baseUrl}/${q.id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t px-4 py-3">
          <p className="text-sm text-muted-foreground">Page {currentPage} sur {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={currentPage <= 1} asChild={currentPage > 1}>
              {currentPage > 1 ? (
                <Link href={`${baseUrl}?page=${currentPage - 1}${currentStatus ? `&status=${currentStatus}` : ""}`}>
                  <ChevronLeft className="h-4 w-4" /> Précédent
                </Link>
              ) : (
                <span><ChevronLeft className="h-4 w-4" /> Précédent</span>
              )}
            </Button>
            <Button variant="outline" size="sm" disabled={currentPage >= totalPages} asChild={currentPage < totalPages}>
              {currentPage < totalPages ? (
                <Link href={`${baseUrl}?page=${currentPage + 1}`}>
                  Suivant <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <span>Suivant <ChevronRight className="h-4 w-4" /></span>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
