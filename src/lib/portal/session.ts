import { cookies } from "next/headers";
import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const SESSION_COOKIE = "hono_portal";
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 3600; // 7 days

export type PortalSession = {
  portalUserId: string;
  customerId: string;
  email: string;
  name: string | null;
  teamId: string;
};

/**
 * Derive a 32-byte encryption key from PORTAL_COOKIE_SECRET or a fallback.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.PORTAL_COOKIE_SECRET ?? "dev-portal-secret-change-in-production-!!";
  return createHash("sha256").update(secret).digest();
}

/**
 * Encrypt a PortalSession payload into a cookie string.
 */
export function encryptSession(session: PortalSession): string {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  const payload = JSON.stringify(session);
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  // Prepend IV to the ciphertext (hex-encoded)
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

/**
 * Decrypt a cookie string back into a PortalSession. Returns null on failure.
 */
function decryptSession(encrypted: string): PortalSession | null {
  try {
    const key = getEncryptionKey();
    const [ivHex, dataHex] = encrypted.split(":");
    if (!ivHex || !dataHex) return null;
    const iv = Buffer.from(ivHex, "hex");
    const encryptedText = Buffer.from(dataHex, "hex");
    const decipher = createDecipheriv("aes-256-cbc", key, iv);
    const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8")) as PortalSession;
  } catch {
    return null;
  }
}

/**
 * Get the current portal session from cookies (server-side only).
 * Returns null if no valid session exists.
 */
export async function getPortalSession(): Promise<PortalSession | null> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(SESSION_COOKIE)?.value;
    if (!raw) return null;
    return decryptSession(raw);
  } catch {
    return null;
  }
}

/**
 * Set the portal session cookie on a Response.
 */
export function setPortalSessionCookie(session: PortalSession): Response {
  const encrypted = encryptSession(session);
  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encrypted}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}`
  );
  return new Response(null, { headers });
}

/**
 * Clear the portal session cookie.
 */
export function clearPortalSessionCookie(): Response {
  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
  );
  return new Response(null, { headers });
}

/**
 * Redirect to the portal auth page if no valid session exists.
 * Returns the session if valid, otherwise redirects.
 */
export async function requirePortalSession(): Promise<PortalSession> {
  const session = await getPortalSession();
  if (!session) {
    throw new Error("No portal session");
  }
  return session;
}
