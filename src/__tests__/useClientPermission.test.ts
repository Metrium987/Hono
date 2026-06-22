import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useClientPermission } from "@/hooks/use-client-permission";

// --- Mocks ---

const mockGetSession = vi.fn();

vi.mock("@/utils/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: { getSession: mockGetSession },
  })),
}));

// --- Tests ---

describe("useClientPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns loading: true + allowed: false initially", () => {
    // Prevent the session promise from resolving so initial state is captured
    mockGetSession.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useClientPermission("invoices", "read"));

    expect(result.current.loading).toBe(true);
    expect(result.current.allowed).toBe(false);
    expect(result.current.isOwner).toBe(false);
    expect(result.current.teamId).toBeNull();
  });

  it("returns allowed: false when no session exists", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

    const { result } = renderHook(() => useClientPermission("invoices", "read"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allowed).toBe(false);
    expect(result.current.isOwner).toBe(false);
    expect(result.current.teamId).toBeNull();
  });

  it("returns allowed: true for owner (bypasses permission checks)", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            app_metadata: {
              team_id: "team-1",
              is_owner: true,
              permissions: {},
            },
          },
        },
      },
      error: null,
    });

    const { result } = renderHook(() => useClientPermission("invoices", "read"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allowed).toBe(true);
    expect(result.current.isOwner).toBe(true);
    expect(result.current.teamId).toBe("team-1");
  });

  it("returns allowed: true when user has the required permission", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            app_metadata: {
              team_id: "team-1",
              is_owner: false,
              permissions: { invoices: ["read", "write"] },
            },
          },
        },
      },
      error: null,
    });

    const { result } = renderHook(() => useClientPermission("invoices", "write"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allowed).toBe(true);
    expect(result.current.isOwner).toBe(false);
  });

  it("returns allowed: false when user lacks the required action", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            app_metadata: {
              team_id: "team-1",
              is_owner: false,
              permissions: { invoices: ["read"] },
            },
          },
        },
      },
      error: null,
    });

    const { result } = renderHook(() => useClientPermission("invoices", "write"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allowed).toBe(false);
  });

  it("returns allowed: false when module is not in permissions", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            app_metadata: {
              team_id: "team-1",
              is_owner: false,
              permissions: { invoices: ["read"] },
            },
          },
        },
      },
      error: null,
    });

    const { result } = renderHook(() => useClientPermission("catalog", "read"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allowed).toBe(false);
  });

  it("returns allowed: false when app_metadata has no permissions field", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            app_metadata: {
              team_id: "team-1",
              is_owner: false,
            },
          },
        },
      },
      error: null,
    });

    const { result } = renderHook(() => useClientPermission("invoices", "read"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allowed).toBe(false);
  });

  it("handles getSession error gracefully", async () => {
    mockGetSession.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useClientPermission("invoices", "read"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allowed).toBe(false);
  });

  it("returns allowed: false when app_metadata is undefined", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            app_metadata: undefined,
          },
        },
      },
      error: null,
    });

    const { result } = renderHook(() => useClientPermission("invoices", "read"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allowed).toBe(false);
    expect(result.current.teamId).toBeNull();
  });
});
