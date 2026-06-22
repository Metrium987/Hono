-- Ajout du soft-delete sur les tables quotes et vendors
-- Pour la conformité PF : conservation des données financières

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Index pour les requêtes LIST (filtre .is("deleted_at", null))
CREATE INDEX IF NOT EXISTS idx_quotes_deleted_at ON quotes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_vendors_deleted_at ON vendors(deleted_at);
