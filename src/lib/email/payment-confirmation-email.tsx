import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export type PaymentConfirmationData = {
  invoiceNumber: string;
  amountPaid: number;
  paymentDate: string;
  currency: string;
  customerName: string;
  teamName: string;
  teamEmail: string | null;
  teamPhone: string | null;
  remainingBalance?: number;
  isFullyPaid: boolean;
};

export function PaymentConfirmationEmail({ data }: { data: PaymentConfirmationData }) {
  const previewText = data.isFullyPaid
    ? `Paiement reçu — Facture ${data.invoiceNumber} soldée`
    : `Paiement partiel reçu — Facture ${data.invoiceNumber}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Status badge */}
          <Section style={{ marginBottom: "16px" }}>
            <span style={data.isFullyPaid ? badgePaid : badgePartial}>
              {data.isFullyPaid ? "✓ FACTURE SOLDÉE" : "PAIEMENT PARTIEL"}
            </span>
          </Section>

          <Heading style={h1}>
            {data.isFullyPaid ? "Paiement reçu — Merci !" : "Paiement partiel enregistré"}
          </Heading>

          <Hr style={hr} />

          {/* Infos paiement */}
          <Section style={infoBox}>
            <Text style={infoRow}><span style={infoLabel}>Facture N°</span> {data.invoiceNumber}</Text>
            <Text style={infoRow}><span style={infoLabel}>Montant reçu</span> {Math.round(data.amountPaid).toLocaleString("fr-FR")} {data.currency}</Text>
            <Text style={infoRow}><span style={infoLabel}>Date</span> {data.paymentDate}</Text>
            {!data.isFullyPaid && data.remainingBalance !== undefined && (
              <Text style={{ ...infoRow, color: "#b45309" }}>
                <span style={infoLabel}>Solde restant</span> {Math.round(data.remainingBalance).toLocaleString("fr-FR")} {data.currency}
              </Text>
            )}
          </Section>

          <Hr style={hr} />

          <Section style={{ marginBottom: "20px" }}>
            <Text style={bodyText}>
              Madame, Monsieur {data.customerName},
            </Text>
            {data.isFullyPaid ? (
              <Text style={bodyText}>
                Nous avons bien reçu votre règlement de{" "}
                <strong>{Math.round(data.amountPaid).toLocaleString("fr-FR")} {data.currency}</strong>{" "}
                pour la facture {data.invoiceNumber}. Cette facture est désormais soldée.
              </Text>
            ) : (
              <Text style={bodyText}>
                Nous avons bien enregistré votre paiement partiel de{" "}
                <strong>{Math.round(data.amountPaid).toLocaleString("fr-FR")} {data.currency}</strong>{" "}
                pour la facture {data.invoiceNumber}. Un solde de{" "}
                <strong>{Math.round(data.remainingBalance ?? 0).toLocaleString("fr-FR")} {data.currency}</strong>{" "}
                reste à régler.
              </Text>
            )}
            <Text style={bodyText}>
              Nous vous remercions de votre confiance.
            </Text>
          </Section>

          <Hr style={hr} />

          <Section style={footerSection}>
            <Text style={footerText}>
              {data.teamName}
              {data.teamEmail && ` — ${data.teamEmail}`}
              {data.teamPhone && ` — ${data.teamPhone}`}
            </Text>
            <Text style={footerMuted}>
              Ce justificatif est généré automatiquement. Conservez-le pour vos archives.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const JADE = "#0d7a63";

const main = {
  backgroundColor: "#f4f5f7",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  padding: "20px 0",
};
const container = { backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "8px", margin: "0 auto", maxWidth: "520px", padding: "32px" };
const badgePaid = { display: "inline-block", padding: "4px 12px", borderRadius: "4px", backgroundColor: JADE, color: "#ffffff", fontSize: "11px", fontWeight: "700" as const, letterSpacing: "1.5px" };
const badgePartial = { display: "inline-block", padding: "4px 12px", borderRadius: "4px", backgroundColor: "#b45309", color: "#ffffff", fontSize: "11px", fontWeight: "700" as const, letterSpacing: "1.5px" };
const h1 = { fontSize: "22px", fontWeight: "700" as const, color: "#111827", margin: "0 0 16px" };
const hr = { borderColor: "#e5e7eb", margin: "16px 0" };
const infoBox = { backgroundColor: "#f0faf7", borderRadius: "6px", padding: "12px 16px", marginBottom: "20px", borderLeft: `3px solid ${JADE}` };
const infoRow = { fontSize: "13px", color: "#1f2937", margin: "4px 0" };
const infoLabel = { fontWeight: "600" as const, color: "#6b7280", display: "inline-block", width: "120px" };
const bodyText = { fontSize: "14px", color: "#374151", lineHeight: "1.6", margin: "0 0 12px" };
const footerSection = { textAlign: "center" as const };
const footerText = { fontSize: "12px", color: "#6b7280", margin: "0 0 4px" };
const footerMuted = { fontSize: "11px", color: "#9ca3af", margin: "0" };
