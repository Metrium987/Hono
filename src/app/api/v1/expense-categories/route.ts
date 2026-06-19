import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

// GET /api/v1/expense-categories — List expense categories
export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "expenses", "read");
    const { data, error } = await auth.supabase
      .from("expense_categories")
      .select("*")
      .eq("team_id", teamId)
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  });
}

// POST /api/v1/expense-categories — Create an expense category
export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "expenses", "write");
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("expense_categories")
      .insert({ team_id: teamId, name })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  });
}

// DELETE /api/v1/expense-categories?id=xxx — Delete an expense category
export async function DELETE(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "expenses", "write");
    const id = params.get("id");
    if (!id) {
      return NextResponse.json({ error: "id query param is required" }, { status: 400 });
    }

    const { error } = await auth.supabase
      .from("expense_categories")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  });
}
