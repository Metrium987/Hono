/* eslint-disable react-hooks/incompatible-library */
"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import Papa from "papaparse";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Download, Eye, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatCurrency(amount: number, symbol: string | undefined) {
  const formatted = amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return symbol ? `${formatted} ${symbol}` : `${formatted} XPF`;
}

function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (sorted === "asc") return <ArrowUp className="ml-1 h-3.5 w-3.5 shrink-0" />;
  if (sorted === "desc") return <ArrowDown className="ml-1 h-3.5 w-3.5 shrink-0" />;
  return <ArrowUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-40" />;
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
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo<ColumnDef<InvoiceRow>[]>(() => [
    {
      id: "invoice_number",
      accessorKey: "invoice_number",
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="-ml-3 h-8 gap-0 font-medium" onClick={() => column.toggleSorting()}>
          N° Facture
          <SortIcon sorted={column.getIsSorted()} />
        </Button>
      ),
      cell: ({ row }) => (
        <Link href={`${baseUrl}/${row.original.id}`} className="font-medium hover:text-primary transition-colors">
          {row.original.invoice_number}
        </Link>
      ),
    },
    {
      id: "customer",
      accessorFn: (row) => {
        const c = Array.isArray(row.customer) ? row.customer[0] : row.customer;
        return c?.company_name ?? c?.contact_name ?? "";
      },
      header: "Client",
      cell: ({ row }) => {
        const c = Array.isArray(row.original.customer) ? row.original.customer[0] : row.original.customer;
        return <span>{c?.company_name ?? c?.contact_name ?? "—"}</span>;
      },
    },
    {
      id: "issue_date",
      accessorKey: "issue_date",
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="-ml-3 h-8 gap-0 font-medium" onClick={() => column.toggleSorting()}>
          Date
          <SortIcon sorted={column.getIsSorted()} />
        </Button>
      ),
      cell: ({ getValue }) => formatDate(getValue<string>()),
    },
    {
      id: "due_date",
      accessorKey: "due_date",
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="-ml-3 h-8 gap-0 font-medium" onClick={() => column.toggleSorting()}>
          Échéance
          <SortIcon sorted={column.getIsSorted()} />
        </Button>
      ),
      cell: ({ getValue }) => formatDate(getValue<string>()),
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="-ml-3 h-8 gap-0 font-medium" onClick={() => column.toggleSorting()}>
          Statut
          <SortIcon sorted={column.getIsSorted()} />
        </Button>
      ),
      cell: ({ getValue }) => getStatusBadge(getValue<string>(), st),
    },
    {
      id: "total_ttc",
      accessorKey: "total_ttc",
      header: ({ column }) => (
        <div className="text-right">
          <Button variant="ghost" size="sm" className="h-8 gap-0 font-medium" onClick={() => column.toggleSorting()}>
            Total TTC
            <SortIcon sorted={column.getIsSorted()} />
          </Button>
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right font-medium">
          {formatCurrency(row.original.total_ttc, row.original.currency?.symbol)}
        </div>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" asChild title="Télécharger PDF">
            <Link href={`/api/v1/invoices/${row.original.id}/pdf`}>
              <Download className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild title="Voir">
            <Link href={`${baseUrl}/${row.original.id}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      ),
      enableSorting: false,
    },
  ], [st, baseUrl]);

  const table = useReactTable({
    data: invoices,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue) => {
      const q = filterValue.toLowerCase();
      const num = row.original.invoice_number.toLowerCase();
      const c = Array.isArray(row.original.customer) ? row.original.customer[0] : row.original.customer;
      const client = (c?.company_name ?? c?.contact_name ?? "").toLowerCase();
      return num.includes(q) || client.includes(q);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  function exportCsv() {
    const rows = table.getFilteredRowModel().rows.map(r => {
      const inv = r.original;
      const c = Array.isArray(inv.customer) ? inv.customer[0] : inv.customer;
      return {
        "N° Facture": inv.invoice_number,
        "Client": c?.company_name ?? c?.contact_name ?? "",
        "Date émission": formatDate(inv.issue_date),
        "Échéance": formatDate(inv.due_date),
        "Montant TTC": inv.total_ttc.toFixed(2),
        "Statut": inv.status,
      };
    });
    const csv = Papa.unparse(rows, { delimiter: ";", newline: "\r\n" });
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "factures.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export téléchargé");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Rechercher par N° ou client..."
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
          className="max-w-xs h-8 text-sm"
        />
        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2 shrink-0">
          <Download className="h-3.5 w-3.5" />
          Exporter CSV
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(hg => (
              <TableRow key={hg.id}>
                {hg.headers.map(header => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-12 text-muted-foreground">
                  Aucune facture trouvée
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Page {currentPage} sur {totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={currentPage <= 1} asChild={currentPage > 1}>
                {currentPage > 1 ? (
                  <Link href={`${baseUrl}?page=${currentPage - 1}${currentStatus ? `&status=${currentStatus}` : ""}`}>
                    <ChevronLeft className="h-4 w-4" />
                    Précédent
                  </Link>
                ) : (
                  <span><ChevronLeft className="h-4 w-4" /> Précédent</span>
                )}
              </Button>
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages} asChild={currentPage < totalPages}>
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
    </div>
  );
}
