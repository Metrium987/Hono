import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const perm = await checkPagePermission("settings", "read");
  if (!perm.allowed) return <ForbiddenPage module="settings" />;
  return <>{children}</>;
}
