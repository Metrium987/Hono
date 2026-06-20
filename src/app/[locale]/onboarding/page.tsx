"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ISLANDS_PF = [
  "Tahiti", "Moorea", "Bora Bora", "Huahine", "Raiatea", "Taha'a", "Maupiti",
  "Rangiroa", "Fakarava", "Tikehau", "Manihi", "Nuku Hiva", "Hiva Oa",
  "Rurutu", "Tubuai", "Raivavae", "Autre",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    n_tahiti: "",
    address_line1: "",
    city: "",
    island: "Tahiti",
    email: "",
    phone: "",
  });

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Le nom de l'entreprise est obligatoire.");
      return;
    }
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push("/fr/login");
      return;
    }

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .insert({
        name: form.name.trim(),
        n_tahiti: form.n_tahiti.trim() || null,
        address_line1: form.address_line1.trim() || null,
        city: form.city.trim() || null,
        island: form.island || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        country: "French Polynesia",
      })
      .select("id")
      .single();

    if (teamError || !team) {
      setError("Erreur lors de la création de l'entreprise : " + (teamError?.message ?? "inconnue"));
      setLoading(false);
      return;
    }

    const { error: memberError } = await supabase
      .from("team_members")
      .insert({
        team_id: team.id,
        user_id: user.id,
        is_owner: true,
      });

    if (memberError) {
      setError("Erreur lors de l'association au compte : " + memberError.message);
      setLoading(false);
      return;
    }

    // Seed default currencies, TVA rates and payment methods for PF
    await supabase.rpc("initialize_team", { p_team_id: team.id });

    router.push("/fr/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Configurer votre entreprise</CardTitle>
          <CardDescription>
            Ces informations apparaîtront sur vos factures et devis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">
                Nom de l&apos;entreprise <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Ma Société SAS"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="n_tahiti">N° Tahiti</Label>
              <Input
                id="n_tahiti"
                placeholder="123456"
                value={form.n_tahiti}
                onChange={(e) => update("n_tahiti", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="island">Île</Label>
                <select
                  id="island"
                  value={form.island}
                  onChange={(e) => update("island", e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {ISLANDS_PF.map((island) => (
                    <option key={island} value={island}>{island}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Commune</Label>
                <Input
                  id="city"
                  placeholder="Papeete"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_line1">Adresse</Label>
              <Input
                id="address_line1"
                placeholder="BP 1234"
                value={form.address_line1}
                onChange={(e) => update("address_line1", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email professionnel</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="contact@societe.pf"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  placeholder="+689 87 00 00 00"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Création en cours..." : "Créer mon espace de gestion"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
