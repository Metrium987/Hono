"use client";

import { useState, useMemo, useTransition } from "react";
import {
  ComposedChart, Bar, ReferenceLine, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, CheckCircle, Target } from "lucide-react";

export type BreakEvenExpense = {
  id: string;
  description: string;
  vendor_name: string | null;
  amount: number;
  expense_date: string;
  is_fixed_cost: boolean;
};

export type MonthlyCA = {
  month: string;
  key: string;
  ca: number;
};

function fmt(n: number) {
  return `${Math.round(n).toLocaleString("fr-FR")} F`;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background shadow-md p-3 text-xs min-w-[180px] space-y-1">
      <p className="font-semibold">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-medium tabular-nums">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function BreakEvenClient({
  expenses,
  monthlyCA,
  teamId,
}: {
  expenses: BreakEvenExpense[];
  monthlyCA: MonthlyCA[];
  teamId: string;
}) {
  const [items, setItems] = useState(expenses);
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  async function toggleFixed(id: string, value: boolean) {
    setItems((prev) => prev.map((e) => e.id === id ? { ...e, is_fixed_cost: value } : e));
    setSaving((s) => ({ ...s, [id]: true }));
    startTransition(async () => {
      await fetch(`/api/v1/expenses/${id}?team_id=${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_fixed_cost: value }),
      });
      setSaving((s) => { const n = { ...s }; delete n[id]; return n; });
    });
  }

  const { chargesFixes, chargesVariables, totalCA } = useMemo(() => {
    const cf = items.filter((e) => e.is_fixed_cost).reduce((s, e) => s + e.amount, 0);
    const cv = items.filter((e) => !e.is_fixed_cost).reduce((s, e) => s + e.amount, 0);
    const ca = monthlyCA.reduce((s, m) => s + m.ca, 0);
    return { chargesFixes: cf, chargesVariables: cv, totalCA: ca };
  }, [items, monthlyCA]);

  const tauxMarge = totalCA > 0 ? (totalCA - chargesVariables) / totalCA : 0;
  const seuil = tauxMarge > 0 ? chargesFixes / tauxMarge : null;

  // Cumulative chart data
  const chartData = useMemo(() => {
    let cumul = 0;
    return monthlyCA.map((m) => {
      cumul += m.ca;
      return { month: m.month, "CA mensuel": Math.round(m.ca), "CA cumulé": Math.round(cumul) };
    });
  }, [monthlyCA]);

  const caAtteint = seuil !== null && totalCA >= seuil;
  const pctAtteint = seuil !== null && seuil > 0 ? Math.min(100, (totalCA / seuil) * 100) : 0;

  // Find the month when cumulative CA crosses the seuil
  let moisSeuil: string | null = null;
  if (seuil !== null) {
    let cumul = 0;
    for (const m of monthlyCA) {
      cumul += m.ca;
      if (cumul >= seuil) { moisSeuil = m.month; break; }
    }
  }

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground mb-1">Charges fixes</p>
          <p className="text-2xl font-bold text-red-600">{fmt(chargesFixes)}</p>
          <p className="text-xs text-muted-foreground mt-1">{items.filter((e) => e.is_fixed_cost).length} dépenses classées fixes</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground mb-1">Taux de marge</p>
          <p className="text-2xl font-bold">{(tauxMarge * 100).toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground mt-1">(CA − charges variables) / CA</p>
        </div>
        <div className="rounded-lg border p-4 bg-primary/5">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <Target className="h-3.5 w-3.5" /> Seuil de rentabilité
          </p>
          <p className="text-2xl font-bold text-primary">
            {seuil !== null ? fmt(seuil) : tauxMarge === 0 ? "—" : fmt(0)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {seuil === null ? "Classez au moins une dépense fixe" : `CA à atteindre sur la période`}
          </p>
        </div>
        <div className={`rounded-lg border p-4 ${caAtteint ? "border-green-300 bg-green-50/30" : ""}`}>
          <p className="text-xs text-muted-foreground mb-1">CA réalisé</p>
          <p className={`text-2xl font-bold ${caAtteint ? "text-green-600" : ""}`}>{fmt(totalCA)}</p>
          <p className="text-xs mt-1">
            {caAtteint
              ? <span className="text-green-600 flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> Seuil atteint {moisSeuil && `en ${moisSeuil}`}</span>
              : seuil !== null
              ? <span className="text-muted-foreground">Il manque {fmt(seuil - totalCA)}</span>
              : <span className="text-muted-foreground">—</span>
            }
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {seuil !== null && seuil > 0 && (
        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-primary" />
              Progression vers le seuil
            </span>
            <span className={`font-bold ${caAtteint ? "text-green-600" : "text-primary"}`}>{pctAtteint.toFixed(1)}%</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${caAtteint ? "bg-green-500" : "bg-primary"}`}
              style={{ width: `${pctAtteint}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0 F</span>
            <span className="font-medium">{fmt(seuil)}</span>
          </div>
        </div>
      )}

      {/* Chart */}
      {monthlyCA.length > 0 && (
        <div className="rounded-lg border p-4">
          <p className="text-sm font-semibold mb-4">CA cumulé vs seuil de rentabilité</p>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={45} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                formatter={(value) => <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>} />
              <Bar dataKey="CA mensuel" fill="hsl(var(--primary) / 0.4)" radius={[3, 3, 0, 0]} maxBarSize={36} />
              <Bar dataKey="CA cumulé" fill="hsl(var(--primary) / 0.8)" radius={[3, 3, 0, 0]} maxBarSize={36} />
              {seuil !== null && (
                <ReferenceLine
                  y={seuil}
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  label={{ value: `Seuil ${fmt(seuil)}`, position: "insideTopRight", fontSize: 11, fill: "hsl(var(--destructive))" }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Expense classification table */}
      <div className="rounded-lg border overflow-hidden">
        <div className="px-4 py-3 bg-muted/50 border-b flex items-center justify-between">
          <p className="text-sm font-semibold">Classification des dépenses</p>
          <p className="text-xs text-muted-foreground">Activez le bouton pour marquer une dépense comme charge fixe</p>
        </div>
        {items.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Aucune dépense enregistrée</div>
        ) : (
          <div className="divide-y">
            {items.map((exp) => (
              <div key={exp.id} className={`flex items-center justify-between px-4 py-3 transition-colors ${exp.is_fixed_cost ? "bg-red-50/30 dark:bg-red-950/10" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{exp.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {exp.vendor_name && <span className="mr-2">{exp.vendor_name}</span>}
                    {new Date(exp.expense_date).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0 ml-4">
                  <p className="text-sm font-semibold tabular-nums">{fmt(exp.amount)}</p>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={`text-[10px] px-1.5 w-16 justify-center ${exp.is_fixed_cost ? "bg-red-100 text-red-700 border-red-200" : "bg-muted text-muted-foreground border"}`}
                    >
                      {exp.is_fixed_cost ? "Fixe" : "Variable"}
                    </Badge>
                    <Switch
                      checked={exp.is_fixed_cost}
                      onCheckedChange={(v) => toggleFixed(exp.id, v)}
                      disabled={saving[exp.id]}
                      className="data-[state=checked]:bg-red-600"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
