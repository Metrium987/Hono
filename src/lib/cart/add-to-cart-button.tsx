"use client";

import { ShoppingCart, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart/cart-context";
import { useState } from "react";

type AddToCartButtonProps = {
  productId: string;
  name: string;
  priceHt: number;
  imageUrl?: string;
  sku?: string;
  disabled?: boolean;
};

export function AddToCartButton({ productId, name, priceHt, imageUrl, sku, disabled }: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  function handleClick() {
    if (disabled) return;
    addItem({ productId, name, priceHt, imageUrl, sku });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  if (disabled) {
    return (
      <Button className="flex-1" variant="secondary" disabled>
        <X className="mr-2 h-4 w-4" />
        Rupture de stock
      </Button>
    );
  }

  return (
    <Button onClick={handleClick} className="flex-1" variant={added ? "secondary" : "default"}>
      {added ? (
        <>
          <Check className="mr-2 h-4 w-4" />
          Ajouté !
        </>
      ) : (
        <>
          <ShoppingCart className="mr-2 h-4 w-4" />
          Ajouter au panier
        </>
      )}
    </Button>
  );
}
