// Supabase Edge Function: generate-pdf
//
// Architecture: Next.js PDF routes authenticate the request, fetch document data from
// Supabase, then POST the pre-fetched JSON here. This function renders the PDF and
// returns the binary — avoiding Vercel Hobby's 10s execution timeout.
//
// Auth: server-to-server only. Caller must present SUPABASE_SERVICE_ROLE_KEY as Bearer.
//
// Request: POST
//   Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
//   Content-Type: application/json
//   Body: { type: "invoice" | "quote" | "credit_note", data: <document JSON> }
//
// Response: application/pdf binary (or JSON error)
//
// The deno.json in this directory maps bare specifiers (react, @react-pdf/renderer)
// to npm: imports so the PDF components from ../../src/lib/pdf/ can be imported directly.

import { createElement } from "npm:react@18";
import { pdf } from "npm:@react-pdf/renderer@4";
import { InvoicePdfDocument } from "../../src/lib/pdf/invoice-pdf.tsx";
import { QuotePdfDocument } from "../../src/lib/pdf/quote-pdf.tsx";
import { CreditNotePdfDocument } from "../../src/lib/pdf/credit-note-pdf.tsx";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  // Server-to-server: verify the service role key presented by the Next.js proxy.
  const authHeader = req.headers.get("authorization") ?? "";
  const expectedKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
    return jsonError("Unauthorized", 401);
  }

  let body: { type: string; data: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const { type, data } = body;
  if (!type || !data) {
    return jsonError("Missing type or data", 400);
  }

  try {
    let pdfBlob: Blob;
    let filename: string;

    if (type === "invoice") {
      // deno-lint-ignore no-explicit-any
      pdfBlob = await pdf(createElement(InvoicePdfDocument, { data: data as any })).toBlob();
      filename = `facture-${String(data.invoice_number ?? "").replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;
    } else if (type === "quote") {
      // deno-lint-ignore no-explicit-any
      pdfBlob = await pdf(createElement(QuotePdfDocument, { data: data as any })).toBlob();
      filename = `devis-${String(data.quote_number ?? "").replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;
    } else if (type === "credit_note") {
      // deno-lint-ignore no-explicit-any
      pdfBlob = await pdf(createElement(CreditNotePdfDocument, { data: data as any })).toBlob();
      filename = `avoir-${String(data.credit_note_number ?? "").replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;
    } else {
      return jsonError(`Unknown document type: ${type}`, 400);
    }

    const bytes = await pdfBlob.arrayBuffer();
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(bytes.byteLength),
        ...CORS_HEADERS,
      },
    });
  } catch (err) {
    console.error("[generate-pdf] Render error:", err);
    return jsonError("PDF generation failed", 500);
  }
});
