import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function PrivacyPolicyPage() {
  const t = await getTranslations("portal");

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href="./.."
          className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          ← {t("back_to_store")}
        </Link>
      </div>

      <article className="prose prose-sm max-w-none dark:prose-invert">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Politique de confidentialité</h1>
        <p className="text-sm text-muted-foreground mb-8">Dernière mise à jour : {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>

        <h2 className="text-xl font-semibold mt-8 mb-3">1. Responsable du traitement</h2>
        <p className="text-muted-foreground">
          Les données personnelles collectées via ce site sont traitées par l&apos;entreprise exploitant ce service,
          conformément à la loi du Pays n° 2009-6 du 14 janvier 2009 relative à la protection des données personnelles
          en Polynésie française, et au Règlement Général sur la Protection des Données (RGPD) applicable en France métropolitaine.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">2. Données collectées</h2>
        <p className="text-muted-foreground">Nous collectons les données suivantes :</p>
        <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
          <li>Informations d&apos;identification : nom, prénom, raison sociale</li>
          <li>Coordonnées : adresse email, numéro de téléphone, adresse postale</li>
          <li>Données de facturation : historique des commandes, factures, devis</li>
          <li>Données de connexion au portail client</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-3">3. Finalités du traitement</h2>
        <p className="text-muted-foreground">Vos données sont utilisées pour :</p>
        <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
          <li>Gestion de la relation commerciale (devis, commandes, factures)</li>
          <li>Accès au portail client</li>
          <li>Obligations légales et comptables (conservation 10 ans)</li>
          <li>Communication relative à vos commandes en cours</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-3">4. Base légale</h2>
        <p className="text-muted-foreground">
          Le traitement est fondé sur l&apos;exécution d&apos;un contrat commercial (article 6.1.b du RGPD)
          et le respect d&apos;obligations légales (article 6.1.c du RGPD) notamment en matière de comptabilité et de fiscalité.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">5. Durée de conservation</h2>
        <p className="text-muted-foreground">
          Les documents comptables (factures, avoirs) sont conservés pendant <strong>10 ans</strong> à compter
          de leur date d&apos;émission, conformément aux obligations légales en vigueur en Polynésie française.
          Les données du portail client sont conservées tant que le compte est actif.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">6. Destinataires des données</h2>
        <p className="text-muted-foreground">
          Vos données ne sont pas transmises à des tiers à des fins commerciales. Elles peuvent être partagées
          avec nos sous-traitants techniques (hébergement, emails transactionnels) dans le cadre de leurs
          obligations contractuelles et de confidentialité.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">7. Vos droits</h2>
        <p className="text-muted-foreground">
          Conformément à la réglementation applicable, vous disposez des droits suivants :
        </p>
        <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
          <li>Droit d&apos;accès à vos données personnelles</li>
          <li>Droit de rectification en cas d&apos;inexactitude</li>
          <li>Droit à l&apos;effacement dans les limites des obligations légales</li>
          <li>Droit d&apos;opposition au traitement</li>
          <li>Droit à la portabilité de vos données</li>
        </ul>
        <p className="text-muted-foreground mt-3">
          Pour exercer ces droits, contactez-nous à l&apos;adresse email indiquée dans vos documents commerciaux.
          Vous pouvez également adresser une réclamation à la CNIL (France) ou à l&apos;autorité compétente
          de Polynésie française.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">8. Sécurité</h2>
        <p className="text-muted-foreground">
          Vos données sont hébergées sur des serveurs sécurisés. Nous mettons en œuvre des mesures
          techniques et organisationnelles appropriées pour protéger vos données contre tout accès
          non autorisé, perte ou destruction.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">9. Cookies</h2>
        <p className="text-muted-foreground">
          Ce site utilise des cookies strictement nécessaires au fonctionnement du portail client
          (session d&apos;authentification). Aucun cookie publicitaire ou de traçage tiers n&apos;est utilisé.
        </p>
      </article>
    </div>
  );
}
