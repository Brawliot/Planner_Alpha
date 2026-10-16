import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Colores fijos de Tailwind (paleta, white/black, arbitrarios #hex).
// Solo se permiten los tokens semánticos definidos en globals.css.
const FIXED_COLOR =
  "/\\b(bg|text|border|ring|outline|fill|stroke|from|via|to|divide|placeholder|decoration|shadow|accent|caret)-(white|black|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d{2,3}|\\[#)/";

const FIXED_COLOR_MESSAGE =
  "Usa tokens de color (bg-primary, text-muted-foreground, text-danger...) definidos en globals.css, no colores fijos.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: `Literal[value=${FIXED_COLOR}]`, message: FIXED_COLOR_MESSAGE },
        { selector: `TemplateElement[value.raw=${FIXED_COLOR}]`, message: FIXED_COLOR_MESSAGE },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;