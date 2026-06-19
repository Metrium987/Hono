#!/usr/bin/env node
// Detect hardcoded French strings in UI files that should use i18n
import { readFileSync, readdirSync } from "fs";
import { join, relative, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const APP_DIR = join(PROJECT_ROOT, "src", "app", "[locale]");

// Recursive file finder (no external deps)
function findTsxFiles(dir) {
  const results = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findTsxFiles(fullPath));
      } else if (entry.name.endsWith(".tsx")) {
        results.push(fullPath);
      }
    }
  } catch { /* ignore */ }
  return results;
}

// French string detection patterns
const FRENCH_PATTERNS = [
  // Status labels (quoted strings)
  /["'`]\s*(Brouillon|Brouillons|Envoy[ée]s?|Vues?|Partielle|Pay[ée]s?|En retard|Annul[ée]s?|Rembours[ée]s?|Accept[ée]|Refus[ée]|Expir[ée]|Converti[ée]?s?)\s*["'`]/g,
  // Error/system messages
  /["'`](?!\s*$)(Non connect[ée]|Aucune [ée]quipe trouv[ée]e|Erreur de connexion|Une erreur est survenue|Token manquant|Token invalide|Page non trouv[ée]e|Erreur lors de la cr[ée]ation|Erreur inconnue|Erreur de validation)[\.,!]?["'`]/g,
  // Common action labels (quoted)
  /["'`](?!\s*$)(Nouve[au]+lle?\s*(facture|d[eé]pense|devis|revenu|fournisseur|avoir)|Cr[ée]er\s+(la|le|l')\s*(facture|d[eé]pense|devis|revenu|fournisseur|cl[ée])|Enregistrer\s+(un\s+)?paiement|Ajouter\s+une\s+ligne|Rechercher|Filtrer|Annuler|Retour\s+(aux|[aà]))["'`]/gi,
];

async function main() {
  const localeFile = readFileSync(join(PROJECT_ROOT, "src", "locales", "fr.json"), "utf-8");
  
  const files = findTsxFiles(APP_DIR);
  let totalIssues = 0;
  const fileResults = [];

  console.log("=".repeat(80));
  console.log("HARDCODED FRENCH STRING DETECTION REPORT");
  console.log("=".repeat(80));
  console.log(`Scanning ${files.length} TSX files...\n`);

  for (const filePath of files) {
    const content = readFileSync(filePath, "utf-8");
    const relPath = relative(PROJECT_ROOT, filePath);
    const lines = content.split("\n");
    const issues = [];

    // Check if file uses translation hooks
    const usesTranslations = content.includes("useTranslations") || content.includes("getTranslations");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Skip lines that are already using translation
      if (line.includes("t(") || line.includes("getTranslations(") || line.includes("useTranslations(")) continue;
      // Skip imports and comments
      if (line.trim().startsWith("import ") || line.trim().startsWith("//") || line.trim().startsWith("/*")) continue;
      // Skip lines that are only JSX closing tags or CSS classes
      if (line.trim().startsWith("</") || line.trim().startsWith(" className=")) continue;

      for (const pattern of FRENCH_PATTERNS) {
        const matches = [...line.matchAll(pattern)];
        for (const m of matches) {
          const found = m[1] || m[0];
          if (!found || found.length < 3) continue;
          // Skip if this exact string appears in a t() call
          if (line.includes(`("${found}")`) || line.includes(`('${found}')`)) continue;
          issues.push({ line: lineNum, text: found.trim().substring(0, 80) });
          break;
        }
      }
    }

    if (issues.length > 0) {
      fileResults.push({ file: relPath, issues, usesTranslations });
      totalIssues += issues.length;
    }
  }

  // Sort by issue count descending
  fileResults.sort((a, b) => b.issues.length - a.issues.length);

  console.log(`Found ${totalIssues} potential hardcoded strings in ${fileResults.length} files\n`);
  console.log("Top files with most remaining strings:");
  console.log("-".repeat(60));

  for (const fr of fileResults.slice(0, 15)) {
    const flag = fr.usesTranslations ? " (partial)" : "";
    console.log(`  ${fr.file}${flag}: ${fr.issues.length} strings`);
    for (const issue of fr.issues.slice(0, 5)) {
      console.log(`    L${issue.line}: "${issue.text}"`);
    }
    if (fr.issues.length > 5) {
      console.log(`    ... and ${fr.issues.length - 5} more`);
    }
    console.log();
  }

  if (fileResults.length > 15) {
    console.log(`  ... and ${fileResults.length - 15} more files with fewer issues`);
  }

  console.log("=".repeat(80));
  const notRefactored = fileResults.filter(f => !f.usesTranslations).length;
  const partialRefactored = fileResults.filter(f => f.usesTranslations).length;
  console.log(`SUMMARY: ${totalIssues} potential hardcoded strings`);
  console.log(`  Files not yet refactored: ${notRefactored}`);
  console.log(`  Files partially refactored: ${partialRefactored}`);
  console.log(`  Zero-issue files: ${files.length - fileResults.length}`);
  console.log("=".repeat(80));
}

main().catch(console.error);
