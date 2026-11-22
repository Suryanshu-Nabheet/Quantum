import typescriptParser from "@typescript-eslint/parser";

export default [
  { ignores: ["**/node_modules/**", "**/dist/**", "**/out/**"] },
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      "no-debugger": "error",
      "no-dupe-else-if": "error",
      "no-duplicate-case": "error",
      "no-unsafe-finally": "error",
      "no-unreachable": "error",
    },
  },
];
