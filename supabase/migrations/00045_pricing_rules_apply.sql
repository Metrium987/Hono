-- Migration 00045 — RPC apply_pricing_rules : application des règles tarifaires
-- Phase 7 du MASTERPLAN_V2
--
-- Structure réelle de pricing_rules (migration 00039) :
--   id, team_id, name, rule_type, conditions JSONB, adjustments JSONB,
--   priority INT, is_active BOOL, valid_from TIMESTAMPTZ, valid_until TIMESTAMPTZ
--
-- adjustments JSONB format attendu : {"type":"percentage"|"fixed","value":10}
-- conditions JSONB format attendu  : {"customer_id":"...", "product_ids":[...], "min_order_amount":1000}

CREATE OR REPLACE FUNCTION public.apply_pricing_rules(
  p_team_id     UUID,
  p_customer_id UUID,
  p_items       JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rule         RECORD;
  v_result       JSONB := '[]'::JSONB;
  v_order_total  NUMERIC := 0;
  v_original     NUMERIC;
  v_applied      NUMERIC;
  v_rule_id      UUID;
  v_matched      BOOLEAN;
  i              INTEGER;
  v_item         JSONB;
  v_product_id   TEXT;
  v_adj_type     TEXT;
  v_adj_value    NUMERIC;
  v_min_order    NUMERIC;
BEGIN
  -- 1. Calculer le total commande pour vérifier min_order_amount dans conditions
  FOR i IN 0..jsonb_array_length(p_items) - 1 LOOP
    v_order_total := v_order_total
      + COALESCE((p_items->i->>'unit_price_ht')::NUMERIC, 0)
      * COALESCE((p_items->i->>'quantity')::NUMERIC, 1);
  END LOOP;

  -- 2. Traiter chaque item
  FOR i IN 0..jsonb_array_length(p_items) - 1 LOOP
    v_item       := p_items->i;
    v_original   := COALESCE((v_item->>'unit_price_ht')::NUMERIC, 0);
    v_applied    := v_original;
    v_rule_id    := NULL;
    v_matched    := FALSE;
    v_product_id := v_item->>'product_id';

    -- Chercher la meilleure règle active (priority ASC = priorité la plus haute en premier)
    FOR v_rule IN
      SELECT id, adjustments, conditions
      FROM public.pricing_rules
      WHERE team_id = p_team_id
        AND is_active = TRUE
        AND (valid_from IS NULL OR valid_from <= NOW())
        AND (valid_until IS NULL OR valid_until >= NOW())
      ORDER BY COALESCE(priority, 999) ASC
    LOOP
      -- Extraire les conditions
      v_min_order := (v_rule.conditions->>'min_order_amount')::NUMERIC;

      -- Vérifier min_order_amount
      IF v_min_order IS NOT NULL AND v_order_total < v_min_order THEN
        CONTINUE;
      END IF;

      -- Filtre customer_id
      IF v_rule.conditions ? 'customer_id'
         AND (v_rule.conditions->>'customer_id') != p_customer_id::TEXT
      THEN
        CONTINUE;
      END IF;

      -- Filtre product_ids
      IF v_rule.conditions ? 'product_ids'
         AND v_product_id IS NOT NULL
         AND NOT (v_rule.conditions->'product_ids' @> to_jsonb(v_product_id))
      THEN
        CONTINUE;
      END IF;

      -- Extraire le type et la valeur de la remise depuis adjustments JSONB
      v_adj_type  := v_rule.adjustments->>'type';
      v_adj_value := (v_rule.adjustments->>'value')::NUMERIC;

      -- Appliquer la remise
      IF v_adj_type = 'percentage' AND v_adj_value IS NOT NULL THEN
        v_applied := v_original * (1 - v_adj_value / 100);
      ELSIF v_adj_type = 'fixed' AND v_adj_value IS NOT NULL THEN
        v_applied := GREATEST(0, v_original - v_adj_value);
      END IF;

      v_rule_id := v_rule.id;
      v_matched := TRUE;
      EXIT; -- Première règle correspondante gagne
    END LOOP;

    -- Construire l'entrée de résultat
    v_result := v_result || jsonb_build_object(
      'product_id',      v_product_id,
      'quantity',        COALESCE((v_item->>'quantity')::NUMERIC, 1),
      'original_price',  v_original,
      'applied_price',   ROUND(v_applied, 2),
      'pricing_rule_id', v_rule_id
    );
  END LOOP;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_pricing_rules(UUID, UUID, JSONB) TO authenticated;
