import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { ClientForbiddenPage } from "@/components/erp/client-forbidden";

// --- Mocks ---

function createMockTranslations() {
  const translations: Record<string, string> = {
    title: "Accès refusé",
    description: "Vous n'avez pas l'autorisation de {action} {module}.",
    contact_owner: "Contactez le propriétaire de l'équipe pour demander l'accès.",
    module_fallback: 'le module "{module}"',
    action_read: "consulter",
    action_write: "modifier",
    module_invoices: "les factures",
    module_catalog: "le catalogue",
    module_clients: "les clients",
  };

  const t = (key: string, params?: Record<string, unknown>) => {
    const value = translations[key];
    if (value === undefined) return key;
    if (!params) return value;
    let result = value;
    Object.entries(params).forEach(([k, v]) => {
      result = result.replace(`{${k}}`, String(v));
    });
    return result;
  };
  t.has = (key: string) => key in translations && translations[key] !== undefined;
  t.rich = (key: string, params?: Record<string, unknown>) => t(key, params);

  return t;
}

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => createMockTranslations()),
}));

// Mock shadcn Card components
vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-header">{children}</div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="card-title" className={className}>{children}</h2>
  ),
  CardDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <p data-testid="card-description" className={className}>{children}</p>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-content">{children}</div>
  ),
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  ShieldAlert: () => <svg data-testid="shield-alert" />,
}));

// --- Tests ---

describe("ClientForbiddenPage (client component)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the title 'Accès refusé'", () => {
    render(<ClientForbiddenPage module="invoices" />);
    expect(screen.getByText("Accès refusé")).toBeInTheDocument();
  });

  it("renders the contact message", () => {
    render(<ClientForbiddenPage module="invoices" />);
    expect(
      screen.getByText(
        "Contactez le propriétaire de l'équipe pour demander l'accès."
      )
    ).toBeInTheDocument();
  });

  it("renders the ShieldAlert icon", () => {
    render(<ClientForbiddenPage module="invoices" />);
    expect(screen.getByTestId("shield-alert")).toBeInTheDocument();
  });

  it("uses the known module translation ('les factures') for 'invoices'", () => {
    render(<ClientForbiddenPage module="invoices" />);
    expect(
      screen.getByText(
        "Vous n'avez pas l'autorisation de consulter les factures."
      )
    ).toBeInTheDocument();
  });

  it("uses the known module translation ('le catalogue') for 'catalog'", () => {
    render(<ClientForbiddenPage module="catalog" />);
    expect(
      screen.getByText(
        "Vous n'avez pas l'autorisation de consulter le catalogue."
      )
    ).toBeInTheDocument();
  });

  it("falls back to module_fallback for unknown modules", () => {
    render(<ClientForbiddenPage module="custom_section" />);
    expect(
      screen.getByText(
        'Vous n\'avez pas l\'autorisation de consulter le module "custom_section".'
      )
    ).toBeInTheDocument();
  });

  it("uses 'write' action label when action='write'", () => {
    render(<ClientForbiddenPage module="invoices" action="write" />);
    expect(
      screen.getByText(
        "Vous n'avez pas l'autorisation de modifier les factures."
      )
    ).toBeInTheDocument();
  });

  it("renders within a Card container", () => {
    render(<ClientForbiddenPage module="invoices" />);
    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.getByTestId("card-header")).toBeInTheDocument();
    expect(screen.getByTestId("card-content")).toBeInTheDocument();
  });

  it("has the correct default action 'read'", () => {
    render(<ClientForbiddenPage module="invoices" />);
    expect(
      screen.getByText(/consulter/)
    ).toBeInTheDocument();
  });
});
