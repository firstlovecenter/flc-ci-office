import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    "prisma/**",
  ]),
  {
    rules: {
      // Flag explicit any — aim to eliminate these over time
      "@typescript-eslint/no-explicit-any": "warn",
      // Prevent accidental console.log left in production code
      "no-console": ["warn", { allow: ["error", "warn"] }],
      // Catch unused variables (keep params prefixed with _ as exception)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
