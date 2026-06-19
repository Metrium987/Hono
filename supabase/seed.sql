-- Seed Data for Hono ERP
-- Run after all migrations are applied

-- ============================================================
-- Tax Rates (PF TVA rates per DICP/ISPF regulations)
-- ============================================================
INSERT INTO public.tax_rates (id, team_id, name, rate, description, is_active) VALUES
  ('00000000-0000-0000-0000-000000000001', NULL, 'TVA réduit', 5.00,
   'Taux réduit (alimentation, transport voyageurs, électricité, hébergement touristique)', TRUE),
  ('00000000-0000-0000-0000-000000000002', NULL, 'TVA intermédiaire', 13.00,
   'Taux intermédiaire (prestations de services)', TRUE),
  ('00000000-0000-0000-0000-000000000003', NULL, 'TVA normal', 16.00,
   'Taux normal (biens et produits standards)', TRUE),
  ('00000000-0000-0000-0000-000000000004', NULL, 'TVA archipel', 1.00,
   'Taux spécial archipels 2026 (développement économique îles éloignées)', TRUE),
  ('00000000-0000-0000-0000-000000000005', NULL, 'Exonéré', 0.00,
   'TVA non applicable, franchise en base', TRUE)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Default Currency (XPF — Franc CFP)
-- ============================================================
INSERT INTO public.currencies (id, team_id, code, name, symbol, symbol_position, is_default, exchange_rate_to_xpf) VALUES
  ('00000000-0000-0000-0000-000000000001', NULL, 'XPF', 'Franc CFP', 'F', 'suffix', TRUE, 1.000000)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Payment Methods (local-first PF methods)
-- ============================================================
INSERT INTO public.payment_methods (id, team_id, name, display_name, is_active, is_online, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000001', NULL, 'cash',         'Espèces',           TRUE,  FALSE, 1),
  ('00000000-0000-0000-0000-000000000002', NULL, 'check',        'Chèque',            TRUE,  FALSE, 2),
  ('00000000-0000-0000-0000-000000000003', NULL, 'bank_transfer', 'Virement bancaire', TRUE,  FALSE, 3),
  ('00000000-0000-0000-0000-000000000004', NULL, 'card',         'Carte bancaire',    TRUE,  FALSE, 4),
  ('00000000-0000-0000-0000-000000000005', NULL, 'stripe',       'Stripe',            FALSE, TRUE,  5),
  ('00000000-0000-0000-0000-000000000006', NULL, 'paypal',       'PayPal',            FALSE, TRUE,  6)
ON CONFLICT DO NOTHING;

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
