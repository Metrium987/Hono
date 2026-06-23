import { Mail, Phone, MapPin, Clock, ChevronRight } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <div className="text-center mb-10">
        <h1 className="text-[28px] font-semibold tracking-tight text-wrap-balance">Contact</h1>
        <p className="mt-2 text-[15px] text-muted-foreground max-w-sm mx-auto">
          Une question, une demande spéciale ? N&apos;hésitez pas à nous contacter.
        </p>
      </div>

      <div className="rounded-xl border divide-y bg-card overflow-hidden">
        <a
          href="mailto:contact@hono.pf"
          className="flex items-center gap-4 px-5 py-4 hover:bg-accent/50 transition-colors group"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/10">
            <Mail className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-medium">Email</p>
            <p className="text-[13px] text-muted-foreground">contact@hono.pf</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-muted-foreground transition-colors" />
        </a>

        <a
          href="tel:+68940000000"
          className="flex items-center gap-4 px-5 py-4 hover:bg-accent/50 transition-colors group"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/10">
            <Phone className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-medium">Téléphone</p>
            <p className="text-[13px] text-muted-foreground">+689 40 00 00 00</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-muted-foreground transition-colors" />
        </a>

        <div className="flex items-center gap-4 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/10">
            <MapPin className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-medium">Adresse</p>
            <p className="text-[13px] text-muted-foreground">Papeete, Tahiti · Polynésie française</p>
          </div>
        </div>

        <div className="flex items-center gap-4 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/10">
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-medium">Horaires</p>
            <p className="text-[13px] text-muted-foreground">Lun–Ven : 7h30–16h00 · Sam–Dim : Fermé</p>
          </div>
        </div>
      </div>
    </div>
  );
}
