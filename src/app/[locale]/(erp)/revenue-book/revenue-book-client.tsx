"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export type ReceiptRow = {
  date: string;
  nature: string;
  ref: string;
  client: string;
  ht: number;
  tva: number;
  ttc: number;
  source: "invoice" | "income";
};

function fmt(n: number) {
  return Math.round(n).toLocaleString("fr-FR");
}

function csvEscape(s: string) {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function RevenueBookClient({
  rows,
  year,
  years,
}: {
  rows: ReceiptRow[];
  year: number;
  years: number[];
}) {
  const [selectedYear, setSelectedYear] = useState(year);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const d = new Date(r.date);
      if (d.getFullYear() !== selectedYear) return false;
      if (selectedMonth !== null && d.getMonth() + 1 !== selectedMonth) return false;
      return true;
    });
  }, [rows, selectedYear, selectedMonth]);

  const totals = useMemo(() => filtered.reduce(
    (acc, r) => ({ ht: acc.ht + r.ht, tva: acc.tva + r.tva, ttc: acc.ttc + r.ttc }),
    { ht: 0, tva: 0, ttc: 0 }
  ), [filtered]);

  function exportCSV() {
    const header = ["N°", "Date", "Nature", "N° Pièce", "Client", "Montant HT (F CFP)", "TVA (F CFP)", "Montant TTC (F CFP)"];
    const lines = filtered.map((r, i) => [
      i + 1,
      new Date(r.date).toLocaleDateString("fr-FR"),
      csvEscape(r.nature),
      csvEscape(r.ref),
      csvEscape(r.client),
      Math.round(r.ht),
      Math.round(r.tva),
      Math.round(r.ttc),
    ].join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `livre-recettes-${selectedYear}${selectedMonth ? `-${String(selectedMonth).padStart(2, "0")}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

  return (
    <div className="space-y-4">
      {/* Filters + Export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Year */}
          <div className="flex rounded-md border overflow-hidden text-sm">
            {years.map((y) => (
              <button
                key={y}
                onClick={() => { setSelectedYear(y); setSelectedMonth(null); }}
                className={`px-3 py-1.5 transition-colors ${selectedYear === y ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-accent"}`}
              >
                {y}
              </button>
            ))}
          </div>
          {/* Month pills */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setSelectedMonth(null)}
              className={`px-2 py-1 rounded text-xs transition-colors ${selectedMonth === null ? "bg-primary text-primary-foreground font-semibold" : "border hover:bg-accent"}`}
            >
              Tout
            </button>
            {MONTHS.map((m, i) => (
              <button
                key={i}
                onClick={() => setSelectedMonth(i + 1)}
                className={`px-2 py-1 rounded text-xs transition-colors ${selectedMonth === i + 1 ? "bg-primary text-primary-foreground font-semibold" : "border hover:bg-accent"}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={exportCSV} disabled={filtered.length === 0} className="gap-1.5">
          <Download className="h-4 w-4" /> Exporter CSV
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Total HT</p>
          <p className="text-xl font-bold mt-0.5">{fmt(totals.ht)} F</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">TVA collectée</p>
          <p className="text-xl font-bold mt-0.5">{fmt(totals.tva)} F</p>
        </div>
        <div className="rounded-lg border p-3 bg-primary/5">
          <p className="text-xs text-muted-foreground">Total TTC encaissé</p>
          <p className="text-xl font-bold mt-0.5 text-primary">{fmt(totals.ttc)} F</p>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
          Aucune recette enregistrée pour cette période
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-10">N°</th>
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Nature</th>
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">N° Pièce</th>
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Client / Source</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">HT (F CFP)</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">TVA (F CFP)</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">TTC (F CFP)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((r, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                      {new Date(r.date).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-3 py-2.5 max-w-[200px] truncate">{r.nature}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{r.ref}</td>
                    <td className="px-3 py-2.5 max-w-[160px] truncate">{r.client}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmt(r.ht)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{fmt(r.tva)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{fmt(r.ttc)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/50 border-t-2">
                <tr>
                  <td colSpan={5} className="px-3 py-2.5 font-semibold text-sm">
                    Total — {filtered.length} recette{filtered.length > 1 ? "s" : ""}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums">{fmt(totals.ht)}</td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums">{fmt(totals.tva)}</td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums text-primary">{fmt(totals.ttc)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Livre de recettes conforme à la réglementation fiscale PF — recettes encaissées uniquement (factures payées + recettes directes)
      </p>
    </div>
  );
}
