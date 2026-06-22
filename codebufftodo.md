# Hono ERP — Plan de correction ✅

## Ordre d'exécution optimal

| # | Tâche | Statut |
|---|-------|--------|
| 1 | **[C1]** Env var: PUBLISHABLE_KEY → ANON_KEY | ✅ |
| 2 | **[C2]** Fusion embeddings + VECTOR(768) | ✅ |
| 3 | **[C3]** Page /onboarding | ✅ |
| 4 | **[H1]** RBAC: customers → clients | ✅ |
| 5 | **[H2]** requirePermission manquants | ✅ |
| 6 | **[M1]** Nettoyer packages inutilisés (6 packages) | ✅ |
| 7 | **[M2]** Page /contact storefront | ✅ |
| 8 | **[M3]** CSP img-src Supabase | ✅ |
| 9 | **[M4]** Casts `: any` → types stricts (4 fichiers) | ✅ |
| 10 | **[M5]** console.logs sensibles (3 routes) | ✅ |
| 11 | **[L1]** design.json → palette Jade | ✅ |
| 12 | **[L2]** seed.sql team_id NULL | ✅ |
| — | **Review finale + build** | ✅ ✅ ✅ |

## Dépendances

```
[C1] Env var name ───────────────────────────────────── ✅
  │
[C2] Embeddings fusion ───────────────────────────────── ✅
  │
[C3] Page /onboarding ────────────────────────────────── ✅
  │
[H1] RBAC incohérence ────────────────────────────────── ✅
  │
[H2] requirePermission manquants ─────────────────────── ✅
  │
[M1] Packages inutilisés (6) ─────────────────────────── ✅
  │
[M2] Page /contact ───────────────────────────────────── ✅
  │
[M3] CSP images Supabase ─────────────────────────────── ✅
  │
[M4] Casts `: any` ───────────────────────────────────── ✅
  │
[M5] console.logs sensibles ──────────────────────────── ✅
  │
[L1] design.json palette ─────────────────────────────── ✅
  │
[L2] seed.sql team_id NULL ───────────────────────────── ✅
  │
Review finale + build check ──────────────────────────── ✅
```

## Résumé des corrections

### 🔴 Critique (3)
- **C1** — `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → `NEXT_PUBLIC_SUPABASE_ANON_KEY` (3 fichiers)
- **C2** — VECTOR(1536→768) dans `00001_schema_complet.sql` + fusion des 2 fichiers d'embedding en 1 + mise à jour des 4 routes
- **C3** — Page `/onboarding` créée (locale-aware) + redirect dans le layout ERP corrigé

### 🟠 Élevé (2)
- **H1** — RBAC: `"customers"` → `"clients"` dans calendar-events + staff-groups (4 fichiers)
- **H2** — `requirePermission` ajouté sur search (+ flexible), team/members, team/members/[userId]

### 🟡 Moyen (4)
- **M1** — 6 packages inutilisés supprimés (`@radix-ui/react-alert-dialog`, `@radix-ui/react-popover`, `@radix-ui/react-radio-group`, `@radix-ui/react-tooltip`, `tw-animate-css`, `@google/generative-ai`)
- **M2** — Page `/contact` du storefront créée
- **M3** — CSP: `https://*.supabase.co` ajouté à `img-src`
- **M4** — 4 casts `: any` remplacés par des types stricts
- **M5** — 3 `console.log` sensibles → `console.warn` sans fuite de données

### 🔵 Faible (2)
- **L1** — `.impeccable/design.json` aligné avec la palette Jade d'Autorité
- **L2** — `seed.sql` nettoyé (team_id NULL → documentation)
