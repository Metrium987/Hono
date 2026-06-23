-- Migration 00044 — Triggers alertes automatiques (stock bas, AR overdue, devis expiré, intégration)
-- Phase 5 du MASTERPLAN_V2

-- ============================================================
-- 1. Étendre l'enum alert_type pour les devis expirés
-- ============================================================
ALTER TYPE public.alert_type ADD VALUE IF NOT EXISTS 'quote_expired';


-- ============================================================
-- 2. Trigger : stock bas sur products.current_stock
-- ============================================================
-- Déclenché après chaque UPDATE de current_stock.
-- Évite les doublons : insère uniquement si aucune alerte active non dismissée existe déjà.
CREATE OR REPLACE FUNCTION public.fn_alert_low_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.track_stock = TRUE
     AND NEW.low_stock_threshold IS NOT NULL
     AND NEW.current_stock <= NEW.low_stock_threshold
     AND (OLD.current_stock IS NULL OR OLD.current_stock > NEW.low_stock_threshold)
  THEN
    -- Éviter les doublons
    IF NOT EXISTS (
      SELECT 1 FROM public.system_alerts
      WHERE team_id = NEW.team_id
        AND alert_type = 'low_stock'
        AND entity_type = 'product'
        AND entity_id = NEW.id
        AND is_dismissed = FALSE
    ) THEN
      INSERT INTO public.system_alerts (
        team_id, alert_type, severity, title, message, entity_type, entity_id
      ) VALUES (
        NEW.team_id,
        'low_stock',
        'warning',
        'Stock bas : ' || NEW.name,
        NEW.current_stock::TEXT || ' unités restantes (seuil : ' || NEW.low_stock_threshold::TEXT || ')',
        'product',
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alert_low_stock ON public.products;
CREATE TRIGGER trg_alert_low_stock
  AFTER UPDATE OF current_stock ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_alert_low_stock();


-- ============================================================
-- 3. Trigger : créance en retard (account_receivables → overdue)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_alert_ar_overdue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'overdue' AND (OLD.status IS NULL OR OLD.status != 'overdue') THEN
    INSERT INTO public.system_alerts (
      team_id, alert_type, severity, title, message, entity_type, entity_id
    ) VALUES (
      NEW.team_id,
      'ar_overdue',
      'high',
      'Créance en retard',
      'Une créance de ' || NEW.balance::TEXT || ' F CFP est en retard depuis le ' || NEW.due_date::TEXT,
      'account_receivable',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alert_ar_overdue ON public.account_receivables;
CREATE TRIGGER trg_alert_ar_overdue
  AFTER UPDATE OF status ON public.account_receivables
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_alert_ar_overdue();


-- ============================================================
-- 4. Trigger : devis expiré (quotes.status → 'expired')
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_alert_quote_expired()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'expired' AND (OLD.status IS NULL OR OLD.status != 'expired') THEN
    INSERT INTO public.system_alerts (
      team_id, alert_type, severity, title, message, entity_type, entity_id
    ) VALUES (
      NEW.team_id,
      'quote_expired',
      'medium',
      'Devis expiré',
      'Le devis ' || NEW.quote_number || ' a expiré',
      'quote',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alert_quote_expired ON public.quotes;
CREATE TRIGGER trg_alert_quote_expired
  AFTER UPDATE OF status ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_alert_quote_expired();


-- ============================================================
-- 5. Trigger : échec d'intégration (integration_failures INSERT)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_alert_integration_failure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.system_alerts (
    team_id, alert_type, severity, title, message, entity_type, entity_id
  ) VALUES (
    NEW.team_id,
    'integration_failure',
    'high',
    'Échec d''intégration : ' || NEW.source,
    COALESCE(NEW.error_message, 'Erreur inconnue'),
    'integration_failure',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alert_integration_failure ON public.integration_failures;
CREATE TRIGGER trg_alert_integration_failure
  AFTER INSERT ON public.integration_failures
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_alert_integration_failure();
