import { Mail, Phone, MapPin, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold tracking-tight">Contact</h1>
        <p className="text-muted-foreground mt-3 max-w-lg mx-auto">
          Une question, une demande spéciale ? N&apos;hésitez pas à nous contacter.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold text-sm">Email</h3>
            <a href="mailto:contact@hono.pf" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              contact@hono.pf
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold text-sm">Téléphone</h3>
            <p className="text-sm text-muted-foreground">+689 40 00 00 00</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold text-sm">Adresse</h3>
            <p className="text-sm text-muted-foreground">Papeete, Tahiti<br />Polynésie française</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold text-sm">Horaires</h3>
            <p className="text-sm text-muted-foreground">Lun-Ven : 7h30 - 16h00<br />Sam-Dim : Fermé</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
