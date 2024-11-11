import js from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [
      js.configs.recommended,
      eslintPluginPrettierRecommended,
      ...tseslint.configs.recommended,
    ],
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
    },
    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-unused-vars': 1,
      semi: ['error', 'always'],
      indent: ['error', 2, { SwitchCase: 1 }],
      'comma-dangle': ['error', 'always-multiline'],
      'keyword-spacing': [
        'error',
        {
          overrides: {
            if: { after: true },
            for: { after: true },
            while: { after: true },
            catch: { after: true },
            switch: { after: true },
          },
        },
      ],
      quotes: ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
      'template-curly-spacing': 'error',
    },
  },
);
