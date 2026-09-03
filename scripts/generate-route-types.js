/**
 * scripts/generate-route-types.js
 *
 * Régénère `.expo/types/router.d.ts` sans démarrer Metro.
 *
 * expo-router produit ce fichier au lancement du serveur de développement.
 * Hors serveur — vérification de types en CI, ou juste après avoir déplacé des
 * routes — les types restent périmés et `tsc` signale des chemins pourtant
 * valides. Ce script appelle le même générateur avec un contexte reconstruit
 * depuis le système de fichiers.
 *
 *   node scripts/generate-route-types.js
 */

const fs = require("node:fs");
const path = require("node:path");

const {
  getTypedRoutesDeclarationFile,
} = require("expo-router/build/typed-routes/generate.js");

const APP_DIR = path.join(__dirname, "..", "app");
const OUT_FILE = path.join(__dirname, "..", ".expo", "types", "router.d.ts");
const ROUTE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];

/** Liste les fichiers de route sous `app/`, au format attendu par require.context. */
function collectRoutes(dir, prefix = ".") {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const routes = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    const key = `${prefix}/${entry.name}`;

    if (entry.isDirectory()) {
      routes.push(...collectRoutes(full, key));
      continue;
    }
    if (!ROUTE_EXTENSIONS.includes(path.extname(entry.name))) continue;
    if (entry.name.endsWith(".d.ts")) continue;
    routes.push(key);
  }
  return routes;
}

function main() {
  if (!fs.existsSync(APP_DIR)) {
    console.error("Répertoire app/ introuvable.");
    process.exit(1);
  }

  const keys = collectRoutes(APP_DIR).sort();

  // Le générateur n'a besoin que des clés : il analyse les chemins, pas les
  // modules. Les valeurs sont donc des composants vides.
  const ctx = Object.assign(
    () => ({ default: () => null }),
    { keys: () => keys, resolve: (key) => key, id: "app" },
  );

  const declaration = getTypedRoutesDeclarationFile(ctx);

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, declaration);

  console.log(`${keys.length} routes → ${path.relative(process.cwd(), OUT_FILE)}`);
}

main();
