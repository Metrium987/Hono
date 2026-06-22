import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export type PortalMagicLinkEmailData = {
  customerName: string | null;
  magicLink: string;
  /** ISO locale ("fr" or other) — drives copy. Defaults to "fr". */
  locale?: string;
};

const isFr = (locale?: string) => (locale ?? "fr") === "fr";

export function PortalMagicLinkEmail({ data }: { data: PortalMagicLinkEmailData }) {
  const fr = isFr(data.locale);
  const previewText = fr
    ? "Votre lien de connexion Hono"
    : "Your Hono login link";

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={heading}>
              {fr ? "Connexion à votre espace client" : "Log in to your client area"}
            </Heading>
          </Section>

          <Text style={paragraph}>
            {fr ? "Bonjour" : "Hello"}
            {data.customerName ? ` ${data.customerName}` : ""},
          </Text>

          <Text style={paragraph}>
            {fr
              ? "Cliquez sur le bouton ci-dessous pour vous connecter :"
              : "Click the button below to log in:"}
          </Text>

          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Button href={data.magicLink} style={button}>
              {fr ? "Se connecter" : "Log in"}
            </Button>
          </Section>

          <Text style={muted}>
            {fr
              ? "Ce lien expire dans 15 minutes."
              : "This link expires in 15 minutes."}
          </Text>

          <Hr style={hr} />

          <Text style={footer}>
            {fr
              ? "Si vous n'avez pas demandé cette connexion, ignorez cet email."
              : "If you did not request this login, ignore this email."}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily: "Arial, sans-serif",
  padding: "20px 0",
} as const;

const container = {
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  maxWidth: "480px",
  margin: "0 auto",
  padding: "32px",
} as const;

const header = {
  marginBottom: "8px",
} as const;

const heading = {
  fontSize: "20px",
  fontWeight: 600,
  color: "#111827",
  margin: "0",
} as const;

const paragraph = {
  fontSize: "15px",
  lineHeight: "24px",
  color: "#374151",
  margin: "12px 0",
} as const;

const button = {
  display: "inline-block",
  backgroundColor: "#0d7a63",
  color: "#ffffff",
  padding: "12px 24px",
  borderRadius: "6px",
  fontSize: "15px",
  fontWeight: 600,
  textDecoration: "none",
} as const;

const muted = {
  fontSize: "14px",
  color: "#6b7280",
  margin: "16px 0 0",
} as const;

const hr = {
  borderColor: "#e5e7eb",
  margin: "24px 0",
} as const;

const footer = {
  fontSize: "12px",
  color: "#9ca3af",
  margin: "0",
} as const;
