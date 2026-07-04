import { coverageConfigDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      // Count every source file, not just the ones tests happen to import,
      // so untested modules drag the number down instead of hiding.
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        ...coverageConfigDefaults.exclude,
        '**/__fixtures__/**',
        // Electron wiring and UI covered by the Playwright e2e suite, not unit tests.
        'src/main/index.ts',
        'src/preload/**',
        'src/main/tray/tray.ts',
        'src/main/notifications/notifier.ts',
        'src/renderer/src/main.tsx',
        'src/renderer/src/App.tsx',
        'src/renderer/src/components/**',
        'src/renderer/src/store.ts'
      ],
      reporter: ['text', 'html', 'lcov'],
  
      // on 2026-07-03; thresholds sit below that to allow honest refactoring headroom.
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 85
      }
    }
  }
})
