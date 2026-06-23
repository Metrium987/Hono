-- Migration 00046 — Trigger : commission auto quand une facture passe à 'paid'
-- Phase 8 du MASTERPLAN_V2
--
-- Note architecturale :
--   invoice_commissions (migration 00032) = commissions staff/commerciaux internes
--   assigned_to sur invoices = UUID du commercial (users.id)
--   commission_rules.user_id = UUID du commercial
--   Ce trigger complète la logique déjà présente dans invoices/[id]/payments/route.ts
--   (le code API crée aussi une commission — ce trigger est le filet de sécurité côté DB)

CREATE OR REPLACE FUNCTION public.fn_auto_vendor_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rate        NUMERIC;
  v_comm_amount NUMERIC;
  v_now         TIMESTAMPTZ := NOW();
BEGIN
  -- Déclencher uniquement sur la transition vers 'paid' avec un commercial assigné
  IF NEW.status = 'paid'
     AND (OLD.status IS NULL OR OLD.status != 'paid')
     AND NEW.assigned_to IS NOT NULL
  THEN
    -- Chercher la règle de commission active pour ce commercial
    SELECT rate INTO v_rate
    FROM public.commission_rules
    WHERE team_id = NEW.team_id
      AND user_id = NEW.assigned_to
      AND applies_from <= v_now
      AND (applies_to IS NULL OR applies_to >= v_now)
    ORDER BY applies_from DESC
    LIMIT 1;

    IF FOUND AND v_rate IS NOT NULL THEN
      v_comm_amount := ROUND(NEW.total_ttc * v_rate / 100, 2);

      -- Insérer la commission (ON CONFLICT = idempotent si la route API l'a déjà créée)
      INSERT INTO public.invoice_commissions (
        team_id,
        invoice_id,
        user_id,
        amount,
        rate,
        status,
        created_at
      ) VALUES (
        NEW.team_id,
        NEW.id,
        NEW.assigned_to,
        v_comm_amount,
        v_rate,
        'pending',
        v_now
      )
      ON CONFLICT (invoice_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_vendor_commission ON public.invoices;
CREATE TRIGGER trg_auto_vendor_commission
  AFTER UPDATE OF status ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_vendor_commission();
