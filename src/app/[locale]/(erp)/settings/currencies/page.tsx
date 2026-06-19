"use client";

import { useState, useEffect } from "react";
import { Loader2, Check, X, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

type Currency = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  exchange_rate_to_xpf: number | null;
  is_default: boolean;
  is_active: boolean;
};

export default function CurrenciesPage() {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { createClient } = await import("@/utils/supabase/client");
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: memberships } = await supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", user.id)
          .limit(1);
        const tid = memberships?.[0]?.team_id ?? "";

        if (tid) {
          const res = await fetch(`/api/v1/currencies?team_id=${tid}`);
          const body = await res.json();
          setCurrencies(body.data ?? []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="../settings"><ChevronLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Devises</h1>
          <p className="text-sm text-muted-foreground">{currencies.length} devise{currencies.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="space-y-2">
        {currencies.length === 0 ? (
          <Card><CardContent className="text-center py-8 text-muted-foreground text-sm">Aucune devise configurée</CardContent></Card>
        ) : (
          currencies.map((cur) => (
            <Card key={cur.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-medium text-sm">
                      <span className="text-lg mr-1">{cur.symbol}</span>
                      {cur.code} — {cur.name}
                    </p>
                    {cur.exchange_rate_to_xpf != null && (
                      <p className="text-xs text-muted-foreground">1 XPF = {cur.exchange_rate_to_xpf} {cur.code}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {cur.is_default && <Badge className="text-[10px]">Par défaut</Badge>}
                    {cur.is_active ? <Badge variant="success" className="text-[10px]">Actif</Badge> : <Badge variant="secondary" className="text-[10px]">Inactif</Badge>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
