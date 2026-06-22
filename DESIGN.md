---
name: Hono ERP
description: ERP de facturation SaaS pour les professionnels de Polynésie française
colors:
  jade-autorite: "oklch(0.52 0.13 158)"
  vide-ardoise: "oklch(0.12 0.008 162)"
  blanc-encre: "oklch(0.985 0 0)"
  surface-principale: "oklch(0.18 0.012 162)"
  surface-elevee: "oklch(0.26 0.014 162)"
  brume-jade: "oklch(0.68 0.035 162)"
  signal-rouge: "oklch(0.577 0.245 27.325)"
typography:
  display:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "clamp(1.25rem, 2.5vw, 2rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.01em"
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  sm: "0.375rem"
  md: "0.625rem"
  lg: "1rem"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.institution-blue}"
    textColor: "{colors.ink-white}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  button-primary-hover:
    backgroundColor: "oklch(0.46 0.245 262.881)"
    textColor: "{colors.ink-white}"
  button-secondary:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.ink-white}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.steel-fog}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  button-ghost-hover:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.ink-white}"
  card:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink-white}"
    rounded: "{rounded.md}"
    padding: "24px"
  input:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.ink-white}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
---

# Design System: Hono ERP

## 1. Overview

**Creative North Star: "La Tour de Contrôle Locale"**

Hono est construit pour des professionnels qui passent des heures dans l'interface. Le thème sombre (`oklch(0.145 0 0)`) n'est pas un choix stylistique — c'est un choix ergonomique : sessions longues, workflows documentaires lourds, luminosité variable des environnements de bureau en Polynésie. Le système refuse d'être décoratif. Chaque élément gagne sa place en portant de l'information.

La palette est une étude contrôlée en tonalité bleu-gris, avec un seul accent institutionnel qui n'apparaît que là où une autorité visuelle est nécessaire : actions primaires, états actifs, anneaux de focus. Les statuts communicent via des teintes sémantiques (vert, bleu, jaune, rouge) appliquées avec parcimonie sur le fond sombre. La typographie est une famille unique — Geist Sans — utilisée à travers les graisses et les tailles pour construire la hiérarchie sans changer de police.

Ce n'est pas un dashboard startup. Ce n'est pas un outil fintech qui prétend être approchable. C'est un ERP professionnel pour des gens qui maîtrisent leur métier, qui n'ont pas besoin d'être guidés à chaque clic, et qui veulent finir leur travail sans être distraits par l'interface elle-même.

**Key Characteristics:**
- Fond noir absolu (`oklch(0.145 0 0)`) — pas de nuance chaude, pas de tinte artificielle
- Un seul accent : Bleu Institution, jamais utilisé à plus de 15% d'une surface
- Élévation tonale : profondeur par la luminosité OKLCH, sans ombres
- Densité maîtrisée : données compactes avec un espacement micro cohérent
- Statut sémantique : la couleur sert exclusivement à signaler un état, jamais à décorer

## 2. Colors: La Palette Institutionnelle

Une palette monochrome bleu-gris avec un seul accent d'autorité. La teinte du fond est neutre pur ; la légère chrominance bleue des surfaces élevées est imperceptible mais unit visuellement le système.

### Primary
- **Bleu Institution** (`oklch(0.546 0.245 262.881)`): L'unique accent du système. Utilisé exclusivement sur les boutons d'action primaire, les états de navigation actifs, les anneaux de focus, et les liens texte. Sa rareté est sa force — quand il apparaît, il signifie "agis ici".

### Neutral
- **Vide Profond** (`oklch(0.145 0 0)`): Le fond de l'application. Noir quasi-absolu, chroma zéro. Aucune teinte chaude, aucune teinte froide — neutre par discipline.
- **Blanc Encre** (`oklch(0.985 0 0)`): Le texte principal et le texte sur surfaces primaires. Contraste ≥18:1 sur le fond.
- **Surface Élevée** (`oklch(0.205 0.042 265.755)`): Les cartes, les popovers, le fond des composants. Premier niveau d'élévation au-dessus du fond, avec une chrominance bleue infime (0.042) qui lie visuellement les surfaces à l'accent.
- **Surface Surélevée** (`oklch(0.269 0.021 257.438)`): Bordures, inputs, backgrounds secondaires, états hover des nav items. Deuxième niveau d'élévation.
- **Brume Acier** (`oklch(0.708 0.047 252.682)`): Texte secondaire, métadonnées, labels de navigation inactifs, placeholders. Contraste ≥4.5:1 sur Surface Élevée.
- **Rouge Signal** (`oklch(0.577 0.245 27.325)`): Actions destructives et états d'erreur uniquement. Même saturation que le Bleu Institution — symétrie intentionnelle entre l'action et l'alerte.

### Named Rules
**La Règle du Monochromatisme Discipliné.** Un seul accent coloré dans l'interface. Tout ajout d'une deuxième couleur d'accent — même subtile — rompt la hiérarchie visuelle. Les statuts ont des couleurs sémantiques, mais ce sont des données, pas du chrome.

**La Règle des Surfaces Sans Ombre.** La profondeur est communiquée par la luminosité OKLCH (fond → surface élevée → surface surélevée), jamais par des `box-shadow`. Les ombres portées sont réservées aux composants flottants (dropdown, tooltip, dialog) où elles signalent le détachement de la surface.

## 3. Typography

**Display Font:** Geist Sans (system-ui, -apple-system, sans-serif)
**Body Font:** Geist Sans — même famille, poids différents
**Mono Font:** Geist Mono (ui-monospace, monospace) pour les numéros de documents, les montants financiers, les clés API

**Character:** Un seul sans-serif géométrique-humaniste utilisé à travers tous ses niveaux de poids. La hiérarchie se construit par la taille et la graisse, pas par le changement de famille. Geist Mono isole visuellement les données critiques (numéros de facture, montants en XPF) sans introduire une troisième voix typographique.

### Hierarchy
- **Display** (700, `clamp(1.25rem, 2.5vw, 2rem)`, line-height 1.2, letter-spacing -0.02em): Titres de page principaux, en-tête de dashboard. Maximum 2 par vue.
- **Title** (600, `1rem`, line-height 1.5, letter-spacing -0.01em): En-têtes de section, titres de cartes, noms de colonnes de tableau. L'ossature des vues de liste.
- **Body** (400, `0.875rem`, line-height 1.5): Tout le contenu textuel courant. Lignes de tableau, descriptions, labels de formulaire. Maximum 65ch de largeur pour les blocs de texte prose.
- **Label** (500, `0.75rem`, line-height 1.4, letter-spacing 0.01em): Métadonnées, horodatages, statuts textuels, aides contextuelle. Utilisé uniquement en `steel-fog` ou en couleur sémantique.
- **Mono** (400, `0.875rem`, line-height 1.6): Numéros de facture (`FA-2026-0042`), montants financiers (`1 250 000 F CFP`), clés API, N° TAHITI. Crée une zone visuelle de données structurées.

### Named Rules
**La Règle Mono pour les Données Critiques.** Tout identifiant séquentiel (numéro de facture, numéro de devis, N° TAHITI) et tout montant financier s'affiche en Geist Mono. Cette règle est non négociable : le changement de police signale que c'est une donnée précise, pas du texte interprétable.

## 4. Elevation

Le système Hono est **plat par défaut avec une élévation tonale**. Il n'y a pas de `box-shadow` sur les surfaces au repos. La profondeur est communiquée exclusivement par trois niveaux de luminosité OKLCH :

1. **Fond** (`oklch(0.145 0 0)`) — le sol de l'application
2. **Surface élevée** (`oklch(0.205 0.042 265.755)`) — les cartes, la sidebar, le contenu principal
3. **Surface surélevée** (`oklch(0.269 0.021 257.438)`) — bordures, inputs, hover states, items actifs

Les composants flottants (dropdown, tooltip, dialog, popover) ajoutent une ombre portée légère pour signaler leur détachement de la surface :

### Shadow Vocabulary
- **Ombre flottante** (`0 4px 24px oklch(0 0 0 / 0.4)`): Dropdowns, tooltips, menus contextuels. Communique le détachement de la surface sans dramatisme.
- **Ombre dialog** (`0 8px 40px oklch(0 0 0 / 0.6)`): Modales et dialogs uniquement. Plus profond pour marquer l'interruption intentionnelle du flux.

### Named Rules
**La Règle Zéro Ombre au Repos.** Aucune carte, aucun bouton, aucune section ne porte d'ombre au repos. Les ombres sont réservées aux états flottants (`:hover` sur certains éléments interactifs) et aux composants qui se détachent physiquement du plan (modales, dropdowns). Toute ombre au repos est un signe d'inflation visuelle.

## 5. Components

### Buttons
L'interface Hono est dense en actions. Les boutons communiquent la hiérarchie par la couleur et la substance, pas par la taille.

- **Shape:** Gently curved — `0.625rem` (10px radius). Jamais pill (trop amical), jamais sharp (trop agressif).
- **Primary:** Fond Bleu Institution (`oklch(0.546 0.245 262.881)`), texte Blanc Encre, padding `8px 12px`, taille 0.875rem/500. Réservé à une seule action par vue.
- **Hover:** Assombrissement directionnel → `oklch(0.46 0.245 262.881)`. Transition `150ms ease-out`. Pas de `translateY`, pas de glow — le clic doit se sentir précis, pas élastique.
- **Focus:** Ring `2px solid oklch(0.546 0.245 262.881)` avec `outline-offset: 2px`. Visible, non ambigu.
- **Secondary:** Fond Surface Surélevée (`oklch(0.269 0.021 257.438)`), texte Blanc Encre. Pour les actions secondaires couplées à une action primaire (ex: "Nouvelle facture" + "Nouveau devis").
- **Ghost:** Fond transparent, texte Brume Acier. Hover → Surface Surélevée + Blanc Encre. Pour les actions de navigation et les icônes (panier, user, collapse).
- **Destructive:** Fond Rouge Signal (`oklch(0.577 0.245 27.325)`), texte Blanc Encre. Uniquement dans les dialogs de confirmation — jamais en ligne dans une page.

### Cards / Containers
Les cartes sont la surface de présentation standard des données métier.

- **Corner Style:** Gently curved (`0.625rem` / 10px). Cohérent avec les boutons.
- **Background:** Surface Élevée (`oklch(0.205 0.042 265.755)`).
- **Shadow Strategy:** Aucune au repos (voir Elevation). Pas de `box-shadow`.
- **Border:** `1px solid oklch(0.269 0.021 257.438)` — la bordure est fonctionnelle, pas décorative. Elle délimite sans alourdir.
- **Internal Padding:** `24px` (1.5rem) par défaut. `16px` (1rem) pour les cartes compactes en grid.

**La Règle Zéro Carte Imbriquée.** Jamais de carte dans une carte. Si un contenu a besoin d'être visuellement groupé à l'intérieur d'une carte, utiliser un fond Surface Surélevée, un séparateur, ou un simple espacement. L'imbrication crée de l'inflation visuelle et signale un problème d'architecture.

### Inputs / Fields
- **Style:** Fond Surface Surélevée (`oklch(0.269 0.021 257.438)`), bordure identique (fusion intentionnelle au repos), radius `0.625rem`, padding `8px 12px`.
- **Focus:** Bordure → Bleu Institution + glow `0 0 0 3px oklch(0.546 0.245 262.881 / 0.2)`. La zone active est non ambiguë.
- **Placeholder:** Brume Acier (`oklch(0.708 0.047 252.682)`) — contraste ≥4.5:1 garanti.
- **Error:** Bordure → Rouge Signal + message d'erreur en `0.75rem` Rouge Signal sous le champ.
- **Disabled:** Opacité `0.5`, curseur `not-allowed`. Pas de couleur de fond différente.

### Navigation
La sidebar ERP est la surface de navigation principale.

- **Style:** Fond identique au fond de l'app (`oklch(0.145 0 0)`) avec bordure droite Surface Surélevée. Largeur `240px` déployée, `64px` réduite.
- **Nav items au repos:** Texte Brume Acier, fond transparent, padding `8px 12px`, radius `0.625rem`.
- **Hover:** Fond Surface Surélevée + texte Blanc Encre. Transition `150ms ease-out`.
- **Actif:** Fond `oklch(0.546 0.245 262.881 / 0.1)` (Bleu Institution à 10% d'opacité) + texte Bleu Institution. La teinte d'activation est subtile — la navigation est un contexte, pas une action.
- **Mobile:** Navigation réduite à icônes seules (`64px`). Pas de burger menu overlay — l'espace est conservé pour les données.

### Status Badges
Composant signature de l'ERP — les statuts sont de l'information critique.

- **Forme:** `0.375rem` radius, padding `2px 6px`, taille `0.75rem`/500.
- **Palette sémantique (sur fond sombre):** Fond clair + texte sombre de même teinte — lisible sur la Surface Élevée des cartes.
  - Payé / Accepté / OK: fond `#dcfce7`, texte `#15803d`
  - Envoyé / Actif: fond `#dbeafe`, texte `#1d4ed8`
  - Brouillon / En attente: fond `#fef9c3`, texte `#a16207`
  - En retard / Refusé / Erreur: fond `#fee2e2`, texte `#b91c1c`
  - Converti / Archivé: fond `#f3e8ff`, texte `#7e22ce`
- **La Règle Mono pour les Identifiants.** Le numéro du document (`FA-2026-0042`) adjacent au badge s'affiche en Geist Mono, jamais en Geist Sans.

## 6. Do's and Don'ts

### Do:
- **Do** utiliser Geist Mono pour tous les numéros de facture, montants en XPF, N° TAHITI, et clés API — c'est une donnée structurée, pas du texte ordinaire.
- **Do** réserver le Bleu Institution à une seule action primaire par vue. Sa rareté est ce qui lui donne son autorité.
- **Do** communiquer la profondeur par l'élévation OKLCH (fond → surface élevée → surface surélevée) — jamais par des ombres sur les surfaces au repos.
- **Do** utiliser `prefers-reduced-motion: reduce` sur toutes les transitions et animations sans exception.
- **Do** garantir un contraste ≥4.5:1 pour tout texte sur toute surface, y compris les placeholders et les labels de navigation inactifs.
- **Do** nommer les composants de statut avec la terminologie PF correcte : "Franchise en base" (pas "TVA non applicable en général"), "N° TAHITI" (pas "SIRET"), montants en "F CFP" ou "F" (jamais "€").
- **Do** traiter la densité avec respect : les vues de liste de l'ERP doivent montrer 15-20 lignes sans pagination, pas 5 avec des mega-cards.

### Don't:
- **Don't** utiliser des interfaces dans l'esprit Quickbooks / Sage : tableaux oppressants, chrome grisâtre omniprésent, UX des années 2010 avec des formulaires pleine page pour chaque champ. Hono est dense mais aéré.
- **Don't** verser dans le minimalisme de Notion / Linear : espace blanc excessif qui gaspille de la surface sur des données métier denses. Un tableau de 5 colonnes ne doit pas ressembler à un éditeur de notes.
- **Don't** copier le look "SaaS générique" (Stripe / Vercel clone) : bleu foncé sur blanc, gradient sur le hero, typographie display très fine. Hono a un fond noir, un seul accent bleu-indigo, et Geist sans serif display.
- **Don't** traiter le storefront comme Shopify / WooCommerce : pas de mise en page marchande générique, pas de "Ajouter au panier" avec les codes couleurs e-commerce. Le catalogue Hono est un catalogue B2B professionnel.
- **Don't** utiliser `border-left` ou `border-right` de plus de 1px comme accent de couleur sur les cartes ou les items de liste. Remplacer par un fond teinté, un séparateur full-width, ou une icône colorée.
- **Don't** utiliser du gradient text (`background-clip: text`). Jamais. La couleur du texte est un token, pas un dégradé.
- **Don't** imbriquer des cartes. Fond Surface Surélevée, séparateur, ou espacement suffisent.
- **Don't** animer des propriétés CSS de layout (width, height, padding, margin). Uniquement `transform` et `opacity` pour les animations de performance.
- **Don't** inventer des couleurs hors palette pour "égayer" une section. Si une section semble terne, le problème est dans la hiérarchie typographique ou l'espacement — pas dans la couleur.
