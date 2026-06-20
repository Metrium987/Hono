# Hono ERP — User Creation & RBAC System

> **Purpose:** This document captures the complete RBAC (Role-Based Access Control) architecture, user creation flows, permission model, and enforcement layers. Used as a reference for future development and debugging.
>
> **Last verified:** 2026-06-19 — 72/72 tests passing (`node scripts/test-auth.mjs`)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema](#2-database-schema)
3. [Default Roles & Permissions](#3-default-roles--permissions)
4. [Permission Module Map](#4-permission-module-map)
5. [User Creation Flows](#5-user-creation-flows)
6. [Enforcement Layers](#6-enforcement-layers)
7. [API Route Permission Map](#7-api-route-permission-map)
8. [Known RLS Recursion Fix (SECURITY DEFINER)](#8-known-rls-recursion-fix-security-definer)
9. [Test Users](#9-test-users)
10. [Migration Reference](#10-migration-reference)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   AUTH SYSTEM                         │
│                   ┌──────────┐                       │
│                   │  Client   │ (storefront/magic link│
│                   │  Portal   │  → portal_users)     │
│                   └────┬─────┘                       │
│                        │ no team_members entry       │
│                        ▼                             │
│              portal_users.customer_id                 │
│              RLS sees to own documents                │
│                                                       │
│                   ┌──────────┐                       │
│                   │  ERP User │ (password session    │
│                   │ (back-office) │ → team_members)  │
│                   └────┬─────┘                       │
│                        │                             │
│                        ▼                             │
│              team_members → team_roles                │
│              JSONB permissions checked server-side    │
│                                                       │
│                   ┌──────────┐                       │
│                   │ API Keys │ (Bearer token →       │
│                   │ (AI/MCP) │  verify_api_key RPC)  │
│                   └──────────┘                       │
└─────────────────────────────────────────────────────┘
```

Two auth systems are **completely separate**:
- **Portal (Client)**: Magic link auth → `portal_users`. No `team_members` entry. RLS restricts to own `customer_id`.
- **ERP**: Password auth → `team_members` with explicit role. Access via server-side `requirePermission()`.
- **API Key**: Bearer token → `verify_api_key` RPC (SECURITY DEFINER) → inherits role permissions.

---

## 2. Database Schema

### `teams` — Business entities

```sql
CREATE TABLE public.teams (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  email               TEXT, phone TEXT,
  address_line1       TEXT, address_line2 TEXT,
  city TEXT, island TEXT, postal_code TEXT,
  country             TEXT DEFAULT 'French Polynesia',
  n_tahiti            TEXT UNIQUE,           -- PF business registration
  rcs_number          TEXT,
  tax_id              TEXT,
  is_franchise_en_base BOOLEAN DEFAULT FALSE,
  logo_url            TEXT,
  website             TEXT,
  default_currency_id UUID,
  invoice_prefix      TEXT DEFAULT 'FAC-',
  quote_prefix        TEXT DEFAULT 'DEV-',
  late_fee_fixed      NUMERIC(10,2) DEFAULT 5000,
  bank_name           TEXT, bank_rib TEXT, bank_iban TEXT, bank_bic TEXT,
  timezone            TEXT DEFAULT 'Pacific/Tahiti',
  is_educational_mode BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
```

### `team_roles` — Granular JSONB permissions

```sql
CREATE TABLE public.team_roles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  permissions   JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(team_id, name)
);
```

**`permissions` JSONB structure:**
```json
{
  "catalog": ["read", "write"],
  "clients": ["read"],
  "quotes": ["read", "write"],
  "invoices": ["read"],
  "orders": ["read"],
  "expenses": [],
  "income": [],
  "reports": [],
  "currencies": [],
  "taxes": [],
  "payments": [],
  "settings": []
}
```

Possible values per array: `["read"]`, `["read", "write"]`, or `[]` (no access).

### `team_members` — User-to-team membership

```sql
CREATE TABLE public.team_members (
  team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id       UUID REFERENCES public.team_roles(id) ON DELETE SET NULL,
  is_owner      BOOLEAN DEFAULT FALSE,
  invited_by    UUID REFERENCES public.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (team_id, user_id)
);
```

- `is_owner = TRUE` → **bypasses all permission checks** (Admin/Owner role)
- `is_owner = FALSE` → permissions come from the linked `team_roles.permissions`

### `api_keys` — For AI/MCP controllability

```sql
CREATE TABLE public.api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  role_id       UUID NOT NULL REFERENCES public.team_roles(id) ON DELETE RESTRICT,
  key_prefix    TEXT NOT NULL,        -- e.g. "hk_a1b2c3"
  key_hash      TEXT NOT NULL UNIQUE, -- SHA256 of the raw key
  name          TEXT NOT NULL,
  description   TEXT,
  expires_at    TIMESTAMPTZ,
  last_used_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

- Key format: `hk_` + 48 hex chars (34 chars total)
- API keys are tied to a `role_id` and inherit that role's permissions
- Verification via `verify_api_key(p_token_hash)` RPC (SECURITY DEFINER)

### `portal_users` — Client portal accounts

```sql
CREATE TABLE public.portal_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  email         TEXT UNIQUE NOT NULL,
  magic_link_only BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

---

## 3. Default Roles & Permissions

These roles are created via onboarding/UI. The actual JSONB values below are from the live DB (team `285eaab4`), verified by `scripts/test-auth.mjs`.

### Owner (`is_owner = true`)

| Property | Value |
|---|---|
| System | `team_members` with `is_owner = TRUE` |
| Description | Full access to everything |
| Access | All ERP modules — read AND write |
| Bypass | `hasPermission()` returns `true` for all modules + actions |

### Manager

| Module | Read | Write |
|---|---|---|
| catalog | ✅ | ✅ |
| clients | ✅ | ✅ |
| quotes | ✅ | ✅ |
| invoices | ✅ | ✅ |
| orders | ✅ | ✅ |
| expenses | ✅ | ✅ |
| income | ❌ | ❌ |
| reports | ✅ | ❌ |
| currencies | ✅ | ❌ |
| taxes | ✅ | ❌ |
| payments | ✅ | ❌ |
| settings | ❌ | ❌ |

**Permissions JSONB (live):**
```json
{
  "catalog": ["read", "write"],
  "clients": ["read", "write"],
  "quotes": ["read", "write"],
  "invoices": ["read", "write"],
  "orders": ["read", "write"],
  "expenses": ["read", "write"],
  "income": [],
  "reports": ["read"],
  "currencies": ["read"],
  "taxes": ["read"],
  "payments": ["read"],
  "settings": []
}
```

### Salesperson

| Module | Read | Write |
|---|---|---|
| catalog | ✅ | ✅ |
| clients | ✅ | ❌ |
| quotes | ✅ | ✅ |
| invoices | ✅ | ❌ |
| orders | ✅ | ❌ |
| expenses | ❌ | ❌ |
| income | ❌ | ❌ |
| reports | ❌ | ❌ |
| currencies | ❌ | ❌ |
| taxes | ❌ | ❌ |
| payments | ❌ | ❌ |
| settings | ❌ | ❌ |

**Permissions JSONB (live):**
```json
{
  "catalog": ["read", "write"],
  "clients": ["read"],
  "quotes": ["read", "write"],
  "invoices": ["read"],
  "orders": ["read"],
  "expenses": [],
  "income": [],
  "reports": [],
  "currencies": [],
  "taxes": [],
  "payments": [],
  "settings": []
}
```

### Accountant

| Module | Read | Write |
|---|---|---|
| catalog | ❌ | ❌ |
| clients | ❌ | ❌ |
| quotes | ❌ | ❌ |
| invoices | ✅ | ✅ |
| orders | ❌ | ❌ |
| expenses | ✅ | ✅ |
| income | ✅ | ✅ |
| reports | ✅ | ❌ |
| currencies | ❌ | ❌ |
| taxes | ✅ | ❌ |
| payments | ✅ | ✅ |
| settings | ❌ | ❌ |

**Permissions JSONB (live):**
```json
{
  "catalog": [],
  "clients": [],
  "quotes": [],
  "invoices": ["read", "write"],
  "orders": [],
  "expenses": ["read", "write"],
  "income": ["read", "write"],
  "reports": ["read"],
  "currencies": [],
  "taxes": ["read"],
  "payments": ["read", "write"],
  "settings": []
}
```

### Client (Portal)

| Property | Value |
|---|---|
| System | `portal_users` (no `team_members` entry) |
| Auth | Magic link only |
| Access | Own documents only via `customer_id` RLS |
| ERP routes | Blocked by RLS (no team membership) |

---

## 4. Permission Module Map

```typescript
export type PermissionModule =
  | "catalog"     // products, categories, inventory
  | "clients"     // customers, vendors
  | "quotes"      // quotes, convert
  | "invoices"    // invoices, payments, send, credit-notes
  | "orders"      // orders
  | "expenses"    // expenses, expense-categories
  | "income"      // income, income-categories
  | "reports"     // reports
  | "currencies"  // currencies
  | "taxes"       // tax rates
  | "payments"    // payment methods
  | "settings";   // company, api-keys, invitations
```

Each module supports two actions:
- `"read"` — GET endpoints
- `"write"` — POST, PATCH, DELETE endpoints

---

## 5. User Creation Flows

### Flow A: Portal Signup (Storefront)

```
User registers via storefront
    │
    ▼
Supabase Auth creates auth.users
    │
    ▼
Trigger → handle_new_user() creates public.users row
    │
    ▼
portal_users row created (linked to customer_id)
    │
    ▼
NO team_members entry created
    │
    ▼
User has Client role — only own documents
```

### Flow B: ERP Invite (Admin)

```
Admin creates invitation via company_invitations
    │
    ▼
Email sent with token link
    │
    ▼
User accepts → team_members row created
    │
    ▼
User assigned explicit role (manager/salesperson/accountant)
    │
    ▼
Full ERP access based on role permissions
```

### Flow C: Direct Admin Creation

```
Admin/owner creates team member directly
    │
    ▼
INSERT INTO team_members (team_id, user_id, role_id, is_owner)
    │
    ▼
User linked to role → inherits permissions
```

---

## 6. Enforcement Layers

Four layers of permission enforcement:

### Layer 1: Database RLS

Every table has RLS policies that check team membership via `get_teams_for_authenticated_user()` (SECURITY DEFINER):

```sql
CREATE POLICY "Team scoped products"
  ON public.products FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));
```

Additional RLS for owners-only operations via `is_team_owner()` (SECURITY DEFINER):

```sql
CREATE POLICY "Team owners can manage API keys"
  ON public.api_keys FOR ALL
  USING (public.is_team_owner(team_id));
```

### Layer 2: Server-Side `requirePermission()`

Every API route handler calls `requirePermission(auth, module, action)` as the first line inside the `withAuth` callback:

```typescript
export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "catalog", "read");
    // ... handler logic
  });
}
```

**Implementation** (`src/lib/auth/api-auth.ts`):
```typescript
export function requirePermission(
  auth: AuthContext,
  module: string,
  action: "read" | "write"
): void {
  if (!hasPermission(auth, module, action)) {
    throw new AuthError("Forbidden: you do not have permission on " + module, 403);
  }
}

export function hasPermission(
  auth: AuthContext,
  module: string,
  action: "read" | "write"
): boolean {
  if (auth.isOwner) return true;          // Owners bypass everything
  if (!auth.permissions) return false;    // No permissions = no access
  const perms = auth.permissions[module];
  return Array.isArray(perms) && perms.includes(action);
}
```

### Layer 3: UI Hiding (planned)

Future: Dynamic hiding of modules/buttons based on permissions. Check `auth.permissions` client-side.

### Layer 4: API Key Role Inheritance

API keys are tied to a `role_id`. When an API key authenticates, `verify_api_key()` RPC returns the role's permissions. The same `hasPermission()` checks apply.

---

## 7. API Route Permission Map

Every ERP API route is protected. Routes NOT listed below are portal routes (`/api/v1/portal/*`), Stripe webhooks, or AI endpoints.

| Route | HTTP Method | Permission Required |
|---|---|---|
| **Catalog** | | |
| `/api/v1/categories` | GET | `catalog` read |
| `/api/v1/categories` | POST | `catalog` write |
| `/api/v1/categories/[id]` | GET | `catalog` read |
| `/api/v1/categories/[id]` | PATCH | `catalog` write |
| `/api/v1/categories/[id]` | DELETE | `catalog` write |
| `/api/v1/products` | GET | `catalog` read |
| `/api/v1/products` | POST | `catalog` write |
| `/api/v1/products/[id]` | GET | `catalog` read |
| `/api/v1/products/[id]` | PATCH | `catalog` write |
| `/api/v1/products/[id]` | DELETE | `catalog` write |
| `/api/v1/inventory/adjust` | POST | `catalog` write |
| **Clients** | | |
| `/api/v1/customers` | GET | `clients` read |
| `/api/v1/customers` | POST | `clients` write |
| `/api/v1/customers/[id]` | GET | `clients` read |
| `/api/v1/customers/[id]` | PATCH | `clients` write |
| `/api/v1/customers/[id]` | DELETE | `clients` write |
| `/api/v1/vendors` | GET | `clients` read |
| `/api/v1/vendors/[id]` | PATCH | `clients` write |
| `/api/v1/vendors/[id]` | DELETE | `clients` write |
| **Quotes** | | |
| `/api/v1/quotes` | GET | `quotes` read |
| `/api/v1/quotes` | POST | `quotes` write |
| `/api/v1/quotes/[id]` | GET | `quotes` read |
| `/api/v1/quotes/[id]` | PATCH | `quotes` write |
| `/api/v1/quotes/[id]` | DELETE | `quotes` write |
| `/api/v1/quotes/[id]/convert` | POST | `quotes` write |
| **Invoices** | | |
| `/api/v1/invoices` | GET | `invoices` read |
| `/api/v1/invoices` | POST | `invoices` write |
| `/api/v1/invoices/[id]` | GET | `invoices` read |
| `/api/v1/invoices/[id]` | PATCH | `invoices` write |
| `/api/v1/invoices/[id]` | DELETE | `invoices` write |
| `/api/v1/invoices/[id]/payments` | GET | `invoices` read |
| `/api/v1/invoices/[id]/payments` | POST | `invoices` write |
| `/api/v1/invoices/[id]/send` | POST | `invoices` write |
| `/api/v1/credit-notes` | GET | `invoices` read |
| `/api/v1/credit-notes` | POST | `invoices` write |
| `/api/v1/credit-notes/[id]` | GET | `invoices` read |
| `/api/v1/credit-notes/[id]` | PATCH | `invoices` write |
| `/api/v1/credit-notes/[id]` | DELETE | `invoices` write |
| **Orders** | | |
| `/api/v1/orders` | GET | `orders` read |
| `/api/v1/orders` | POST | `orders` write |
| `/api/v1/orders/[id]` | GET | `orders` read |
| `/api/v1/orders/[id]` | PATCH | `orders` write |
| `/api/v1/orders/[id]` | DELETE | `orders` write |
| **Expenses** | | |
| `/api/v1/expenses` | GET | `expenses` read |
| `/api/v1/expenses` | POST | `expenses` write |
| `/api/v1/expenses/[id]` | GET | `expenses` read |
| `/api/v1/expenses/[id]` | PATCH | `expenses` write |
| `/api/v1/expenses/[id]` | DELETE | `expenses` write |
| `/api/v1/expense-categories` | GET | `expenses` read |
| `/api/v1/expense-categories` | POST | `expenses` write |
| `/api/v1/expense-categories/[id]` | DELETE | `expenses` write |
| **Income** | | |
| `/api/v1/income` | GET | `income` read |
| `/api/v1/income` | POST | `income` write |
| `/api/v1/income/[id]` | GET | `income` read |
| `/api/v1/income/[id]` | PATCH | `income` write |
| `/api/v1/income/[id]` | DELETE | `income` write |
| `/api/v1/income-categories` | GET | `income` read |
| `/api/v1/income-categories` | POST | `income` write |
| `/api/v1/income-categories/[id]` | DELETE | `income` write |
| **Reports** | | |
| `/api/v1/reports` | GET | `reports` read |
| **Settings** | | |
| `/api/v1/currencies` | GET | `currencies` read |
| `/api/v1/currencies` | POST | `currencies` write |
| `/api/v1/currencies` | PATCH | `currencies` write |
| `/api/v1/currencies` | DELETE | `currencies` write |
| `/api/v1/currencies/[id]` | PATCH/DELETE | `currencies` write |
| `/api/v1/settings/tax-rates` | GET | `taxes` read |
| `/api/v1/settings/tax-rates` | POST | `taxes` write |
| `/api/v1/settings/tax-rates` | PATCH/DELETE | `taxes` write |
| `/api/v1/settings/tax-rates/[id]` | PATCH/DELETE | `taxes` write |
| `/api/v1/settings/company` | GET | `settings` read |
| `/api/v1/settings/company` | PATCH | `settings` write |
| `/api/v1/settings/api-keys` | GET | `settings` read |
| `/api/v1/settings/api-keys` | POST | `settings` write |
| `/api/v1/settings/api-keys/[id]` | DELETE | `settings` write |
| `/api/v1/settings/payment-methods` | GET | `payments` read |
| `/api/v1/settings/payment-methods` | POST | `payments` write |
| `/api/v1/settings/payment-methods/[id]` | PATCH/DELETE | `payments` write |
| `/api/v1/invitations` | GET | `settings` read |
| `/api/v1/invitations` | POST | `settings` write |
| `/api/v1/invitations/[token]` | DELETE | `settings` write |

### Routes WITHOUT `requirePermission` (intentional)

| Route | Reason |
|---|---|
| `/api/v1/portal/*` | Client portal self-service — no ERP permissions |
| `/api/v1/stripe/*` | External webhook + checkout — no RBAC |
| `/api/v1/ai/embeddings` | Internal — catalog.write guards via route check |
| `/api/mcp` | MCP: auth via Bearer API key, tools registered conditionally |

---

## 8. Known RLS Recursion Fix (SECURITY DEFINER)

### Problem

When RLS policies on `team_members` query `team_members` (self-referencing), it causes infinite recursion:

```sql
-- ❌ This causes infinite recursion:
CREATE POLICY "Team owners can manage members"
  ON public.team_members FOR ALL
  USING (EXISTS (SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = team_members.team_id
    AND tm.user_id = auth.uid()
    AND tm.is_owner = TRUE));
```

### Solution

Three functions are defined as `SECURITY DEFINER` to bypass RLS:

1. **`get_teams_for_authenticated_user()`** — Returns team IDs for the current user (used by most RLS policies)
2. **`is_team_owner(p_team_id UUID)`** — Checks if current user is an owner
3. **`check_permission(p_user_id, p_team_id, p_module, p_action)`** — Granular permission check
4. **`verify_api_key(p_token_hash TEXT)`** — API key verification (migration 00007)

All defined in `supabase/migrations/00001_extensions_enums_rls.sql`:

```sql
CREATE OR REPLACE FUNCTION public.get_teams_for_authenticated_user()
RETURNS SETOF UUID LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT team_id FROM public.team_members
    WHERE user_id = (SELECT auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.is_team_owner(p_team_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id
      AND user_id = (SELECT auth.uid())
      AND is_owner = TRUE
  );
END;
$$;
```

### API Key Auth Bypass (service_role)

When authenticating via API key, subsequent data queries use the `service_role` key to bypass RLS entirely, since the API key was already verified by `verify_api_key()` (SECURITY DEFINER):

```typescript
// src/lib/auth/api-auth.ts
function createAdminClient() {
  return createServerClient(supabaseUrl, serviceRoleKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
```

**Required env var:** `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`

---

## 9. Test Users

**Team ID:** `285eaab4-44b4-4027-b65c-a1ebe7195678`

| Email | Password | `is_owner` | Role | Accès |
|---|---|---|---|---|
| `admin@test.com` | `test123` | ✅ `true` | — (propriétaire) | Tous modules r/w, bypass RBAC complet |
| `manager@test.com` | `test123` | ❌ | Manager | Commercial r/w, reports/currencies/taxes/payments r |
| `salesman@test.com` | `test123` | ❌ | Salesperson | Catalog/quotes r/w, clients/invoices/orders r |
| `accountant@test.com` | `test123` | ❌ | Accountant | Invoices/expenses/income/payments r/w, reports/taxes r |
| `customer@test.com` | `test123` | ✅ `true` | — (compte admin test) | Idem admin — c'est un second compte propriétaire de test, pas un client portail |

> **Note:** `customer@test.com` est un second compte propriétaire (`is_owner=true`) utilisé pour les tests admin. Ce n'est **pas** un utilisateur portail — le portail client utilise `portal_users` avec magic link, sans entrée dans `team_members`.

### Résultats de tests vérifiés (2026-06-19)

`node scripts/test-auth.mjs` — **72/72 tests passés**

| Catégorie | Tests | Résultat |
|---|---|---|
| Auth edge cases (401/400/403) | 4 | ✅ |
| Admin (owner) — 16 routes | 16 | ✅ |
| Manager — 16 routes | 16 | ✅ |
| Salesperson — 16 routes | 16 | ✅ |
| Accountant — 16 routes | 16 | ✅ |
| Sign-in + membership check | 4 | ✅ |

**Résultats notables confirmés :**
- Manager : `GET /income` → 403 (income: [] dans ses permissions)
- Manager : `GET /settings/company` → 403 (settings: [])
- Salesperson : `GET /expenses` → 403, `GET /reports` → 403, `POST /invoices` → 403, `POST /customers` → 403
- Accountant : `GET /products` → 403 (catalog: []), `GET /customers` → 403 (clients: [])

---

## 10. Migration Reference

| Migration | Fichier | Contenu RBAC |
|---|---|---|
| `00001` | `00001_extensions_enums_rls.sql` | Fonctions SECURITY DEFINER : `get_teams_for_authenticated_user()`, `check_permission()`, `is_team_owner()` |
| `00002` | `00002_auth_teams_rbac.sql` | Tables `users`, `teams`, `team_roles`, `team_members`, `company_invitations`, `api_keys`, JWT hook, RLS policies |
| `00007` | `00007_inventory_rpc.sql` | RPC `verify_api_key()` — SECURITY DEFINER |
| `00030` | `00030_add_currency_fk.sql` | FK manquantes sur `invoices.currency_id` et `quotes.currency_id` → corrige PostgREST join (GET /invoices et GET /quotes retournaient 500) |

---

## Key Source Files

| Fichier | Rôle |
|---|---|
| `src/lib/auth/api-auth.ts` | `withAuth()`, `authenticateRequest()`, `requirePermission()`, `hasPermission()` |
| `src/utils/supabase/server.ts` | Création du client Supabase serveur (SSR) |
| `supabase/migrations/00001_extensions_enums_rls.sql` | Fonctions RLS helper (SECURITY DEFINER) |
| `supabase/migrations/00002_auth_teams_rbac.sql` | Tables RBAC + RLS policies |
| `supabase/migrations/00007_inventory_rpc.sql` | RPC `verify_api_key()` |
| `supabase/migrations/00030_add_currency_fk.sql` | FK currency sur invoices et quotes |
| `scripts/test-auth.mjs` | Suite de tests RBAC (72 tests) — `node scripts/test-auth.mjs` |

---

## Bugs corrigés (historique)

| Bug | Cause | Fix |
|---|---|---|
| `requirePermission()` retournait 500 au lieu de 403 | `withAuth` manquait `await` sur le handler — throws synchrones deviennent des rejections Promise non catchées | Ajouté `return await handler(...)` |
| `GET /invoices` et `GET /quotes` retournaient 500 | `currency_id` dans ces tables sans FK → PostgREST ne peut pas faire le join `currency:currency_id(...)` | Migration `00030` : ajout des FK |
| `POST /*` sans body JSON retournait 500 | `request.json()` lève `SyntaxError` catchée comme erreur générique dans `withAuth` | `withAuth` catch `SyntaxError` → retourne 400 "Invalid JSON body" |
