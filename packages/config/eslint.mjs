import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export const baseConfig = tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/.vite/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Plain .js — static browser assets served as-is (not bundled/type-checked
    // by Vite), e.g. apps/web/public/**. Everything else in this repo is
    // .ts/.tsx (already browser+node above) or .cjs (node above).
    files: ['**/*.js'],
    languageOptions: { globals: { ...globals.browser } },
  },
  prettier,
);

export default baseConfig;
