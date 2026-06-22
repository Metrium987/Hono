import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkPagePermission } from "@/lib/auth/page-auth";

// --- Mocks ---

// Mock next/headers cookies()
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({})),
}));

// Helper to build the mock supabase chain
function createMockSupabase() {
  const mockSingle = vi.fn();
  const mockLimit = vi.fn(() => ({ single: mockSingle }));
  const mockEq = vi.fn(() => ({ limit: mockLimit }));
  const mockSelect = vi.fn(() => ({ eq: mockEq }));
  const mockFrom = vi.fn(() => ({ select: mockSelect }));
  const mockGetUser = vi.fn();
  const mockSupabase = {
    auth: { getUser: mockGetUser },
    from: mockFrom,
  };

  return {
    mockSupabase,
    mockGetUser,
    mockFrom,
    mockSelect,
    mockEq,
    mockLimit,
    mockSingle,
  };
}

const mocks = createMockSupabase();

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(() => mocks.mockSupabase),
}));

// --- Tests ---

describe("checkPagePermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Rebuild the query chain after clearAllMocks (which resets call info,
    // but we keep the .mockReturnValue implementations for chain continuity).
    // The second query calls .select().eq().single() WITHOUT .limit(),
    // so mockEq must expose both limit and single.
    mocks.mockFrom.mockReturnValue({ select: mocks.mockSelect });
    mocks.mockSelect.mockReturnValue({ eq: mocks.mockEq });
    mocks.mockEq.mockReturnValue({ limit: mocks.mockLimit, single: mocks.mockSingle });
    mocks.mockLimit.mockReturnValue({ single: mocks.mockSingle });
  });

  it("returns allowed: false + default values when no user is authenticated", async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await checkPagePermission("invoices", "read");

    expect(result.allowed).toBe(false);
    expect(result.isOwner).toBe(false);
    expect(result.teamId).toBe("");
    expect(result.permissions).toBeNull();
  });

  it("returns allowed: false when user has no team membership", async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mocks.mockSingle.mockResolvedValue({ data: null, error: null });

    const result = await checkPagePermission("invoices", "read");

    expect(result.allowed).toBe(false);
    expect(result.teamId).toBe("");
  });

  it("returns allowed: true for owners (bypasses permission checks)", async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mocks.mockSingle.mockResolvedValue({
      data: { team_id: "team-1", is_owner: true, role_id: null },
      error: null,
    });

    const result = await checkPagePermission("invoices", "read");

    expect(result.allowed).toBe(true);
    expect(result.isOwner).toBe(true);
    expect(result.teamId).toBe("team-1");
  });

  it("returns allowed: true when role has the required permission", async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mocks.mockSingle
      .mockResolvedValueOnce({
        data: { team_id: "team-1", is_owner: false, role_id: "role-1" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { permissions: { invoices: ["read", "write"] } },
        error: null,
      });

    const result = await checkPagePermission("invoices", "write");

    expect(result.allowed).toBe(true);
    expect(result.isOwner).toBe(false);
    expect(result.teamId).toBe("team-1");
    expect(result.permissions).toEqual({ invoices: ["read", "write"] });
  });

  it("returns allowed: false when user lacks the required action", async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mocks.mockSingle
      .mockResolvedValueOnce({
        data: { team_id: "team-1", is_owner: false, role_id: "role-1" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { permissions: { invoices: ["read"] } },
        error: null,
      });

    const result = await checkPagePermission("invoices", "write");

    expect(result.allowed).toBe(false);
  });

  it("returns allowed: false when module is not in permissions", async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mocks.mockSingle
      .mockResolvedValueOnce({
        data: { team_id: "team-1", is_owner: false, role_id: "role-1" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { permissions: { invoices: ["read"] } },
        error: null,
      });

    const result = await checkPagePermission("catalog", "read");

    expect(result.allowed).toBe(false);
  });

  it("returns allowed: false when user has no role_id (no permissions defined)", async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mocks.mockSingle.mockResolvedValueOnce({
      data: { team_id: "team-1", is_owner: false, role_id: null },
      error: null,
    });

    const result = await checkPagePermission("invoices", "read");

    expect(result.allowed).toBe(false);
  });

  it("handles missing permissions field in role gracefully", async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mocks.mockSingle
      .mockResolvedValueOnce({
        data: { team_id: "team-1", is_owner: false, role_id: "role-1" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { permissions: null },
        error: null,
      });

    const result = await checkPagePermission("invoices", "read");

    expect(result.allowed).toBe(false);
    expect(result.permissions).toBeNull();
  });
});
