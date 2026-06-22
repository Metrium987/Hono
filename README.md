# Hono ERP

**ERP cloud-native pour les entreprises de Polynésie française.**

Hono est une plateforme de gestion d'entreprise complète (facturation, CRM, catalogue, portail client, finance) construite sur Next.js 16 et Supabase. Elle intègre nativement un serveur **Model Context Protocol (MCP)** qui donne à n'importe quel assistant IA un accès sécurisé et filtré par permissions à toutes vos données métier.

Déployée sur [Vercel](https://hono-self-nu.vercel.app/).

---

## Pourquoi Hono ?

| | Hono | ERP traditionnel |
|---|---|---|
| **Stack** | Next.js 16 + Supabase (serverless) | PHP / Python / Java monolithe |
| **Déploiement** | `vercel deploy` — sans serveur | Serveur dédié + sysadmin |
| **IA native** | MCP server, 14 outils, filtrage RBAC | Plugin bolté ou absent |
| **Auth** | Session staff + magic link portail + API keys | Authentification unique |
| **Recherche** | ILIKE + pgvector (embeddings Google AI) | SQL LIKE basique |
| **PDF** | react-pdf server-side, conformité PF | Outil séparé |
| **Multi-tenant** | RLS Supabase par team_id au niveau base | Table-par-tenant ou schéma complexe |
| **i18n** | next-intl, zéro string en dur | Souvent anglais uniquement |

---

## Fonctionnalités

### Commerce & Facturation

- **Factures** — Lignes dynamiques, sélection TVA, totaux HT/TTC live, PDF, envoi email (Resend), statuts automatiques (brouillon → envoyée → payée / partielle / en retard)
- **Devis** — Création, envoi email, acceptation, conversion en facture, date de validité, PDF
- **Avoirs** — Workflow complet avec restauration de stock
- **Paiements** — Enregistrement manuel, Stripe Checkout, email de confirmation, déclenchement statut automatique
- **Factures récurrentes** — Templates avec fréquence (hebdo, mensuel, trimestriel, annuel), génération automatique Vercel Cron (06h Tahiti)
- **Relances automatiques** — Cron quotidien (08h Tahiti) sur factures en retard, cooldown 14 jours, historique
- **Numérotation séquentielle** — RPC `generate_next_invoice_number`, conforme aux obligations légales PF
- **Journal des événements** — Audit trail complet (envoi, paiement, relance…)

### CRM & Clients

- **Pipeline CRM** — Kanban drag-and-drop (`@dnd-kit`), statuts configurables, attribution staff, notes Tiptap
- **Clients** — Fiche complète (N° Tahiti, B2B/B2C, portail activé), historique factures/devis, notes CRM
- **Relances** — Planification et suivi des relances par client
- **Agenda** — Calendrier des événements par groupe de staff, filtre client

### Catalogue & Promotions

- **Produits** — Multi-catégories, traductions multilingues, suivi stock, alertes seuil, prix de revient + marge live, embedding sémantique auto (création et modification)
- **Catégories** — Arbre hiérarchique avec slug
- **Promotions** — Remises par client, produit ou segment, dates de validité

### Finance & Reporting

- **Trésorerie** — Flux entrants/sortants, solde courant
- **Livre de recettes** — Registre légal des encaissements
- **Dépenses** — Catégorisées, liées aux fournisseurs, pièces jointes
- **Revenus annexes** — Revenus hors-factures
- **Rapports** — P&L, TVA par taux, relevé client
- **Seuil de rentabilité** — Calcul automatique du point mort
- **Performance équipe** — Commissions commerciales, règles de commission configurables

### Portail client

- **Catalogue public** — Listing produits, filtre catégorie, prix TTC (obligation DGAE)
- **Panier** — Quantités, totaux, persistance localStorage
- **Checkout** — Formulaire contact → génération devis automatique
- **Portal B2B** — Magic link auth, tableau de bord, historique devis/factures/commandes/avoirs

### Admin & Paramétrage

- **RBAC** — Rôles + permissions JSONB granulaires par module (read/write), propriétaire bypass total
- **Groupes de staff** — Organisation des collaborateurs avec couleur d'affichage
- **Invitations** — Envoi par email (token 7 jours), page d'acceptation, vérification email/membre existant
- **Clés API** — Création, révocation, permissions scopées
- **Taux de TVA** — Configuration par équipe (16%, 13%, 5%, 1%, 0%)
- **Devises** — Multi-devises avec taux de change
- **Moyens de paiement** — Espèces, chèque, virement, CB + Stripe, PayPal
- **Mode éducatif** — Workflow de demande de suppression avec approbation propriétaire

### IA & MCP

Le serveur MCP (`/api/mcp`) expose **14 outils** filtrés dynamiquement selon les permissions du porteur de clé API :

| Outil | Module |
|-------|--------|
| `list_products` / `get_product` | Catalogue |
| `list_customers` / `get_customer` | CRM |
| `list_quotes` / `get_quote` / `create_quote` / `convert_quote_to_invoice` | Devis |
| `list_invoices` / `get_invoice` / `record_payment` | Facturation |
| `list_orders` / `update_order_status` | Commandes |
| `get_dashboard_summary` | Reporting |

Authentification via `Authorization: Bearer <api_key>`. Chaque outil n'est exposé que si la clé possède la permission correspondante.

---

## Conformité Polynésie française

| Règle | Implémentation |
|-------|----------------|
| Numérotation séquentielle | RPC `generate_next_invoice_number` — jamais assigné manuellement |
| Immuabilité | Après draft, numéro et lignes verrouillés |
| Soft-delete | `deleted_at` sur les factures — conservation 10 ans, jamais de hard-delete |
| N° TAHITI | Affiché vendeur + acheteur sur toutes les factures B2B |
| Franchise en base | Masquage TVA + mention légale sur les PDFs si `is_franchise_en_base` |
| TVA 2026 | 16% standard / 13% services / 5% essentiels / 1% archipels éloignés / 0% exonéré |
| Majoration retard | 5 000 F CFP (paramètres équipe) |
| Prix TTC storefront | Obligatoire en B2C (règlement DGAE) |
| Fuseau horaire DB | Pacific/Tahiti |

---

## Architecture

```
src/
├── app/
│   ├── [locale]/
│   │   ├── (erp)/          # Back-office staff (sidebar layout)
│   │   ├── (storefront)/   # Catalogue public + portail client
│   │   └── login/          # Auth unifiée staff + client
│   └── api/
│       ├── v1/             # 60+ endpoints REST (withAuth + requirePermission)
│       ├── cron/           # auto-remind + generate-recurring
│       └── mcp/            # Serveur MCP
├── components/
│   ├── ui/                 # shadcn/ui
│   └── erp/                # Composants métier
├── lib/
│   ├── auth/               # withAuth(), requirePermission()
│   ├── email/              # Templates React Email (Resend)
│   ├── pdf/                # react-pdf templates
│   └── embeddings.ts       # Google AI text-embedding-004 (768 dims)
└── locales/
    └── fr.json             # Seule locale active (ty/mq préparées)
```

Toutes les routes API sont protégées par `withAuth()` qui valide :
1. La session Supabase **ou** un Bearer API key hashé
2. Le `team_id` query param et l'appartenance du caller
3. Les permissions RBAC via `requirePermission()`

Le middleware gère dans l'ordre : refresh session → routing i18n → headers de sécurité. Les routes `/api/*` sont exclues du matcher i18n.

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Langage | TypeScript strict |
| UI | Tailwind CSS 4 + shadcn/ui + Lucide Icons |
| Base de données | Supabase (PostgreSQL + pgvector + pg_trgm) |
| Auth | Supabase Auth SSR + magic link + API keys hachées |
| Paiements | Stripe Checkout + enregistrement local |
| Email | Resend + React Email |
| PDF | @react-pdf/renderer |
| Protocole IA | Model Context Protocol (MCP) |
| Embeddings | Google AI text-embedding-004 (768 dimensions) |
| Drag & Drop | @dnd-kit (Kanban CRM) |
| Graphiques | Recharts (BarChart CA, AreaChart sparklines) |
| Éditeur rich text | Tiptap |
| Tables | TanStack Table v8 + export CSV |
| Calendrier | Schedule-X |
| Formulaires | react-hook-form + Zod |
| Déploiement | Vercel (Edge Middleware + Serverless + Cron) |

---

## Démarrage rapide

```bash
git clone <repo>
cd hono
cp .env.example .env.local
npm install
npx supabase db push    # Appliquer les 35 migrations
npm run dev             # localhost:3000
```

**Variables critiques :**

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # Server-only, jamais NEXT_PUBLIC_
PORTAL_COOKIE_SECRET=            # 64 chars hex  →  openssl rand -hex 32
NEXT_PUBLIC_DEFAULT_TEAM_ID=     # UUID équipe recevant les demandes storefront
RESEND_API_KEY=
RESEND_FROM_EMAIL=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
GOOGLE_AI_API_KEY=               # Embeddings produits/clients
CRON_SECRET=                     # Sécurise /api/cron/*
```

**Commandes :**

```bash
npm run dev                            # Dev server
npm run build                          # Build production
npm run lint                           # ESLint
npx supabase migration new <nom>      # Nouvelle migration
npx supabase db push                  # Pousser les migrations
```

---

## Base de données

35 migrations séquentielles (`supabase/migrations/00001_` → `00035_`).
Extensions : `uuid-ossp`, `vector` (pgvector), `pg_trgm`, `pgcrypto`.
Toutes les tables métier ont un `team_id` et des policies RLS scopées.
Un hook JWT custom injecte `team_id`, `role_name`, `is_owner` et `permissions` dans le token d'accès.

---

*Conçu pour la Polynésie française. Architecturé pour passer à l'échelle.*
