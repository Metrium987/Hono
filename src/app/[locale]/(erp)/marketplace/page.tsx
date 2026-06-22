"use client";

import { useState, useEffect } from "react";
import { Store, Loader2 } from "lucide-react";
import { useClientPermission } from "@/hooks/use-client-permission";
import { ClientForbiddenPage } from "@/components/erp/client-forbidden";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Account = {
  id: string;
  platform: string;
  account_name: string;
  platform_user_id: string | null;
  is_active: boolean;
  token_expires_at: string | null;
  created_at: string;
};

type Listing = {
  id: string;
  title: string;
  price: number;
  status: string;
  platform_item_id: string;
  permalink: string | null;
  created_at: string;
  product: { id: string; name: string; sku: string } | null;
  account: { id: string; platform: string; account_name: string } | null;
};

export default function MarketplacePage() {
  const perm = useClientPermission("marketplace", "read");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!perm.teamId) return;
      try {
        const [accRes, lstRes] = await Promise.all([
          fetch(`/api/v1/marketplace/accounts?team_id=${perm.teamId}`),
          fetch(`/api/v1/marketplace/listings?team_id=${perm.teamId}`),
        ]);
        setAccounts((await accRes.json()).data ?? []);
        setListings((await lstRes.json()).data ?? []);
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [perm.teamId]);

  if (perm.loading || loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!perm.allowed) return <ClientForbiddenPage module="marketplace" />;

  function formatCurrency(amount: number) {
    return `${amount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} F`;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Store className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketplace</h1>
          <p className="text-sm text-muted-foreground">
            {accounts.length} compte(s) · {listings.length} annonce(s)
          </p>
        </div>
      </div>

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">Comptes ({accounts.length})</TabsTrigger>
          <TabsTrigger value="listings">Annonces ({listings.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-4">
          {accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Store className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium">Aucun compte connecté</p>
              <p className="text-sm mt-1">Connectez vos comptes marketplace depuis les paramètres.</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Plateforme</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Nom du compte</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Utilisateur</th>
                    <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Actif</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Expire le</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {accounts.map((a) => (
                    <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{a.platform}</td>
                      <td className="px-4 py-3">{a.account_name}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{a.platform_user_id ?? "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={a.is_active ? "success" : "secondary"}>
                          {a.is_active ? "Oui" : "Non"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        {a.token_expires_at ? new Date(a.token_expires_at).toLocaleDateString("fr-FR") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="listings" className="mt-4">
          {listings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Store className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium">Aucune annonce</p>
              <p className="text-sm mt-1">Créez des annonces depuis la fiche produit.</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Titre</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Produit</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Plateforme</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Prix</th>
                    <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {listings.map((l) => (
                    <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{l.title}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{l.product?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-xs">{l.account?.platform ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(l.price)}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={l.status === "active" ? "success" : "secondary"}>
                          {l.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
