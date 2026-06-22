import { ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type ForbiddenPageProps = {
  module: string;
  action?: "read" | "write";
};

const MODULE_LABELS: Record<string, string> = {
  catalog: "le catalogue",
  clients: "les clients",
  quotes: "les devis",
  invoices: "les factures",
  orders: "les commandes",
  expenses: "les dépenses",
  income: "les revenus",
  reports: "les rapports",
  currencies: "les devises",
  taxes: "les taux de TVA",
  payments: "les moyens de paiement",
  settings: "les paramètres",
};

const ACTION_LABELS: Record<string, string> = {
  read: "consulter",
  write: "modifier",
};

export function ForbiddenPage({ module, action = "read" }: ForbiddenPageProps) {
  const moduleLabel = MODULE_LABELS[module] ?? `le module "${module}"`;
  const actionLabel = ACTION_LABELS[action] ?? action;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-xl">Accès refusé</CardTitle>
          <CardDescription className="text-base">
            Vous n&apos;avez pas l&apos;autorisation de {actionLabel} {moduleLabel}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Contactez le propriétaire du compte si vous avez besoin d&apos;accéder à cette section.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
