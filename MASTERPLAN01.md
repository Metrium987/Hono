# MASTERPLAN01 — Hono ERP : Complétion & Solidification

> **Date** : 2026-06-22  
> **État** : ~75% viable production  
> **Objectif** : Base 100% solide avant toute intégration externe

---

## État actuel — Ce qui fonctionne

| Module | État |
|---|---|
| Auth / RBAC / API keys | ✅ Complet |
| Dashboard KPIs (CA, impayés, stock, top clients) | ✅ Complet |
| CRM / Clients / Fournisseurs | ✅ Complet |
| Devis (CRUD, PDF, email, approbation) | ✅ Complet |
| Factures (CRUD, PDF, email, paiements, AR) | ✅ Complet |
| Commandes + Bons de livraison | ✅ Complet (totaux ajoutés) |
| Dépenses + Revenus | ✅ Complet |
| Produits / Catalogue / Stock | ✅ Complet |
| Inventaire / Inventaires physiques | ✅ Complet |
| Rapports (P&L, TVA, AR aging, relevé client) | ✅ Complet |
| Trésorerie / Seuil de rentabilité | ✅ Complet |
| Livre de recettes | ✅ Complet |
| Relances manuelles (dunning UI) | ✅ Complet |
| Factures récurrentes | ✅ Complet |
| Avoirs | ✅ Complet |
| Commissions vendeur | ✅ Complet |
| Règles tarifaires (RPC) | ✅ Complet |
| Alertes / Approbations | ✅ Complet |
| Calendrier | ✅ Complet |
| MCP tools (60+ outils assistant) | ✅ Complet |
| Calculs financiers (arrondis, TVA, franchise) | ✅ Corrigé |
| Schéma SQL cohérent (00001→00047) | ✅ Vérifié |

---

## PHASE 1 — Cron jobs & automatismes (P0 · 1 jour)

### 1.1 Activer l'Edge Function auto-remind

**Fichier créé** : `supabase/functions/auto-remind/index.ts`

Ce que fait la fonction (déjà écrite) :
- Marque les factures `sent`/`partial` dépassant `due_date` → `overdue`
- Marque les devis `draft`/`sent` dépassant `validity_date` → `expired`
- Crée des alertes `system_alerts` pour chaque transition

**Action manuelle requise dans Supabase Dashboard** :
1. `Database → Extensions` → activer `pg_cron` et `pg_net`
2. `SQL Editor` → exécuter :
```sql
SELECT cron.schedule(
  'auto-remind-daily',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ttjpaggocubxsgekxtzu.supabase.co/functions/v1/auto-remind',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SUPABASE_SERVICE_ROLE_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  )
  $$
);
```
3. Déployer la fonction : `npx supabase functions deploy auto-remind`

### 1.2 Cron factures récurrentes

Les factures récurrentes ont une `next_date` mais aucun mécanisme ne les génère automatiquement.

**À créer** : `supabase/functions/recurring-billing/index.ts`

Logique :
```
SELECT * FROM recurring_invoices WHERE next_date <= today AND status = 'active'
→ Pour chaque : appeler POST /api/v1/invoices (copie du template)
→ Calculer next_date selon frequency
→ UPDATE recurring_invoices SET next_date = ...
```

**Cron** : même horaire que auto-remind, fonction séparée.

---

## PHASE 2 — Exports comptables (P0 · 1 jour)

Les experts-comptables en PF demandent systématiquement des exports. Aucun export CSV/Excel n'existe.

### 2.1 Export CSV factures

**Route à créer** : `GET /api/v1/invoices?format=csv`

Colonnes : `invoice_number, issue_date, due_date, customer_name, n_tahiti, subtotal_ht, tax_amount, total_ttc, paid_amount, status`

```typescript
// Dans invoices/route.ts, ajouter après la requête :
const format = params.get("format");
if (format === "csv") {
  const csv = [header, ...rows.map(toCsvRow)].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="factures-${dateFrom}-${dateTo}.csv"`,
    },
  });
}
```

### 2.2 Export CSV dépenses

**Route** : `GET /api/v1/expenses?format=csv`

Colonnes : `expense_date, description, vendor_name, category, amount, currency`

### 2.3 Export Livre de recettes (PDF)

La page `revenue-book` existe. Ajouter un bouton "Exporter PDF" qui appelle une route dédiée ou réutilise `@react-pdf/renderer`.

---

## PHASE 3 — Portail client (P1 · 2 jours)

Le portail storefront `/portal/` a les pages suivantes confirmées :
- `auth/` — connexion
- `dashboard/` — tableau de bord client
- `invoices/` — liste des factures
- `invoices/[id]/pdf` — PDF facture
- `orders/` — commandes
- `quotes/` — devis
- `credit-notes/` — avoirs
- `verify/` — vérification email

**Gaps potentiels à vérifier** :
- [ ] Le client peut-il **accepter ou rejeter** un devis depuis le portail ?
- [ ] Le client peut-il **payer en ligne** (lien Stripe ou virement) ?
- [ ] Les **bons de livraison** sont-ils visibles dans le portail ?
- [ ] La page `dashboard` portal affiche-t-elle les données réelles ?

**Action** : lire `src/app/[locale]/(storefront)/portal/` pour auditer chaque page.

---

## PHASE 4 — Corrections mineures restantes (P1 · 0.5 jour)

### 4.1 order_items.line_total_ht dans invoice génération

Quand on génère une facture depuis une commande (`POST /api/v1/orders/[id]/invoice`), les `line_total_ht` des order_items sont maintenant disponibles. Utiliser ces valeurs directement plutôt que de recalculer.

**Fichier** : `src/app/api/v1/orders/[id]/invoice/route.ts`

### 4.2 MCP tool create_order — totaux

Le MCP `create_order` n'envoie pas `currency_id`. Mettre à jour pour qu'il accepte ce paramètre et envoie les `line_total_ht`.

**Fichier** : `src/lib/mcp/tools.ts` → `create_order`

### 4.3 Trigger overdue → alerte système

Le trigger `fn_alert_ar_overdue` dans `00044` insert dans `alerts` (ancienne table). Vérifier qu'il utilise bien `system_alerts`.

**Migration corrective** : `00048_fix_alert_trigger.sql`

```sql
CREATE OR REPLACE FUNCTION public.fn_alert_ar_overdue()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'overdue' AND OLD.status != 'overdue' THEN
    INSERT INTO public.system_alerts(team_id, alert_type, severity, title, message, entity_type, entity_id)
    VALUES (NEW.team_id, 'ar_overdue', 'warning',
            'Compte client en retard',
            'Un compte client est passé en statut impayé.',
            'account_receivable', NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
```

### 4.4 team-performance — données commissions réelles

La page `team-performance` charge les commissions depuis `invoice_commissions`. Vérifier que la jointure `staff_id → auth.users` fonctionne avec `createAdminClient()`.

---

## PHASE 5 — Relances automatiques email (P1 · 1 jour)

La page `/reminders` montre les factures en retard avec le niveau de relance (amiable → ferme → mise en demeure). La logique est calculée côté client.

**Ce qui manque** : l'envoi email réel depuis l'interface.

**Route à créer** : `POST /api/v1/invoices/[id]/remind`

La route existe déjà (`src/app/api/v1/invoices/[id]/remind/route.ts`). Vérifier qu'elle :
- Utilise le bon template email selon le niveau (1/2/3)
- Insère dans `invoice_reminders`
- Met à jour `invoice.status` si nécessaire

**Action** : lire la route et vérifier qu'elle est branchée au bouton dans `reminders-client.tsx`.

---

## PHASE 6 — Images produits (P2 · 0.5 jour)

La route `POST /api/v1/products/[id]/image` existe. Vérifier que :
- Le formulaire `catalog/[id]/edit` a un input file
- L'upload va dans Supabase Storage bucket `product-images`
- L'URL est sauvegardée dans `products.image_url`

---

## PHASE 7 — Notifications push (P2 · 1 jour)

Les routes `/api/v1/notifications/routing/` existent. Vérifier la connexion :
- `notification_routing` table → règles par type d'événement
- Lors d'une alerte créée → email envoyé via Resend si la règle l'indique
- Lors d'un paiement reçu → notification en temps réel (Supabase Realtime ?)

---

## PHASE 8 — Supabase db push (IMMÉDIAT)

Les migrations suivantes n'ont pas encore été appliquées en production :

```bash
npx supabase db push
```

Migrations en attente :
- `00043_stock_approvals_triggers.sql` — triggers stock + approbations
- `00044_alerts_triggers.sql` — triggers alertes
- `00045_pricing_rules_apply.sql` — RPC règles tarifaires
- `00046_vendor_commissions_auto.sql` — trigger commissions auto
- `00047_orders_totals.sql` — totaux commandes (**nouveau**)

---

## INTÉGRATIONS FINALES (après base solide)

> Ne pas implémenter avant que les Phases 1-8 soient terminées et testées en production.

### INT-1 — Stripe (SaaS billing Hono)

Permettre de facturer les clients de Hono pour l'abonnement ERP.

**Prérequis** : compte Stripe, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

**Routes déjà présentes** :
- `src/app/api/v1/stripe/create-checkout-session/route.ts`
- `src/app/api/v1/stripe/webhook/route.ts`

**À connecter** :
- Page pricing/abonnements
- Table `subscriptions` liée à `teams`
- Gate accès ERP si abonnement inactif
- Webhooks : `checkout.session.completed`, `invoice.payment_failed`

### INT-2 — Resend (emails transactionnels)

Déjà partiellement branché (`src/lib/email/resend.ts`). Compléter :
- Template relance niveau 1/2/3 (dunning)
- Template bienvenue nouveau membre équipe
- Template devis expiré (avertissement)

**Variable** : `RESEND_API_KEY` dans Vercel env

### INT-3 — Google AI Embeddings (recherche sémantique)

Extension `vector` et `text-embedding-004` déjà configurés (`00003_vector_768.sql`).

**À connecter** :
- Générer embeddings à la création de produit/client/facture
- Route `POST /api/v1/ai/embeddings` appelle l'API Google AI
- Recherche sémantique dans la route `GET /api/v1/search`

### INT-4 — Marketplace (P3)

La page `/marketplace` et les routes `/api/v1/marketplace/` existent. C'est un catalogue B2B entre équipes Hono.

**Dépend de** : INT-1 (un compte Stripe actif = accès marketplace)

### INT-5 — Paiement en ligne portail client

Permettre au client de payer une facture directement depuis le portail.

**Options** :
- Stripe Payment Link (le plus simple)
- Stripe Checkout intégré dans le portail

**Dépend de** : INT-1 + Phase 3 (portail complet)

---

## Checklist de validation production

Avant de considérer le projet prêt pour un premier client réel :

- [ ] `npx supabase db push` — toutes migrations appliquées
- [ ] `npx supabase functions deploy auto-remind` — Edge Function déployée
- [ ] Cron activé dans Supabase Dashboard
- [ ] `RESEND_API_KEY` configuré dans Vercel
- [ ] Test création facture → PDF généré → email envoyé → paiement → status "paid"
- [ ] Test devis → envoi → acceptation → conversion facture
- [ ] Test franchise en base → TVA = 0 sur PDF
- [ ] Test export CSV dépenses
- [ ] Test relance manuelle depuis `/reminders`
- [ ] Test portail client (connexion → voir factures → télécharger PDF)

---

*Généré le 2026-06-22 — MASTERPLAN01*
