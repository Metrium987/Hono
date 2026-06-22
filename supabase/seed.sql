-- Seed Data for Hono ERP
-- Run after all migrations are applied

-- ============================================================
-- Tax Rates (PF TVA rates per DICP/ISPF regulations)
-- ============================================================
-- ============================================================
-- Référentiel des taux de TVA (PF) — sans team_id car ils sont créés
-- par initialize_team() qui utilise ON CONFLICT DO NOTHING.
-- Le seed ci-dessous est conservé à titre de documentation uniquement.
-- La fonction initialize_team() crée ces taux automatiquement lors
-- de la création d'une équipe (avec le bon team_id).
-- ============================================================
-- Les données master (NULL team_id) ne sont pas accessibles via RLS.
-- Utiliser plutôt initialize_team() en application.

-- ============================================================
-- Default Currency (XPF — Franc CFP) — idem, créé par initialize_team()
-- ============================================================
-- Exemple :
--   SELECT public.initialize_team('uuid-de-votre-equipe');

-- ============================================================
-- Payment Methods — idem, créé par initialize_team()
-- ============================================================


-- ============================================================
-- Default Team Role Templates (created per-team on initialization)
-- Admin:  is_owner = TRUE (bypasses all checks)
-- ============================================================
-- NOTE: These are template comments — actual role creation happens
-- in application code when a team is created.

-- Manager:
--   name: 'Manager'
--   permissions: {
--     "catalog": ["read","write"], "clients": ["read","write"],
--     "quotes": ["read","write"], "invoices": ["read","write"],
--     "orders": ["read","write"], "expenses": ["read","write"],
--     "reports": ["read"], "currencies": ["read"],
--     "taxes": ["read"], "payments": ["read"]
--   }

-- Salesperson:
--   name: 'Salesperson'
--   permissions: {
--     "catalog": ["read","write"], "clients": ["read"],
--     "quotes": ["read","write"], "invoices": ["read"],
--     "orders": ["read"]
--   }

-- Accountant:
--   name: 'Accountant'
--   permissions: {
--     "invoices": ["read","write"], "payments": ["read","write"],
--     "reports": ["read","write"], "expenses": ["read","write"],
--     "taxes": ["read"]
--   }
