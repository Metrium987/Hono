"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Eye, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type CustomerRow = {
  id: string;
  company_name: string | null;
  contact_name: string;
  email: string | null;
  phone: string | null;
  n_tahiti: string | null;
  portal_enabled: boolean | null;
  city: string | null;
};

type Props = {
  customers: CustomerRow[];
  currentPage: number;
  totalPages: number;
  baseUrl: string;
};

export function CustomersListClient({ customers, currentPage, totalPages, baseUrl }: Props) {
  const t = useTranslations("customers_page");

  if (customers.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">{t("no_customers")}</p>;
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("th_company")}</TableHead>
            <TableHead>{t("th_contact")}</TableHead>
            <TableHead>{t("th_email")}</TableHead>
            <TableHead>{t("th_phone")}</TableHead>
            <TableHead>{t("th_tahiti")}</TableHead>
            <TableHead>{t("th_portal")}</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {c.company_name ?? "-"}
                </div>
              </TableCell>
              <TableCell>{c.contact_name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{c.email ?? "-"}</TableCell>
              <TableCell className="text-sm">{c.phone ?? "-"}</TableCell>
              <TableCell className="text-sm">{c.n_tahiti ?? "-"}</TableCell>
              <TableCell>
                <Badge variant={c.portal_enabled ? "success" : "secondary"}>
                  {c.portal_enabled ? "Oui" : "Non"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" asChild>
                  <Link href={`${baseUrl}/${c.id}`}><Eye className="h-4 w-4" /></Link>
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
