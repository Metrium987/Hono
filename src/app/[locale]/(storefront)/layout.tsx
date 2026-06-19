import { CartProvider } from "@/lib/cart/cart-context";
import { StorefrontHeader } from "./storefront-header";
import { StorefrontFooter } from "./storefront-footer";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col">
        <StorefrontHeader />
        <main className="flex-1">{children}</main>
        <StorefrontFooter />
      </div>
    </CartProvider>
  );
}
