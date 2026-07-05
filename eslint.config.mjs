import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "design-dari-file-prd/**",
  ]),
  {
    rules: {
      // Mount-guard / matchMedia hydration idioms (use-online, use-mobile)
      // legitimately set state inside an effect on first client render.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
