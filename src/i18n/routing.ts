import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "ty", "mq"],
  defaultLocale: "fr",
  localePrefix: "always",
});
