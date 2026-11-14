// ESLint flat config — decision 0024. Deliberately small: typescript-eslint's
// recommended set plus the two classic React hooks rules. No style or
// formatting rules (CODING-STANDARDS.md kernel 12).
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    // Build output, sideloaded widgets, runtime data, the updater's backup
    // copies and agent scratch folders — none of it is this repo's source.
    ignores: [
      "**/dist/",
      "server/public/",
      "widgets/",
      "data/",
      ".update-backups/",
      ".update-temp/",
      ".local/",
      ".agents/",
      ".cache/",
      ".upm/",
      ".claude/",
      "attached_assets/",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,mjs,cjs}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      // A leading underscore marks a deliberately unused binding (an
      // Express error handler's `_next`, a destructured field being dropped).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
);
