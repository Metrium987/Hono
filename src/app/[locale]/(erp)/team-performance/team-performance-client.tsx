"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, CheckCircle2, Circle, Trash2, Plus } from "lucide-react";

export type StaffMember = { id: string; name: string; email: string | null; role_name: string };

export type CommissionRule = {
  id: string; user_id: string; rate: number; applies_from: string; applies_to: string | null;
};

export type CommissionRow = {
  id: string; user_id: string; amount: number; rate: number; status: "pending" | "paid"; paid_at: string | null; created_at: string;
  invoice: { number: string; total_ttc: number; customer: { contact_name: string }[] | { contact_name: string } | null } | null;
};

export type StaffPerf = {
  member: StaffMember;
  invoiceCount: number;
  caTtc: number;
  pendingCommission: number;
  paidCommission: number;
  commissions: CommissionRow[];
  rules: CommissionRule[];
};

const TYPE_BADGE = { pending: "bg-amber-100 text-amber-700 border-amber-200", paid: "bg-green-100 text-green-700 border-green-200" };

export function TeamPerformanceClient({
  staffPerfs, rules: allRules, members, teamId,
}: { staffPerfs: StaffPerf[]; rules: CommissionRule[]; members: StaffMember[]; teamId: string }) {
  const [perfs, setPerfs] = useState(staffPerfs);
  const [rules, setRules] = useState(allRules);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState({ user_id: "", rate: "", applies_from: new Date().toISOString().slice(0, 10), applies_to: "" });
  const [saving, setSaving] = useState(false);

  async function toggleCommissionPaid(commId: string, currentStatus: string) {
    const newStatus = currentStatus === "paid" ? "pending" : "paid";
    const res = await fetch(`/api/v1/commissions/${commId}?team_id=${teamId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) return;
    setPerfs((prev) => prev.map((p) => ({
      ...p,
      commissions: p.commissions.map((c) => c.id === commId ? { ...c, status: newStatus as "pending" | "paid", paid_at: newStatus === "paid" ? new Date().toISOString() : null } : c),
      pendingCommission: p.commissions.reduce((sum, c) => c.id === commId ? (newStatus === "pending" ? sum + c.amount : sum - c.amount) : sum, p.pendingCommission),
      paidCommission: p.commissions.reduce((sum, c) => c.id === commId ? (newStatus === "paid" ? sum + c.amount : sum - c.amount) : sum, p.paidCommission),
    })));
  }

  async function deleteRule(id: string) {
    await fetch(`/api/v1/commission-rules/${id}?team_id=${teamId}`, { method: "DELETE" });
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  async function addRule() {
    if (!ruleForm.user_id || !ruleForm.rate) return;
    setSaving(true);
    const res = await fetch(`/api/v1/commission-rules?team_id=${teamId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: ruleForm.user_id, rate: parseFloat(ruleForm.rate), applies_from: ruleForm.applies_from + "T00:00:00Z", applies_to: ruleForm.applies_to ? ruleForm.applies_to + "T00:00:00Z" : null }),
    });
    if (res.ok) {
      const json = await res.json();
      setRules((prev) => [json.data, ...prev]);
      setRuleForm({ user_id: "", rate: "", applies_from: new Date().toISOString().slice(0, 10), applies_to: "" });
    }
    setSaving(false);
  }

  const detailPerf = perfs.find((p) => p.member.id === detailUser);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRulesOpen(true)}>
          <Settings className="h-4 w-4" /> Règles de commission
        </Button>
      </div>

      {/* Staff performance cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {perfs.map((p) => (
          <button key={p.member.id} onClick={() => setDetailUser(p.member.id)}
            className="rounded-lg border bg-card p-4 text-left hover:shadow-md transition-all space-y-3 w-full">
            <div>
              <p className="font-semibold">{p.member.name}</p>
              <p className="text-xs text-muted-foreground">{p.member.email}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-muted-foreground text-xs">Factures</p><p className="font-bold">{p.invoiceCount}</p></div>
              <div><p className="text-muted-foreground text-xs">CA TTC</p><p className="font-bold">{Math.round(p.caTtc).toLocaleString("fr-FR")} F</p></div>
              <div><p className="text-muted-foreground text-xs">Commission due</p><p className="font-bold text-amber-600">{Math.round(p.pendingCommission).toLocaleString("fr-FR")} F</p></div>
              <div><p className="text-muted-foreground text-xs">Commission payée</p><p className="font-bold text-green-600">{Math.round(p.paidCommission).toLocaleString("fr-FR")} F</p></div>
            </div>
            {p.invoiceCount === 0 && <p className="text-xs text-muted-foreground italic">Aucune facture attribuée</p>}
          </button>
        ))}
        {perfs.length === 0 && (
          <div className="col-span-3 rounded-lg border py-12 text-center text-sm text-muted-foreground">
            Aucune facture n&apos;est attribuée à un commercial. Assignez des factures via la fiche client ou la facture.
          </div>
        )}
      </div>

      {/* Commission detail dialog */}
      <Dialog open={!!detailUser} onOpenChange={(o) => !o && setDetailUser(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailPerf?.member.name} — Commissions</DialogTitle>
          </DialogHeader>
          {detailPerf && (
            <div className="space-y-3">
              {detailPerf.commissions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Aucune commission</p>
              ) : detailPerf.commissions.map((c) => {
                const inv = c.invoice;
                const custName = inv?.customer ? (Array.isArray(inv.customer) ? inv.customer[0]?.contact_name : (inv.customer as { contact_name: string }).contact_name) : "—";
                return (
                  <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Facture {inv?.number} · {custName}</p>
                      <p className="text-xs text-muted-foreground">
                        CA {Math.round(inv?.total_ttc ?? 0).toLocaleString("fr-FR")} F · taux {c.rate}% → commission <strong>{Math.round(c.amount).toLocaleString("fr-FR")} F</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={`text-[10px] ${TYPE_BADGE[c.status]}`}>{c.status === "paid" ? "Payée" : "En attente"}</Badge>
                      <button onClick={() => toggleCommissionPaid(c.id, c.status)} className="text-muted-foreground hover:text-primary">
                        {c.status === "paid" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Commission rules dialog */}
      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Règles de commission</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              {rules.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune règle définie</p>
              ) : rules.map((r) => {
                const m = members.find((x) => x.id === r.user_id);
                return (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium">{m?.name ?? r.user_id}</span>
                      <span className="text-muted-foreground"> → {r.rate}% </span>
                      <span className="text-xs text-muted-foreground">depuis {new Date(r.applies_from).toLocaleDateString("fr-FR")}{r.applies_to && ` → ${new Date(r.applies_to).toLocaleDateString("fr-FR")}`}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteRule(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                );
              })}
            </div>
            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-medium">Nouvelle règle</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Commercial</Label>
                  <Select value={ruleForm.user_id} onValueChange={(v) => setRuleForm((f) => ({ ...f, user_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                    <SelectContent>{members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Taux (%)</Label>
                  <Input type="number" min="0" max="100" step="0.5" value={ruleForm.rate} onChange={(e) => setRuleForm((f) => ({ ...f, rate: e.target.value }))} placeholder="5" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Applicable dès</Label>
                  <Input type="date" value={ruleForm.applies_from} onChange={(e) => setRuleForm((f) => ({ ...f, applies_from: e.target.value }))} />
                </div>
              </div>
              <Button onClick={addRule} disabled={saving || !ruleForm.user_id || !ruleForm.rate} className="gap-1.5 w-full">
                <Plus className="h-4 w-4" /> Ajouter la règle
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
