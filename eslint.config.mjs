import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  // Global ignores
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/generated/**",
      "**/*.js",
      "**/*.mjs",
    ],
  },

  // Base JS rules
  js.configs.recommended,

  // TypeScript rules
  ...tseslint.configs.recommended,

  // Enable type-aware linting for rules that require type information
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.ts", "*.mjs", "frontend/*.ts", "backend/*.ts", "backend/prisma/*.ts", "backend/scripts/*.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // React hooks rules (frontend only)
  {
    files: ["frontend/src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },

  // Project-wide rule overrides
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-deprecated": "warn",
    },
  },

  // Disable rules that conflict with Prettier
  eslintConfigPrettier
];
