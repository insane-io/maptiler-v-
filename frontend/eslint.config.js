import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'
import SimpleImportSort from 'eslint-plugin-simple-import-sort'
import prettier from 'eslint-plugin-prettier'
import jsxA11y from 'eslint-plugin-jsx-a11y'

export default tseslint.config(
  { ignores : ['dist/**', 'node_modules/**'] },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],

    //Base setup
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,

      ...tseslint.configs.recommended,
      prettierConfig
    ],

    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,

      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },

    plugins:{
      'simple-import-sort':SimpleImportSort,
      prettier : prettier,
      'jus-a11y': jsxA11y
    },
    rules: {
      // Enable standard a11y rules
      ...jsxA11y.configs.recommended.rules,
      
      // react and react-refresg rules 
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        {allowConstantExport: true},
      ],

      // prettier rules
      'prettier/prettier': 'warn',

      // simple-import-sort rules 
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',

      //custome rules
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      curly: 'warn',
      'no-alert': 'error', // Uses string 'error', not console.error
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off', // Smart console handling
      'no-empty': 'error',
      'no-undef': 'off', // TS handles this better than ESLint
    },
  },
  //to ensure that .ts rules not get applied to .js 
  {
    files:['**/*.{js,jsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off', // Turn off TS rule for JS
      'no-unused-vars': 'warn', // Use standard JS rule
    },
  }
)
