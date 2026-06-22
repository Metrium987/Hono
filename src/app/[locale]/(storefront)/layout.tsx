import { CartProvider } from "@/lib/cart/cart-context";
import { StorefrontHeader } from "./storefront-header";
import { StorefrontFooter } from "./storefront-footer";
import { getPortalSession } from "@/lib/portal/session";

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const portalSession = await getPortalSession();
  const isPortalLoggedIn = !!portalSession;

  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col">
        <StorefrontHeader
          isPortalLoggedIn={isPortalLoggedIn}
          portalCustomerName={portalSession?.name ?? null}
        />
        <main className="flex-1">{children}</main>
        <StorefrontFooter />
      </div>
    </CartProvider>
  );
}
