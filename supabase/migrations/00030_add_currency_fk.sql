-- Migration 00030: Add missing FK constraints on currency_id
-- invoices.currency_id and quotes.currency_id were declared UUID NOT NULL
-- without REFERENCES public.currencies(id), breaking PostgREST joins.

ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_currency_id_fkey
  FOREIGN KEY (currency_id) REFERENCES public.currencies(id) ON DELETE RESTRICT;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_currency_id_fkey
  FOREIGN KEY (currency_id) REFERENCES public.currencies(id) ON DELETE RESTRICT;
