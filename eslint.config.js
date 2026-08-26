import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // The recognizer and its pattern data are vendored third-party code (KanjiCanvas, MIT) — kept
  // byte-for-byte so it can be diffed against upstream, so it isn't ours to lint.
  { ignores: ['dist', 'node_modules', 'src/lib/handwriting/kanjicanvas.ts'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // The boundary to the dynamically-typed recognizer: `any` is the honest type for it.
    files: ['src/lib/handwriting/index.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)
