import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'coverage/'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
    },
  },
  {
    // Archivos de configuración y pruebas corren en Node
    files: ['*.config.js', 'src/**/*.test.js'],
    languageOptions: { globals: { ...globals.node } },
  },
];
