import { type NextRequest, NextResponse } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createHash } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { registerTools } from "@/lib/mcp/tools";

export const maxDuration = 60;

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createServerClient(url, key, { cookies: { getAll: () => [], setAll: () => {} } });
}

async function resolveApiKey(token: string) {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("verify_api_key", { p_token_hash: tokenHash });
  if (error || !data || data.length === 0) return null;

  const key = data[0] as {
    team_id: string;
    key_id: string;
    permissions: Record<string, string[]> | null;
    is_owner: boolean;
  };

  return {
    teamId: key.team_id,
    permissions: key.permissions ?? undefined,
    isOwner: key.is_owner,
    supabase,
  };
}

async function handleMcpRequest(request: Request): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Bearer token required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const auth = await resolveApiKey(authHeader.slice(7));
  if (!auth) {
    return new Response(JSON.stringify({ error: "Invalid or expired API key" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const server = new McpServer({
    name: "hono-erp",
    version: "1.0.0",
  });

  registerTools(server, auth.supabase, auth.teamId, auth.permissions, auth.isOwner);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — no sessions on serverless
    enableJsonResponse: true,      // return JSON instead of SSE for single requests
  });

  await server.connect(transport);
  const response = await transport.handleRequest(request);
  await server.close();

  return response;
}

export async function GET(request: NextRequest) {
  return handleMcpRequest(request as unknown as Request);
}

export async function POST(request: NextRequest) {
  return handleMcpRequest(request as unknown as Request);
}

export async function DELETE(request: NextRequest) {
  return handleMcpRequest(request as unknown as Request);
}
