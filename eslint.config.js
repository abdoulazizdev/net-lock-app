// Configuration ESLint — https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "android/*", "ios/*", ".expo/*"],
  },
  {
    rules: {
      // Règle héritée du web : en React Native, `&apos;` et compagnie sont
      // rendus littéralement. Les apostrophes françaises doivent donc rester
      // telles quelles dans le JSX.
      "react/no-unescaped-entities": "off",
    },
  },
  {
    // Scripts de développement exécutés par Node, hors bundle de l'app.
    files: ["scripts/**/*.js"],
    languageOptions: {
      globals: { __dirname: "readonly", require: "readonly", module: "writable", process: "readonly" },
    },
  },
]);
