import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // Only "fr" is active. "ty" (Tahitian) and "mq" (Marquesan) translation files
  // are empty stubs — they remain in src/locales/ for future translation but
  // are removed from routing so users never land on untranslated pages.
  locales: ["fr"],
  defaultLocale: "fr",
  localePrefix: "always",
});
