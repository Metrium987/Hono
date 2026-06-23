-- Migration 00043 — Stock triggers (delivery → stock, inventory count → ledger) + enum extensions
-- Phase 3 du MASTERPLAN_V2

-- ============================================================
-- 1. Étendre l'enum approval_type pour les dépenses et devis
-- ============================================================
ALTER TYPE public.approval_type ADD VALUE IF NOT EXISTS 'expense_approval';
ALTER TYPE public.approval_type ADD VALUE IF NOT EXISTS 'quote_approval';


-- ============================================================
-- 2. Trigger : delivery_note "delivered" → décrémentation stock
-- ============================================================
-- Déclenché quand delivery_notes.status passe à 'delivered'.
-- Insère dans inventory_ledger et met à jour products.current_stock.
CREATE OR REPLACE FUNCTION public.fn_delivery_decrement_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item         RECORD;
  v_current_stock NUMERIC;
BEGIN
  -- Déclencher uniquement sur la transition vers 'delivered'
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    FOR v_item IN
      SELECT product_id, quantity_delivered
      FROM public.delivery_note_items
      WHERE delivery_note_id = NEW.id
        AND quantity_delivered > 0
    LOOP
      -- Récupérer le stock courant avant modification
      SELECT COALESCE(current_stock, 0) INTO v_current_stock
      FROM public.products
      WHERE id = v_item.product_id;

      -- Enregistrer dans le grand livre de stock (immutable)
      INSERT INTO public.inventory_ledger (
        team_id,
        product_id,
        transaction_type,
        quantity_change,
        running_balance,
        reference_type,
        reference_id,
        description
      ) VALUES (
        NEW.team_id,
        v_item.product_id,
        'invoice_deduction',
        -v_item.quantity_delivered,
        v_current_stock - v_item.quantity_delivered,
        'delivery_note',
        NEW.id,
        'Livraison ' || NEW.note_number
      );

      -- Décrémenter le stock du produit
      UPDATE public.products
      SET current_stock = COALESCE(current_stock, 0) - v_item.quantity_delivered
      WHERE id = v_item.product_id;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_decrement_stock ON public.delivery_notes;
CREATE TRIGGER trg_delivery_decrement_stock
  AFTER UPDATE OF status ON public.delivery_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_delivery_decrement_stock();


-- ============================================================
-- 3. Trigger : inventory_count approuvé → inventory_ledger (écarts)
-- ============================================================
-- Déclenché quand inventory_count.status passe à 'approved'.
-- Insère les écarts (difference) dans inventory_ledger et corrige le stock.
CREATE OR REPLACE FUNCTION public.fn_inventory_count_approve()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item          RECORD;
  v_current_stock NUMERIC;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    FOR v_item IN
      SELECT product_id, counted_qty, difference
      FROM public.inventory_count_item
      WHERE count_id = NEW.id
        AND counted_qty IS NOT NULL
        AND difference IS NOT NULL
        AND difference != 0
    LOOP
      SELECT COALESCE(current_stock, 0) INTO v_current_stock
      FROM public.products
      WHERE id = v_item.product_id;

      INSERT INTO public.inventory_ledger (
        team_id,
        product_id,
        transaction_type,
        quantity_change,
        running_balance,
        reference_type,
        reference_id,
        description
      ) VALUES (
        NEW.team_id,
        v_item.product_id,
        'manual_adjustment',
        v_item.difference,
        v_current_stock + v_item.difference,
        'inventory_count',
        NEW.id,
        'Ajustement inventaire — écart ' || v_item.difference::TEXT
      );

      UPDATE public.products
      SET current_stock = COALESCE(current_stock, 0) + v_item.difference
      WHERE id = v_item.product_id;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_count_approve ON public.inventory_count;
CREATE TRIGGER trg_inventory_count_approve
  AFTER UPDATE OF status ON public.inventory_count
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_inventory_count_approve();
