import { configs, createNamingConventionOptions } from '@vcsuite/eslint-config';
import globals from 'globals';

export default [
  ...configs.nodeTs,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      'import/no-cycle': 'off',
      'import/no-named-as-default': 'off',
      'import/no-named-as-default-member': 'off',
      'n/no-unsupported-features/node-builtins': 'off',
      'no-console': 'error',
    },
  },
  {
    ignores: ['node_modules/', 'coverage/', 'docs/', 'dist/', '.tests/'],
  },
  {
    files: ['**/*.spec.js'],
    languageOptions: {
      globals: {
        expect: 'readonly',
        it: 'readonly',
        sinon: 'readonly',
        createCanvas: 'readonly',
      },
    },
  },
  {
    files: ['**/build/*.js'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['**/src/oblique/**'], // legacy oblique uses kebab-case URG
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        ...createNamingConventionOptions(),
        {
          selector: 'property',
          format: null,
          filter: {
            regex: '^(\\w+-)*\\w+$',
            match: true,
          },
        },
      ],
    },
  },
  {
    files: [
      'src/panorama/panoramaTileMaterial.ts',
      'src/panorama/panoramaTileMaterial.spec.ts',
      'src/panorama/panoramaTileMaterial.test.ts',
    ],
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        ...createNamingConventionOptions(),
        {
          selector: ['property', 'objectLiteralProperty'],
          format: null,
          filter: {
            regex: '^u_.*',
            match: true,
          },
        },
      ],
    },
  },
];
