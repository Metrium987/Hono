"use client";

import { useState, Suspense } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail, CheckCircle2, Eye, EyeOff } from "lucide-react";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitationRedirect = searchParams.get("redirect") ?? searchParams.get("invitation_redirect");

  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffLoading, setStaffLoading] = useState(false);

  const [clientEmail, setClientEmail] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [clientLoading, setClientLoading] = useState(false);
  const [clientSent, setClientSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  async function handleStaffLogin(e: React.FormEvent) {
    e.preventDefault();
    setStaffError(null);
    setStaffLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: staffEmail,
      password: staffPassword,
    });

    if (error) {
      setStaffError("Email ou mot de passe incorrect.");
      setStaffLoading(false);
      return;
    }

    router.push(invitationRedirect ?? "/fr/invoices");
    router.refresh();
  }

  async function handleGoogleLogin() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function handleClientLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!clientEmail.trim()) return;
    setClientError(null);
    setClientLoading(true);

    try {
      const res = await fetch("/api/v1/portal/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: clientEmail.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setClientError(data.error ?? "Une erreur est survenue. Réessayez.");
        return;
      }

      setClientSent(true);
      if (data.devLink) setDevLink(data.devLink);
    } catch {
      setClientError("Erreur de connexion. Réessayez.");
    } finally {
      setClientLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background">
      {/* Subtle brand gradient in background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,oklch(0.52_0.13_158/0.08),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,oklch(0.52_0.13_158/0.05),transparent_50%)]" />

      <div className="relative w-full max-w-sm">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <div className="h-12 w-12 rounded-[0.875rem] bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xl font-bold tracking-tight">H</span>
            </div>
          </div>
          <h1 className="text-[1.5rem] font-bold tracking-tight">Hono</h1>
          <p className="text-sm text-muted-foreground mt-1">
            ERP &amp; facturation — Polynésie française
          </p>
        </div>

        {/* Auth card */}
        <div className="rounded-[0.75rem] border bg-card p-6">
          <Tabs defaultValue="client" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-5">
              <TabsTrigger value="client">Client</TabsTrigger>
              <TabsTrigger value="staff">Collaborateur</TabsTrigger>
            </TabsList>

            <TabsContent value="client" className="mt-0 space-y-4">
              {clientSent ? (
                <div className="text-center space-y-3 py-4">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
                  <p className="font-semibold">Lien envoyé !</p>
                  <p className="text-sm text-muted-foreground">
                    Vérifiez votre boîte mail <strong className="text-foreground">{clientEmail}</strong> et cliquez sur le lien pour vous connecter.
                  </p>
                  {devLink && (
                    <a
                      href={devLink}
                      className="block mt-2 text-xs text-primary underline break-all"
                    >
                      [DEV] Cliquez ici pour vous connecter
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => { setClientSent(false); setClientEmail(""); setDevLink(null); }}
                  >
                    Utiliser un autre email
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleClientLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="client-email">Adresse email</Label>
                    <Input
                      id="client-email"
                      type="email"
                      placeholder="vous@exemple.com"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      required
                      autoComplete="email"
                      autoFocus
                    />
                  </div>

                  {clientError && (
                    <p className="text-sm text-destructive">{clientError}</p>
                  )}

                  <Button type="submit" className="w-full" disabled={clientLoading}>
                    {clientLoading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Envoi en cours…</>
                    ) : (
                      <><Mail className="mr-2 h-4 w-4" />Recevoir mon lien de connexion</>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    Un compte client sera créé automatiquement si vous êtes nouveau.
                  </p>
                </form>
              )}
            </TabsContent>

            <TabsContent value="staff" className="mt-0 space-y-4">
              <form onSubmit={handleStaffLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="staff-email">Email</Label>
                  <Input
                    id="staff-email"
                    type="email"
                    placeholder="vous@exemple.com"
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-password">Mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="staff-password"
                      type={showPassword ? "text" : "password"}
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {staffError && (
                  <p className="text-sm text-destructive">{staffError}</p>
                )}

                <Button type="submit" className="w-full" disabled={staffLoading}>
                  {staffLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Connexion…</>
                  ) : (
                    "Se connecter"
                  )}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-2 text-muted-foreground">ou</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogleLogin}
                disabled={staffLoading}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continuer avec Google
              </Button>
            </TabsContent>
          </Tabs>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link href="/fr/privacy" className="hover:text-foreground transition-colors">Politique de confidentialité</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}
