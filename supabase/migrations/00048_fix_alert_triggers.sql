-- Migration 00048 — Corriger les triggers d'alertes vers system_alerts (pas alerts)
-- Les triggers 00044 insèrent dans "alerts" qui n'existe pas — table réelle = "system_alerts"

CREATE OR REPLACE FUNCTION public.fn_alert_low_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.current_stock IS NOT NULL
     AND NEW.low_stock_alert IS NOT NULL
     AND NEW.current_stock <= NEW.low_stock_alert
     AND (OLD.current_stock IS NULL OR OLD.current_stock > NEW.low_stock_alert)
  THEN
    INSERT INTO public.system_alerts(team_id, alert_type, severity, title, message, entity_type, entity_id, is_dismissed)
    SELECT NEW.team_id, 'low_stock', 'warning',
           'Stock bas : ' || NEW.name,
           'Le stock de "' || NEW.name || '" est passé sous le seuil d''alerte (' || NEW.current_stock || ' restants).',
           'product', NEW.id, FALSE
    WHERE NOT EXISTS (
      SELECT 1 FROM public.system_alerts
      WHERE entity_id = NEW.id AND alert_type = 'low_stock' AND is_dismissed = FALSE
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alert_low_stock ON public.products;
CREATE TRIGGER trg_alert_low_stock
  AFTER UPDATE OF current_stock ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.fn_alert_low_stock();

-- ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_alert_ar_overdue()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'overdue' AND (OLD.status IS NULL OR OLD.status != 'overdue') THEN
    INSERT INTO public.system_alerts(team_id, alert_type, severity, title, message, entity_type, entity_id, is_dismissed)
    VALUES (NEW.team_id, 'ar_overdue', 'warning',
            'Compte client en retard',
            'Un compte client est passé en statut impayé.',
            'account_receivable', NEW.id, FALSE)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alert_ar_overdue ON public.account_receivables;
CREATE TRIGGER trg_alert_ar_overdue
  AFTER INSERT OR UPDATE OF status ON public.account_receivables
  FOR EACH ROW EXECUTE FUNCTION public.fn_alert_ar_overdue();

-- ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_alert_quote_expired()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'expired' AND (OLD.status IS NULL OR OLD.status != 'expired') THEN
    INSERT INTO public.system_alerts(team_id, alert_type, severity, title, message, entity_type, entity_id, is_dismissed)
    VALUES (NEW.team_id, 'quote_expired', 'info',
            'Devis expiré : ' || NEW.quote_number,
            'Le devis ' || NEW.quote_number || ' a dépassé sa date de validité.',
            'quote', NEW.id, FALSE)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alert_quote_expired ON public.quotes;
CREATE TRIGGER trg_alert_quote_expired
  AFTER INSERT OR UPDATE OF status ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.fn_alert_quote_expired();
