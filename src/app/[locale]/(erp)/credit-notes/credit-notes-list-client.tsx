"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type CreditNoteRow = {
  id: string;
  credit_note_number: string;
  status: string;
  total_ttc: number;
  issue_date: string;
  reason: string | null;
  customer: { company_name: string | null; contact_name: string } | null;
  currency: { symbol: string } | null;
};

type Props = {
  creditNotes: CreditNoteRow[];
  currentPage: number;
  totalPages: number;
  baseUrl: string;
  currentStatus?: string;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatCurrency(amount: number, symbol: string | undefined) {
  const formatted = amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return symbol ? `${formatted} ${symbol}` : `${formatted} XPF`;
}

function getStatusBadge(status: string, st: (key: string) => string) {
  const variants: Record<string, "default" | "success" | "warning" | "destructive" | "secondary" | "info"> = {
    draft: "secondary",
    issued: "info",
    applied: "success",
    cancelled: "destructive",
  };
  const variant = variants[status] ?? "secondary";
  return <Badge variant={variant}>{st(status as keyof typeof st)}</Badge>;
}

function getStatusHref(status: string, baseUrl: string, currentStatus: string) {
  return status ? `${baseUrl}?status=${status}` : baseUrl;
}

export function CreditNotesListClient({ creditNotes, currentPage, totalPages, baseUrl, currentStatus }: Props) {
  const t = useTranslations("credit_notes_page");
  const st = useTranslations("credit_note_status");

  if (creditNotes.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">{t("no_credit_notes")}</p>;
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("title")}</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Motif</TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {creditNotes.map((cn) => (
            <TableRow key={cn.id}>
              <TableCell className="font-medium">{cn.credit_note_number}</TableCell>
              <TableCell>{formatDate(cn.issue_date)}</TableCell>
              <TableCell>{cn.customer?.company_name ?? cn.customer?.contact_name ?? "-"}</TableCell>
              <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{cn.reason ?? "-"}</TableCell>
              <TableCell className="text-right">{formatCurrency(cn.total_ttc, cn.currency?.symbol)}</TableCell>
              <TableCell>{getStatusBadge(cn.status, st)}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" asChild>
                  <Link href={`${baseUrl}/${cn.id}`}>
                    <Eye className="h-4 w-4" />
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={currentPage <= 1} asChild={currentPage > 1}>
            {currentPage > 1 ? (
              <Link href={`${baseUrl}?${new URLSearchParams({ ...(currentStatus ? { status: currentStatus } : {}), page: String(currentPage - 1) }).toString()}`}>
                <ChevronLeft className="h-4 w-4" />
              </Link>
            ) : (
              <span><ChevronLeft className="h-4 w-4" /></span>
            )}
          </Button>
          <span className="text-sm text-muted-foreground">{currentPage} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={currentPage >= totalPages} asChild={currentPage < totalPages}>
            {currentPage < totalPages ? (
              <Link href={`${baseUrl}?${new URLSearchParams({ ...(currentStatus ? { status: currentStatus } : {}), page: String(currentPage + 1) }).toString()}`}>
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span><ChevronRight className="h-4 w-4" /></span>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
