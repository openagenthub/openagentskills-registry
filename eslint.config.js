/**
 * ESLint flat config for the registry repo.
 * Uses ESLint v9 flat config format with TypeScript support via type-aware
 * linting disabled (too slow for CI). Covers both the root scripts and the
 * worker source.
 */

import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
        crypto: 'readonly',
        setTimeout: 'readonly',
        TextEncoder: 'readonly',
        URL: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'off',
    },
  },
  {
    ignores: ['node_modules/', 'dist/', 'worker/node_modules/'],
  },
];
