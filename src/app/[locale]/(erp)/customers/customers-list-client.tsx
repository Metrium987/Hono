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
import { ChevronLeft, ChevronRight, Eye, Users, Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type CustomerRow = {
  id: string;
  company_name: string | null;
  contact_name: string;
  email: string | null;
  phone: string | null;
  n_tahiti: string | null;
  portal_enabled: boolean | null;
  city: string | null;
};

type Props = {
  customers: CustomerRow[];
  currentPage: number;
  totalPages: number;
  baseUrl: string;
};

function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (sorted === "asc") return <ArrowUp className="ml-1 h-3.5 w-3.5 shrink-0" />;
  if (sorted === "desc") return <ArrowDown className="ml-1 h-3.5 w-3.5 shrink-0" />;
  return <ArrowUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-40" />;
}

export function CustomersListClient({ customers, currentPage, totalPages, baseUrl }: Props) {
  const t = useTranslations("customers_page");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo<ColumnDef<CustomerRow>[]>(() => [
    {
      id: "company_name",
      accessorFn: (row) => row.company_name ?? "",
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="-ml-3 h-8 gap-0 font-medium" onClick={() => column.toggleSorting()}>
          {t("th_company")}
          <SortIcon sorted={column.getIsSorted()} />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium">{row.original.company_name ?? "-"}</span>
        </div>
      ),
    },
    {
      id: "contact_name",
      accessorKey: "contact_name",
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="-ml-3 h-8 gap-0 font-medium" onClick={() => column.toggleSorting()}>
          {t("th_contact")}
          <SortIcon sorted={column.getIsSorted()} />
        </Button>
      ),
      cell: ({ getValue }) => <span>{getValue<string>()}</span>,
    },
    {
      id: "email",
      accessorFn: (row) => row.email ?? "",
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="-ml-3 h-8 gap-0 font-medium" onClick={() => column.toggleSorting()}>
          {t("th_email")}
          <SortIcon sorted={column.getIsSorted()} />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.email ?? "-"}</span>
      ),
    },
    {
      id: "phone",
      accessorKey: "phone",
      header: t("th_phone"),
      cell: ({ row }) => <span className="text-sm">{row.original.phone ?? "-"}</span>,
      enableSorting: false,
    },
    {
      id: "n_tahiti",
      accessorKey: "n_tahiti",
      header: t("th_tahiti"),
      cell: ({ row }) => <span className="text-sm">{row.original.n_tahiti ?? "-"}</span>,
      enableSorting: false,
    },
    {
      id: "portal_enabled",
      accessorFn: (row) => (row.portal_enabled ? 1 : 0),
      header: t("th_portal"),
      cell: ({ row }) => (
        <Badge variant={row.original.portal_enabled ? "success" : "secondary"}>
          {row.original.portal_enabled ? "Oui" : "Non"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="icon" asChild title="Voir fiche">
            <Link href={`${baseUrl}/${row.original.id}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      ),
      enableSorting: false,
    },
  ], [t, baseUrl]);

  const table = useReactTable({
    data: customers,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue) => {
      const q = filterValue.toLowerCase();
      const name = (row.original.company_name ?? "").toLowerCase();
      const contact = row.original.contact_name.toLowerCase();
      const email = (row.original.email ?? "").toLowerCase();
      const city = (row.original.city ?? "").toLowerCase();
      return name.includes(q) || contact.includes(q) || email.includes(q) || city.includes(q);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  function exportCsv() {
    const rows = table.getFilteredRowModel().rows.map(r => ({
      "Société": r.original.company_name ?? "",
      "Contact": r.original.contact_name,
      "Email": r.original.email ?? "",
      "Téléphone": r.original.phone ?? "",
      "N° Tahiti": r.original.n_tahiti ?? "",
      "Ville": r.original.city ?? "",
      "Portail": r.original.portal_enabled ? "Oui" : "Non",
    }));
    const csv = Papa.unparse(rows, { delimiter: ";", newline: "\r\n" });
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clients.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export téléchargé");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Rechercher par nom, email, ville..."
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
          className="max-w-xs h-8 text-sm"
        />
        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2 shrink-0">
          <Download className="h-3.5 w-3.5" />
          Exporter CSV
        </Button>
      </div>

      {customers.length === 0 && !globalFilter ? (
        <p className="text-sm text-muted-foreground py-8 text-center">{t("no_customers")}</p>
      ) : (
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
                    Aucun client trouvé
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
            <div className="flex items-center justify-center gap-2 border-t px-4 py-3">
              <span className="text-sm text-muted-foreground">{currentPage} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={currentPage <= 1} asChild={currentPage > 1}>
                {currentPage > 1 ? (
                  <Link href={`${baseUrl}?page=${currentPage - 1}`}><ChevronLeft className="h-4 w-4" /></Link>
                ) : <span><ChevronLeft className="h-4 w-4" /></span>}
              </Button>
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages} asChild={currentPage < totalPages}>
                {currentPage < totalPages ? (
                  <Link href={`${baseUrl}?page=${currentPage + 1}`}><ChevronRight className="h-4 w-4" /></Link>
                ) : <span><ChevronRight className="h-4 w-4" /></span>}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
