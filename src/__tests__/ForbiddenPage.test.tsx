import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

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
    module_unknown_module: undefined as unknown as string,
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

  return t;
}

const mockT = createMockTranslations();

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => mockT),
}));

// Mock shadcn Card components (they use React.forwardRef which can be complex)
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

describe("ForbiddenPage (server component)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the title 'Accès refusé'", async () => {
    const element = await ForbiddenPage({ module: "invoices" });
    render(element);
    expect(screen.getByText("Accès refusé")).toBeInTheDocument();
  });

  it("renders the contact message", async () => {
    const element = await ForbiddenPage({ module: "invoices" });
    render(element);
    expect(
      screen.getByText(
        "Contactez le propriétaire de l'équipe pour demander l'accès."
      )
    ).toBeInTheDocument();
  });

  it("renders the ShieldAlert icon", async () => {
    const element = await ForbiddenPage({ module: "invoices" });
    render(element);
    expect(screen.getByTestId("shield-alert")).toBeInTheDocument();
  });

  it("uses the known module translation ('les factures') for 'invoices'", async () => {
    const element = await ForbiddenPage({ module: "invoices" });
    render(element);
    expect(
      screen.getByText(
        "Vous n'avez pas l'autorisation de consulter les factures."
      )
    ).toBeInTheDocument();
  });

  it("uses the known module translation ('le catalogue') for 'catalog'", async () => {
    const element = await ForbiddenPage({ module: "catalog" });
    render(element);
    expect(
      screen.getByText(
        "Vous n'avez pas l'autorisation de consulter le catalogue."
      )
    ).toBeInTheDocument();
  });

  it("falls back to module_fallback for unknown modules", async () => {
    const element = await ForbiddenPage({ module: "custom_section" });
    render(element);
    expect(
      screen.getByText(
        'Vous n\'avez pas l\'autorisation de consulter le module "custom_section".'
      )
    ).toBeInTheDocument();
  });

  it("uses 'write' action label when action='write'", async () => {
    const element = await ForbiddenPage({ module: "invoices", action: "write" });
    render(element);
    expect(
      screen.getByText(
        "Vous n'avez pas l'autorisation de modifier les factures."
      )
    ).toBeInTheDocument();
  });

  it("renders within a Card container", async () => {
    const element = await ForbiddenPage({ module: "invoices" });
    render(element);
    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.getByTestId("card-header")).toBeInTheDocument();
    expect(screen.getByTestId("card-content")).toBeInTheDocument();
  });
});
