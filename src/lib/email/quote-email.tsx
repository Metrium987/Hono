import {
  Body,
  Container,
  Column,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";

export type QuoteEmailData = {
  quoteNumber: string;
  issueDate: string;
  validityDate: string;
  totalTtc: number;
  subtotalHt: number;
  taxAmount: number;
  currency: string;
  teamName: string;
  teamEmail: string | null;
  teamPhone: string | null;
  teamAddress: string | null;
  teamLogo: string | null;
  customerName: string;
  items: { description: string; quantity: number; unitPrice: number; lineTotal: number }[];
  portalLink?: string;
  notes?: string | null;
};

export function QuoteEmail({ data }: { data: QuoteEmailData }) {
  const previewText = `Devis ${data.quoteNumber} — ${data.teamName} — ${Math.round(data.totalTtc).toLocaleString("fr-FR")} ${data.currency}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            {data.teamLogo && (
              <Img src={data.teamLogo} alt={data.teamName} width="56" height="56" style={logo} />
            )}
            <Column>
              <Heading style={companyName}>{data.teamName}</Heading>
              {data.teamAddress && <Text style={mutedText}>{data.teamAddress}</Text>}
            </Column>
            <Column align="right">
              <Heading style={quoteTitle}>DEVIS</Heading>
              <Text style={quoteNumber}>{data.quoteNumber}</Text>
            </Column>
          </Section>

          <Hr style={hr} />

          {/* Info grid */}
          <Section style={infoGrid}>
            <Column style={infoCol}>
              <Text style={infoLabel}>Date d&apos;émission</Text>
              <Text style={infoValue}>{data.issueDate}</Text>
              <Text style={infoLabel}>Valable jusqu&apos;au</Text>
              <Text style={infoValue}>{data.validityDate}</Text>
            </Column>
            <Column style={infoCol}>
              <Text style={infoLabel}>Client</Text>
              <Text style={infoValue}>{data.customerName}</Text>
            </Column>
          </Section>

          {/* Items */}
          <Section style={tableSection}>
            <Row style={tableHeader}>
              <Column style={thDescription}>Description</Column>
              <Column style={thQty}>Qté</Column>
              <Column style={thPrice}>Prix HT</Column>
              <Column style={thTotal}>Total HT</Column>
            </Row>
            {data.items.map((item, i) => (
              <Row key={i} style={i % 2 === 0 ? tableRow : tableRowAlt}>
                <Column style={tdDescription}><Text style={itemText}>{item.description}</Text></Column>
                <Column style={tdQty}><Text style={itemText}>{item.quantity}</Text></Column>
                <Column style={tdPrice}>
                  <Text style={itemText}>{item.unitPrice.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {data.currency}</Text>
                </Column>
                <Column style={tdTotal}>
                  <Text style={itemText}>{item.lineTotal.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {data.currency}</Text>
                </Column>
              </Row>
            ))}
          </Section>

          {/* Totaux */}
          <Section style={totalsSection}>
            <Row><Column style={totalLabelCol}><Text style={totalLabel}>Total HT</Text></Column>
              <Column style={totalValueCol}><Text style={totalValue}>{data.subtotalHt.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {data.currency}</Text></Column>
            </Row>
            <Row><Column style={totalLabelCol}><Text style={totalLabel}>TVA</Text></Column>
              <Column style={totalValueCol}><Text style={totalValue}>{data.taxAmount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {data.currency}</Text></Column>
            </Row>
            <Hr style={hr} />
            <Row>
              <Column style={totalLabelCol}><Text style={grandTotalLabel}>Total TTC</Text></Column>
              <Column style={totalValueCol}><Text style={grandTotalValue}>{data.totalTtc.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {data.currency}</Text></Column>
            </Row>
          </Section>

          {data.notes && (
            <Section style={{ marginBottom: "20px" }}>
              <Text style={infoLabel}>Notes</Text>
              <Text style={notesText}>{data.notes}</Text>
            </Section>
          )}

          {/* CTA */}
          {data.portalLink && (
            <Section style={actionsSection}>
              <Link href={data.portalLink} style={button}>Voir et accepter le devis</Link>
            </Section>
          )}

          <Hr style={hr} />

          <Section style={footerSection}>
            <Text style={footerText}>
              {data.teamName}
              {data.teamEmail && ` — ${data.teamEmail}`}
              {data.teamPhone && ` — ${data.teamPhone}`}
            </Text>
            <Text style={footerMuted}>
              Ce devis est valable jusqu&apos;au {data.validityDate}. Passé ce délai, les prix peuvent être révisés.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ── Styles ──

const JADE = "#0d7a63";

const main = {
  backgroundColor: "#f4f5f7",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  padding: "20px 0",
};
const container = { backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "8px", margin: "0 auto", maxWidth: "600px", padding: "32px" };
const header = { marginBottom: "24px" };
const logo = { borderRadius: "8px", marginRight: "16px", float: "left" as const };
const companyName = { fontSize: "20px", fontWeight: "700", color: JADE, margin: "0 0 4px" };
const quoteTitle = { fontSize: "24px", fontWeight: "700", color: JADE, margin: "0 0 4px" };
const quoteNumber = { fontSize: "14px", color: "#6b7280", margin: "0" };
const mutedText = { fontSize: "12px", color: "#6b7280", margin: "0 0 2px" };
const hr = { borderColor: "#e5e7eb", margin: "16px 0" };
const infoGrid = { marginBottom: "24px" };
const infoCol = { verticalAlign: "top" as const, width: "50%", paddingRight: "16px" };
const infoLabel = { fontSize: "11px", fontWeight: "600", color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: "1px", margin: "0 0 2px" };
const infoValue = { fontSize: "14px", color: "#1f2937", margin: "0 0 8px" };
const tableSection = { marginBottom: "24px" };
const tableHeader = { backgroundColor: JADE, padding: "8px 12px", borderRadius: "4px 4px 0 0" };
const thBase = { padding: "8px 12px", fontSize: "11px", fontWeight: "600", color: "#ffffff", textTransform: "uppercase" as const, letterSpacing: "1px" };
const thDescription = thBase;
const thQty = { ...thBase, textAlign: "right" as const };
const thPrice = { ...thBase, textAlign: "right" as const };
const thTotal = { ...thBase, textAlign: "right" as const };
const tableRow = { borderBottom: "1px solid #e5e7eb" };
const tableRowAlt = { backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" };
const tdDescription = { padding: "8px 12px" };
const tdQty = { padding: "8px 12px", textAlign: "right" as const };
const tdPrice = { padding: "8px 12px", textAlign: "right" as const };
const tdTotal = { padding: "8px 12px", textAlign: "right" as const };
const itemText = { fontSize: "13px", color: "#1f2937", margin: "0" };
const totalsSection = { marginBottom: "24px", paddingLeft: "12px" };
const totalLabelCol = { width: "80%" };
const totalValueCol = { width: "20%", textAlign: "right" as const };
const totalLabel = { fontSize: "13px", color: "#6b7280", margin: "0" };
const totalValue = { fontSize: "13px", color: "#1f2937", margin: "0" };
const grandTotalLabel = { fontSize: "16px", fontWeight: "700", color: JADE, margin: "0" };
const grandTotalValue = { fontSize: "16px", fontWeight: "700", color: JADE, margin: "0" };
const notesText = { fontSize: "13px", color: "#374151", lineHeight: "1.5", margin: "4px 0 0" };
const actionsSection = { textAlign: "center" as const, marginBottom: "24px" };
const button = { backgroundColor: JADE, borderRadius: "6px", color: "#ffffff", display: "inline-block", fontSize: "14px", fontWeight: "600", padding: "12px 28px", textDecoration: "none" };
const footerSection = { textAlign: "center" as const };
const footerText = { fontSize: "12px", color: "#6b7280", margin: "0 0 4px" };
const footerMuted = { fontSize: "11px", color: "#9ca3af", margin: "0" };
