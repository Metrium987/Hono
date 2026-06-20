# Product

## Register

product

## Users

**ERP back-office (surface principale) :** Chefs d'entreprise, comptables et gestionnaires de TPE/PME en Polynésie française. Ils utilisent l'outil quotidiennement pour facturer, gérer un catalogue, suivre leurs clients, déclarer leurs charges et piloter leur trésorerie. Contexte de bureau ou mobile, souvent seuls devant l'écran, sous pression de délais légaux.

**Storefront + portail client (surface secondaire) :** Clients finaux (particuliers et professionnels) qui consultent le catalogue, passent des commandes et accèdent à leurs factures via le portail. Ils arrivent sans formation préalable ; l'interface doit être immédiatement compréhensible.

## Product Purpose

Hono est un ERP de facturation SaaS conçu spécifiquement pour les entreprises de Polynésie française. Il gère la chaîne complète devis → facture → paiement avec conformité légale intégrée : numérotation séquentielle, TVA PF (16 % / 13 % / 5 % / 1 % / 0 %), N° TAHITI, franchise en base, rétention 10 ans. Il expose aussi une vitrine publique et un portail client B2B pour les entreprises qui vendent en ligne.

Le succès se mesure à deux niveaux : les utilisateurs ERP finissent leurs tâches métier rapidement et sans erreur ; les clients du portail se retrouvent immédiatement dans leurs documents.

## Brand Personality

**Précis · Fiable · Local**

Ton : direct, professionnel, jamais froid. Hono parle le langage des entrepreneurs polynésiens — français métropolitain courant, terminologie locale correcte (XPF, N° TAHITI, TVA PF). Pas de marketing, pas de jargon SaaS. La confiance se gagne par la précision, pas par la décontraction.

Référence tonale : Indy / Dougs — outil métier adapté au contexte local, chaleureux sans être décontracté.

## Anti-references

- **Quickbooks / Sage** — interface vieillissante, UX des années 2010, tableaux oppressants, couleurs ternes
- **Notion / Linear** — minimalisme excessif inadapté aux données métier denses ; espace blanc au détriment de la lisibilité
- **SaaS générique clone Stripe/Vercel** — bleu foncé / blanc générique, look startup interchangeable sans identité
- **Shopify / WooCommerce** — esthétique boutique e-commerce générique ; le storefront Hono est un catalogue professionnel B2B, pas une marketplace grand public

## Design Principles

1. **Clarté opérationnelle** — Les données denses (listes de factures, tableaux de charges, récapitulatifs TVA) doivent être lisibles au premier coup d'œil. Hiérarchie claire, pas de surcharge visuelle.

2. **Confiance par la précision** — L'interface doit dégager sérieux et rigueur légale. Chaque chiffre, chaque ligne, chaque état de document doit être non ambigu. L'erreur de lecture coûte de l'argent.

3. **Chaleur locale sans folklore** — Le contexte polynésien se sent dans le vocabulaire et le ton, pas dans les visuels. Pas de turquoise-corail-frangipane. Une interface universellement professionnelle, mais qui ne se prend pas pour une startup berlinoise.

4. **Cohérence bi-surface** — ERP et storefront partagent les mêmes tokens, la même typographie, le même langage de composants. L'utilisateur qui passe de l'un à l'autre ne change pas d'univers.

5. **Densité respirable** — Le thème sombre permet des sessions longues sans fatigue oculaire. L'espace blanc est une ressource ; on ne le dépense pas par principe, on le dépense là où il aide à comprendre.

## Accessibility & Inclusion

- WCAG 2.1 niveau AA minimum
- Contraste ≥ 4,5:1 pour le texte courant ; ≥ 3:1 pour les grands titres et icônes interactives
- Thème sombre par défaut (sessions longues en bureau) — pas de light mode requis pour l'instant
- Respect systématique de `prefers-reduced-motion`
- Navigation clavier complète sur les formulaires métier critiques (saisie facture, devis)
