-- Phase 4.4: Enable RLS on 9 child tables that currently have no RLS
-- Each table gets a policy that restricts access to rows belonging to the user's team.

-- product_category_translations
ALTER TABLE product_category_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their team's product category translations"
  ON product_category_translations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM product_categories pc
      JOIN team_members tm ON tm.team_id = pc.team_id
      WHERE pc.id = product_category_translations.category_id
        AND tm.user_id = auth.uid()
    )
  );

-- product_translations
ALTER TABLE product_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their team's product translations"
  ON product_translations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM products p
      JOIN team_members tm ON tm.team_id = p.team_id
      WHERE p.id = product_translations.product_id
        AND tm.user_id = auth.uid()
    )
  );

-- product_images
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their team's product images"
  ON product_images
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM products p
      JOIN team_members tm ON tm.team_id = p.team_id
      WHERE p.id = product_images.product_id
        AND tm.user_id = auth.uid()
    )
  );

-- quote_items
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their team's quote items"
  ON quote_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM quotes q
      JOIN team_members tm ON tm.team_id = q.team_id
      WHERE q.id = quote_items.quote_id
        AND tm.user_id = auth.uid()
    )
  );

-- invoice_items
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their team's invoice items"
  ON invoice_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      JOIN team_members tm ON tm.team_id = i.team_id
      WHERE i.id = invoice_items.invoice_id
        AND tm.user_id = auth.uid()
    )
  );

-- invoice_item_groups
ALTER TABLE invoice_item_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their team's invoice item groups"
  ON invoice_item_groups
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      JOIN team_members tm ON tm.team_id = i.team_id
      WHERE i.id = invoice_item_groups.invoice_id
        AND tm.user_id = auth.uid()
    )
  );

-- invoice_number_history (no team_id column — joins through invoices)
ALTER TABLE invoice_number_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their team's invoice number history"
  ON invoice_number_history
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      JOIN team_members tm ON tm.team_id = i.team_id
      WHERE i.id = invoice_number_history.invoice_id
        AND tm.user_id = auth.uid()
    )
  );

-- credit_note_items
ALTER TABLE credit_note_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their team's credit note items"
  ON credit_note_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM credit_notes cn
      JOIN team_members tm ON tm.team_id = cn.team_id
      WHERE cn.id = credit_note_items.credit_note_id
        AND tm.user_id = auth.uid()
    )
  );

-- order_items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their team's order items"
  ON order_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN team_members tm ON tm.team_id = o.team_id
      WHERE o.id = order_items.order_id
        AND tm.user_id = auth.uid()
    )
  );
