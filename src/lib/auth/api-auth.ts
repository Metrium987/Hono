import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";

/**
 * Result of an API authentication attempt.
 */
export type AuthResult = {
  userId: string;
  teamId: string;
  roleId?: string;
  isOwner: boolean;
  permissions?: Record<string, string[]>;
  /** 'session' = cookie-based browser session, 'api_key' = Bearer token */
  authMethod: "session" | "api_key";
};

/**
 * Extended AuthResult with a pre-created Supabase client, so handlers
 * don't need to re-create it.
 */
export type AuthContext = AuthResult & {
  supabase: ReturnType<typeof createClient>;
};

/**
 * Error response for unauthorized requests.
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public status: number = 401
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Authenticate an API request using either:
 * 1. Cookie-based Supabase session (browser users)
 * 2. Bearer API key (external integrations, MCP, storefront)
 *
 * @throws AuthError if authentication fails
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<AuthContext> {
  const authHeader = request.headers.get("authorization");

  // Strategy 1: Bearer token (API key)
  if (authHeader?.startsWith("Bearer ")) {
    return authenticateWithApiKey(authHeader.slice(7));
  }

  // Strategy 2: Cookie-based session (browser)
  return authenticateWithSession();
}

/**
 * Create a Supabase client with the service_role key for API key auth.
 * This bypasses RLS because the API key was already verified via verify_api_key().
 */
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new AuthError("Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY not set", 500);
  }
  return createServerClient(supabaseUrl, serviceRoleKey, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  });
}

/**
 * Authenticate via Bearer API key.
 * Uses service_role key for subsequent queries to bypass RLS,
 * since the API key was already verified by verify_api_key RPC.
 */
async function authenticateWithApiKey(token: string): Promise<AuthContext> {
  const tokenHash = createHash("sha256").update(token).digest("hex");

  // Use anon key only for the RPC call (verify_api_key is SECURITY DEFINER)
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data, error } = await supabase.rpc("verify_api_key", {
    p_token_hash: tokenHash,
  });

  if (error || !data || data.length === 0) {
    throw new AuthError("Invalid or expired API key", 401);
  }

  const key = data[0] as {
    team_id: string;
    role_id: string;
    key_id: string;
    permissions: Record<string, string[]> | null;
    is_owner: boolean;
  };

  // Use service_role key for data queries (bypasses RLS since auth is verified)
  const adminSupabase = createAdminClient();

  return {
    userId: `api:${key.key_id}`,
    teamId: key.team_id,
    roleId: key.role_id,
    isOwner: key.is_owner,
    permissions: key.permissions ?? undefined,
    authMethod: "api_key",
    supabase: adminSupabase,
  };
}

/**
 * Authenticate via Supabase session cookie (browser).
 */
async function authenticateWithSession(): Promise<AuthContext> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new AuthError("Unauthorized — no valid session", 401);
  }

  return {
    userId: user.id,
    teamId: "",
    isOwner: false,
    authMethod: "session",
    supabase,
  };
}

/**
 * Verify that the authenticated user belongs to the given team.
 * For session auth, checks team_members. For API key auth, already verified.
 * Mutates the auth object in place to add isOwner, roleId, permissions.
 */
async function verifyTeamAccess(
  auth: AuthContext,
  teamId: string
): Promise<void> {
  if (auth.authMethod === "api_key") {
    if (auth.teamId !== teamId) {
      throw new AuthError("API key does not have access to this team", 403);
    }
    return;
  }

  // Session auth: verify team membership
  const { data, error } = await auth.supabase
    .from("team_members")
    .select("is_owner, role_id")
    .eq("user_id", auth.userId)
    .eq("team_id", teamId)
    .single();

  if (error || !data) {
    throw new AuthError("You do not have access to this team", 403);
  }

  auth.teamId = teamId;
  auth.isOwner = data.is_owner;

  if (data.role_id) {
    const { data: role } = await auth.supabase
      .from("team_roles")
      .select("name, permissions")
      .eq("id", data.role_id)
      .single();

    if (role) {
      auth.roleId = data.role_id;
      auth.permissions = role.permissions as Record<string, string[]>;
    }
  }
}

/**
 * Check if the authenticated user has a specific permission.
 * Owners always bypass permission checks.
 */
export function hasPermission(
  auth: AuthContext,
  module: string,
  action: "read" | "write"
): boolean {
  if (auth.isOwner) return true;
  if (!auth.permissions) return false;
  const perms = auth.permissions[module];
  return Array.isArray(perms) && perms.includes(action);
}

/**
 * Shortcut to require a permission inside a withAuth handler.
 * Throws AuthError(403) if the user lacks the permission.
 *
 * Usage:
 *   export async function GET(request: NextRequest) {
 *     return withAuth(request, async (auth, teamId) => {
 *       requirePermission(auth, "catalog", "read");
 *       // ... handler logic
 *     });
 *   }
 */
export function requirePermission(
  auth: AuthContext,
  module: string,
  action: "read" | "write"
): void {
  if (!hasPermission(auth, module, action)) {
    throw new AuthError("Forbidden: you do not have permission on " + module, 403);
  }
}

/**
 * Wrapper for API route handlers.
 * Authenticates the request, validates team_id, and provides an AuthContext
 * with a pre-created Supabase client so handlers don't need to create one.
 *
 * Usage:
 *   export async function GET(request: NextRequest) {
 *     return withAuth(request, async (auth, teamId, params) => {
 *       const { data } = await auth.supabase.from("products").select("*");
 *       return NextResponse.json({ data });
 *     });
 *   }
 */
export async function withAuth(
  request: NextRequest,
  handler: (
    auth: AuthContext,
    teamId: string,
    searchParams: URLSearchParams
  ) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const auth = await authenticateRequest(request);

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("team_id");

    if (!teamId) {
      return NextResponse.json({ error: "team_id is required" }, { status: 400 });
    }

    await verifyTeamAccess(auth, teamId);

    return await handler(auth, teamId, searchParams);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Auth error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
