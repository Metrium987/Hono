import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { createAdminClient } from "@/utils/supabase/admin";

const BUCKET = "product-images";
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

type Params = Promise<{ id: string }>;

// GET /api/v1/products/[id]/image — List product images
export async function GET(request: NextRequest, { params }: { params: Params }) {
  const { id: productId } = await params;

  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "catalog", "read");

    const { data, error } = await auth.supabase
      .from("product_images")
      .select("id, storage_path, position, alt_text")
      .eq("product_id", productId)
      .order("position", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const enriched = (data ?? []).map((img) => ({
      ...img,
      public_url: `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${img.storage_path}`,
    }));

    return NextResponse.json({ data: enriched });
  });
}

// POST /api/v1/products/[id]/image — Upload a product image
export async function POST(request: NextRequest, { params }: { params: Params }) {
  const { id: productId } = await params;

  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "catalog", "write");

    // Verify product belongs to team
    const { data: product, error: productError } = await auth.supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("team_id", teamId)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum 5MB" },
        { status: 400 }
      );
    }

    // Get next position
    const { count } = await auth.supabase
      .from("product_images")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId);

    const position = count ?? 0;

    // Build storage path: team_id/product_id/timestamp_filename
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const storagePath = `${teamId}/${productId}/${Date.now()}.${ext}`;

    // Upload via admin client (bypasses storage RLS)
    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Insert record in product_images
    const { data: imageRow, error: dbError } = await auth.supabase
      .from("product_images")
      .insert({
        product_id: productId,
        storage_path: storagePath,
        position,
        alt_text: (formData.get("alt_text") as string | null) ?? null,
      })
      .select("id, storage_path, position, alt_text")
      .single();

    if (dbError) {
      // Clean up orphaned storage object
      await admin.storage.from(BUCKET).remove([storagePath]);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;

    return NextResponse.json({ data: { ...imageRow, public_url: publicUrl } }, { status: 201 });
  });
}

// DELETE /api/v1/products/[id]/image?image_id=xxx — Remove a product image
export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  const { id: productId } = await params;
  const imageId = new URL(request.url).searchParams.get("image_id");

  if (!imageId) {
    return NextResponse.json({ error: "image_id query param required" }, { status: 400 });
  }

  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "catalog", "write");

    // Verify product belongs to team
    const { data: product } = await auth.supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("team_id", teamId)
      .single();

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Get the image record to know the storage path
    const { data: image } = await auth.supabase
      .from("product_images")
      .select("id, storage_path")
      .eq("id", imageId)
      .eq("product_id", productId)
      .single();

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Delete from storage
    const admin = createAdminClient();
    await admin.storage.from(BUCKET).remove([image.storage_path]);

    // Delete DB record
    await auth.supabase
      .from("product_images")
      .delete()
      .eq("id", imageId);

    return NextResponse.json({ success: true });
  });
}
