"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Eye, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type ProductRow = {
  id: string;
  name: string;
  type: string;
  unit_price_ht: number;
  current_stock: number;
  track_stock: boolean;
  is_active: boolean;
  category: string | null;
};

type Props = {
  products: ProductRow[];
  currentPage: number;
  totalPages: number;
  baseUrl: string;
};

function formatCurrency(amount: number) {
  return amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " F";
}

export function ProductsListClient({ products, currentPage, totalPages, baseUrl }: Props) {
  const t = useTranslations("products_page");

  if (products.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">{t("no_products")}</p>;
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("th_name")}</TableHead>
            <TableHead>{t("th_category")}</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">{t("th_price")}</TableHead>
            <TableHead className="text-right">{t("th_stock")}</TableHead>
            <TableHead>{t("th_status")}</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  {p.name}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{p.category ?? "-"}</TableCell>
              <TableCell className="text-sm">{p.type === "service" ? "Service" : "Produit"}</TableCell>
              <TableCell className="text-right">{formatCurrency(p.unit_price_ht)}</TableCell>
              <TableCell className="text-right">
                {p.track_stock ? (
                  <span className={p.current_stock <= 5 ? "text-red-600 font-medium" : ""}>{p.current_stock}</span>
                ) : "-"}
              </TableCell>
              <TableCell>
                <Badge variant={p.is_active ? "success" : "secondary"}>{p.is_active ? "Actif" : "Inactif"}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" asChild>
                  <Link href={`${baseUrl}/${p.id}`}><Eye className="h-4 w-4" /></Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={currentPage <= 1} asChild={currentPage > 1}>
            {currentPage > 1 ? (
              <Link href={`${baseUrl}?page=${currentPage - 1}`}><ChevronLeft className="h-4 w-4" /></Link>
            ) : <span><ChevronLeft className="h-4 w-4" /></span>}
          </Button>
          <span className="text-sm text-muted-foreground">{currentPage} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={currentPage >= totalPages} asChild={currentPage < totalPages}>
            {currentPage < totalPages ? (
              <Link href={`${baseUrl}?page=${currentPage + 1}`}><ChevronRight className="h-4 w-4" /></Link>
            ) : <span><ChevronRight className="h-4 w-4" /></span>}
          </Button>
        </div>
      )}
    </div>
  );
}
