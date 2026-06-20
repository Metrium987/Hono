-- Migration 00027: initialize_team() — Seeds default data on team creation
-- Seeds: XPF + EUR currencies, PF TVA rates (0/1/5/13/16%), payment methods (Espèces/Virement/Chèque/CB)

CREATE OR REPLACE FUNCTION public.initialize_team(p_team_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Currencies: XPF (default) + EUR
  INSERT INTO public.currencies (team_id, code, name, symbol, symbol_position, is_default, exchange_rate_to_xpf, is_active)
  VALUES
    (p_team_id, 'XPF', 'Franc Pacifique', 'F', 'suffix', TRUE,  1.000000, TRUE),
    (p_team_id, 'EUR', 'Euro',             '€', 'suffix', FALSE, 119.332000, TRUE)
  ON CONFLICT (team_id, code) DO NOTHING;

  -- TVA rates — Polynésie Française
  INSERT INTO public.tax_rates (team_id, name, rate, description, is_active)
  VALUES
    (p_team_id, 'Exonéré',   0.00, 'Taux 0% — exportations, franchise en base', TRUE),
    (p_team_id, 'TVA 1%',    1.00, 'Taux réduit 1% — produits de 1ère nécessité', TRUE),
    (p_team_id, 'TVA 5%',    5.00, 'Taux intermédiaire 5%', TRUE),
    (p_team_id, 'TVA 13%',  13.00, 'Taux normal 13% — services', TRUE),
    (p_team_id, 'TVA 16%',  16.00, 'Taux normal 16% — biens', TRUE)
  ON CONFLICT (team_id, name) DO NOTHING;

  -- Payment methods — PF standard
  INSERT INTO public.payment_methods (team_id, name, display_name, is_active)
  VALUES
    (p_team_id, 'cash',          'Espèces',        TRUE),
    (p_team_id, 'bank_transfer', 'Virement bancaire', TRUE),
    (p_team_id, 'check',         'Chèque',         TRUE),
    (p_team_id, 'card',          'Carte bancaire', TRUE)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Grant execute to authenticated users (called from onboarding)
GRANT EXECUTE ON FUNCTION public.initialize_team(UUID) TO authenticated;

-- RLS note: SECURITY DEFINER bypasses RLS — the caller's team_id is the only parameter.
-- The INSERT policies on currencies/tax_rates/payment_methods do NOT apply here.
-- Ensure only the team owner calls this (enforced at application level in onboarding).
