"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type InvoiceRow = {
  id: string;
  invoice_number: string;
  status: string;
  total_ttc: number;
  paid_amount: number;
  issue_date: string;
  due_date: string;
  customer: { company_name: string | null; contact_name: string } | null;
  currency: { symbol: string } | null;
};

type InvoicesListClientProps = {
  invoices: InvoiceRow[];
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
    sent: "info",
    viewed: "info",
    partial: "warning",
    paid: "success",
    overdue: "destructive",
    cancelled: "secondary",
    refunded: "secondary",
  };
  return <Badge variant={variants[status] ?? "default"}>{st(status)}</Badge>;
}

export function InvoicesListClient({ invoices, currentPage, totalPages, baseUrl, currentStatus }: InvoicesListClientProps) {
  const st = useTranslations("invoice_status");
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>N° Facture</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Échéance</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Total TTC</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                Aucune facture trouvée
              </TableCell>
            </TableRow>
          ) : (
            invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">
                  <Link href={`${baseUrl}/${inv.id}`} className="hover:text-primary transition-colors">
                    {inv.invoice_number}
                  </Link>
                </TableCell>
                <TableCell>{inv.customer?.company_name ?? inv.customer?.contact_name ?? "—"}</TableCell>
                <TableCell>{formatDate(inv.issue_date)}</TableCell>
                <TableCell>{formatDate(inv.due_date)}</TableCell>
                <TableCell>{getStatusBadge(inv.status, st)}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(inv.total_ttc, inv.currency?.symbol)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/api/v1/invoices/${inv.id}/pdf`}>
                        <Download className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`${baseUrl}/${inv.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} sur {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              asChild={currentPage > 1}
            >
              {currentPage > 1 ? (
                <Link href={`${baseUrl}?page=${currentPage - 1}${currentStatus ? `&status=${currentStatus}` : ""}`}>
                  <ChevronLeft className="h-4 w-4" />
                  Précédent
                </Link>
              ) : (
                <span><ChevronLeft className="h-4 w-4" /> Précédent</span>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              asChild={currentPage < totalPages}
            >
              {currentPage < totalPages ? (
                <Link href={`${baseUrl}?page=${currentPage + 1}`}>
                  Suivant
                  <ChevronRight className="h-4 w-4" />
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
