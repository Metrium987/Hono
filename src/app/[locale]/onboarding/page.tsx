import { Building2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function OnboardingPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Bienvenue sur Hono</CardTitle>
          <CardDescription>
            Vous n&apos;êtes encore membre d&apos;aucune équipe. Pour commencer :
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="rounded-lg border p-4 space-y-2">
              <h3 className="font-semibold text-sm">1. Créer votre entreprise</h3>
              <p className="text-sm text-muted-foreground">
                Créez votre équipe et commencez à gérer vos factures, devis et clients.
              </p>
              <Button className="w-full mt-2" asChild>
                <Link href={`/${locale}/settings/company`}>
                  Créer mon entreprise
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <h3 className="font-semibold text-sm">2. Accepter une invitation</h3>
              <p className="text-sm text-muted-foreground">
                Si un collègue vous a invité, vérifiez vos emails pour le lien d&apos;invitation.
              </p>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <h3 className="font-semibold text-sm">3. Contacter le support</h3>
              <p className="text-sm text-muted-foreground">
                Si vous avez besoin d&apos;aide, écrivez-nous à contact@hono.pf
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
