import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

export default async function CatalogImportLayout({ children }: { children: React.ReactNode }) {
  const perm = await checkPagePermission("catalog", "read");
  if (!perm.allowed) return <ForbiddenPage module="catalog" />;
  return <>{children}</>;
}
