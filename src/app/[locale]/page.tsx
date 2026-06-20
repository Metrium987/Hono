import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Store, User, Briefcase, CheckCircle, AlertCircle } from "lucide-react";

export default async function Home() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const t = await getTranslations("common");

  const { data: currencies, error } = await supabase.from("currencies").select();

  return (
    <main className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background patterns */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-[#0c0a09]/50 via-[#09090b] to-[#09090b] pointer-events-none" />

      <div className="max-w-4xl w-full text-center space-y-12 z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center justify-center rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-xs font-semibold text-primary tracking-wide uppercase">
            Polynésie Française
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-white via-[#f4f4f5] to-[#71717a] bg-clip-text text-transparent">
            {t("app_name")}
          </h1>
          <p className="text-lg md:text-xl text-[#a1a1aa] max-w-2xl mx-auto font-light leading-relaxed">
            La première plateforme ERP & E-commerce native pour l'IA, adaptée aux spécificités fiscales et juridiques du Fenua.
          </p>
        </div>

        {/* Database Connection Test Status */}
        <div className="max-w-md mx-auto rounded-xl border border-border/40 bg-card/30 backdrop-blur-md p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            {error ? (
              <AlertCircle className="h-5 w-5 text-destructive animate-pulse" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )}
            <div className="text-left">
              <p className="text-xs font-medium text-[#71717a]">Statut Supabase</p>
              <p className="text-sm font-semibold">
                {error ? "Erreur de connexion" : "Base de données connectée"}
              </p>
            </div>
          </div>
          {!error && (
            <div className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
              {currencies && currencies.length > 0 ? `${currencies.length} devise(s)` : "OK"}
            </div>
          )}
        </div>

        {/* Action cards */}
        <div className="grid gap-6 md:grid-cols-3 max-w-3xl mx-auto w-full pt-4">
          {/* Card 1: Storefront */}
          <Link
            href="./products"
            className="group relative flex flex-col items-center p-8 rounded-2xl border border-border/40 bg-card/20 hover:bg-card/40 transition-all duration-300 shadow-md hover:-translate-y-1 hover:border-primary/40"
          >
            <div className="p-4 rounded-xl bg-primary/10 text-primary mb-4 group-hover:scale-110 transition-transform">
              <Store className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold group-hover:text-primary transition-colors">Boutique en ligne</h2>
            <p className="text-xs text-[#71717a] mt-2 text-center leading-relaxed">
              Parcourir le catalogue de produits et faire une demande de devis en ligne.
            </p>
          </Link>

          {/* Card 2: Client Portal */}
          <Link
            href="./portal/auth"
            className="group relative flex flex-col items-center p-8 rounded-2xl border border-border/40 bg-card/20 hover:bg-card/40 transition-all duration-300 shadow-md hover:-translate-y-1 hover:border-primary/40"
          >
            <div className="p-4 rounded-xl bg-primary/10 text-primary mb-4 group-hover:scale-110 transition-transform">
              <User className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold group-hover:text-primary transition-colors">Portail Client</h2>
            <p className="text-xs text-[#71717a] mt-2 text-center leading-relaxed">
              Consulter l'historique de vos devis, factures, paiements et bons de commande.
            </p>
          </Link>

          {/* Card 3: ERP Backoffice */}
          <Link
            href="./login"
            className="group relative flex flex-col items-center p-8 rounded-2xl border border-border/40 bg-card/20 hover:bg-card/40 transition-all duration-300 shadow-md hover:-translate-y-1 hover:border-primary/40"
          >
            <div className="p-4 rounded-xl bg-primary/10 text-primary mb-4 group-hover:scale-110 transition-transform">
              <Briefcase className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold group-hover:text-primary transition-colors">Console ERP</h2>
            <p className="text-xs text-[#71717a] mt-2 text-center leading-relaxed">
              Espace de gestion interne pour les factures, devis, comptabilité et inventaires.
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}
