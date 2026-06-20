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
  Link,
} from "@react-email/components";

export type InvoiceReminderData = {
  level: 1 | 2 | 3;
  invoiceNumber: string;
  totalTtc: number;
  dueDate: string;
  daysOverdue: number;
  customerName: string;
  teamName: string;
  teamEmail: string | null;
  teamPhone: string | null;
  portalLink?: string;
  lateFee?: number;
};

const LEVEL_CONFIG = {
  1: {
    subject: (inv: string, team: string) => `Rappel — Facture ${inv} — ${team}`,
    preview: (inv: string) => `Rappel de paiement pour la facture ${inv}`,
    badge: "RAPPEL",
    badgeColor: "#d97706",
    title: "Rappel de paiement",
    body: (d: InvoiceReminderData) =>
      `Nous vous contactons au sujet de la facture ${d.invoiceNumber} d'un montant de ${Math.round(d.totalTtc).toLocaleString("fr-FR")} F CFP, arrivée à échéance le ${d.dueDate}.

Nous vous remercions de bien vouloir procéder au règlement dans les meilleurs délais.

Si votre paiement a déjà été effectué, veuillez ignorer ce message et nous en informer afin de mettre à jour votre dossier.`,
    cta: "Voir ma facture",
    ctaStyle: "#1a56db",
  },
  2: {
    subject: (inv: string, team: string) => `RELANCE — Facture ${inv} impayée — ${team}`,
    preview: (inv: string) => `2ème relance — Facture ${inv} toujours impayée`,
    badge: "RELANCE",
    badgeColor: "#dc2626",
    title: "Relance — Facture impayée",
    body: (d: InvoiceReminderData) =>
      `Malgré notre premier rappel, la facture ${d.invoiceNumber} d'un montant de ${Math.round(d.totalTtc).toLocaleString("fr-FR")} F CFP reste impayée à ce jour (${d.daysOverdue} jours de retard).

Nous vous demandons de bien vouloir régulariser cette situation dans un délai de 15 jours à compter de la présente.

À défaut de règlement, nous nous verrons dans l'obligation d'engager une procédure de recouvrement.`,
    cta: "Régler ma facture",
    ctaStyle: "#dc2626",
  },
  3: {
    subject: (inv: string, team: string) => `MISE EN DEMEURE — Facture ${inv} — ${team}`,
    preview: (inv: string) => `Mise en demeure — Facture ${inv}`,
    badge: "MISE EN DEMEURE",
    badgeColor: "#7f1d1d",
    title: "Mise en demeure de payer",
    body: (d: InvoiceReminderData) =>
      `La présente lettre vaut mise en demeure formelle.

Malgré nos relances successives, la facture ${d.invoiceNumber} d'un montant de ${Math.round(d.totalTtc).toLocaleString("fr-FR")} F CFP demeure impayée depuis ${d.daysOverdue} jours.${d.lateFee ? `\n\nConformément aux conditions générales, des pénalités de retard d'un montant de ${Math.round(d.lateFee).toLocaleString("fr-FR")} F CFP s'appliquent à compter de cette date.` : ""}

Sans règlement intégral sous 48 heures, nous engagerons sans préavis supplémentaire une procédure de recouvrement judiciaire.`,
    cta: "Régulariser immédiatement",
    ctaStyle: "#7f1d1d",
  },
};

export function InvoiceReminderEmail({ data }: { data: InvoiceReminderData }) {
  const cfg = LEVEL_CONFIG[data.level];
  const previewText = cfg.preview(data.invoiceNumber);

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Badge niveau */}
          <Section style={{ marginBottom: "16px" }}>
            <span style={{ ...badge, backgroundColor: cfg.badgeColor }}>{cfg.badge}</span>
          </Section>

          <Heading style={h1}>{cfg.title}</Heading>

          <Hr style={hr} />

          {/* Infos facture */}
          <Section style={infoBox}>
            <Text style={infoRow}><span style={infoLabel}>Facture N°</span> {data.invoiceNumber}</Text>
            <Text style={infoRow}><span style={infoLabel}>Montant TTC</span> {Math.round(data.totalTtc).toLocaleString("fr-FR")} F CFP</Text>
            <Text style={infoRow}><span style={infoLabel}>Échéance</span> {data.dueDate}</Text>
            <Text style={infoRow}><span style={infoLabel}>Retard</span> {data.daysOverdue} jour{data.daysOverdue > 1 ? "s" : ""}</Text>
          </Section>

          <Hr style={hr} />

          {/* Corps du message */}
          <Section style={{ marginBottom: "24px" }}>
            <Text style={greeting}>Madame, Monsieur {data.customerName},</Text>
            {cfg.body(data).split("\n\n").map((para, i) => (
              <Text key={i} style={bodyText}>{para}</Text>
            ))}
          </Section>

          {/* CTA */}
          {data.portalLink && (
            <Section style={actionsSection}>
              <Link href={data.portalLink} style={{ ...button, backgroundColor: cfg.ctaStyle }}>
                {cfg.cta}
              </Link>
            </Section>
          )}

          <Hr style={hr} />

          {/* Footer */}
          <Section style={footerSection}>
            <Text style={footerText}>
              {data.teamName}
              {data.teamEmail && ` — ${data.teamEmail}`}
              {data.teamPhone && ` — ${data.teamPhone}`}
            </Text>
            <Text style={footerMuted}>
              Ce courrier est une communication officielle. En cas d&apos;erreur, contactez-nous sans délai.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ── Styles ──

const main = {
  backgroundColor: "#f4f5f7",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  padding: "20px 0",
};

const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  margin: "0 auto",
  maxWidth: "600px",
  padding: "32px",
};

const badge = {
  display: "inline-block",
  padding: "4px 12px",
  borderRadius: "4px",
  color: "#ffffff",
  fontSize: "11px",
  fontWeight: "700" as const,
  letterSpacing: "1.5px",
};

const h1 = {
  fontSize: "22px",
  fontWeight: "700" as const,
  color: "#111827",
  margin: "0 0 16px",
};

const hr = { borderColor: "#e5e7eb", margin: "16px 0" };

const infoBox = {
  backgroundColor: "#f9fafb",
  borderRadius: "6px",
  padding: "12px 16px",
  marginBottom: "20px",
};

const infoRow = {
  fontSize: "13px",
  color: "#1f2937",
  margin: "4px 0",
};

const infoLabel = {
  fontWeight: "600" as const,
  color: "#6b7280",
  display: "inline-block",
  width: "120px",
};

const greeting = {
  fontSize: "14px",
  color: "#374151",
  margin: "0 0 12px",
  fontWeight: "600" as const,
};

const bodyText = {
  fontSize: "14px",
  color: "#374151",
  lineHeight: "1.6",
  margin: "0 0 12px",
};

const actionsSection = {
  textAlign: "center" as const,
  marginBottom: "24px",
};

const button = {
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: "600" as const,
  padding: "12px 28px",
  textDecoration: "none",
};

const footerSection = { textAlign: "center" as const };
const footerText = { fontSize: "12px", color: "#6b7280", margin: "0 0 4px" };
const footerMuted = { fontSize: "11px", color: "#9ca3af", margin: "0" };
