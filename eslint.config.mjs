import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const preservedPrototypeFiles = [
  'components/cluvo/app.tsx',
  'components/cluvo/collaboration.tsx',
  'components/cluvo/dashboard.tsx',
  'components/cluvo/data.ts',
  'components/cluvo/governance.tsx',
  'components/cluvo/management.tsx',
  'components/cluvo/people.tsx',
  'components/cluvo/store.tsx',
  'components/cluvo/tasks.tsx',
  'components/cluvo/ui.tsx',
];

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    // Deze bestanden zijn de byte-identieke visuele referentie. Vermijd in WP0
    // een grote baseline-rewrite; nieuwe domeinbestanden krijgen de strikte
    // standaardregels en deze uitzonderingen verdwijnen tijdens de migratie.
    files: preservedPrototypeFiles,
    rules: {
      '@next/next/no-img-element': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    // Bekende upstreampatronen in ongewijzigde shadcn-primitives en viewport-hook.
    files: [
      'components/ui/carousel.tsx',
      'components/ui/combobox.tsx',
      'hooks/use-mobile.ts',
    ],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'coverage/**',
    'playwright-report/**',
    '.supabase/**',
    'supabase/.temp/**',
    'test-results/**',
    'vendor/**',
  ]),
]);
