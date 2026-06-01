const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config and .env files
  dir: './',
});

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    // Handle module aliases (from tsconfig paths)
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@political-research/(.*)$': '<rootDir>/../../packages/$1/src',
  },
  testMatch: [
    '**/__tests__/**/*.(test|spec).(ts|tsx|js)',
    '**/*.(test|spec).(ts|tsx|js)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/layout.tsx',
    '!src/**/loading.tsx',
    '!src/**/error.tsx',
    '!src/app/api/**', // API routes are better tested as integration later
  ],
  coverageThreshold: {
    // Fase 4 transitional (web has heavier integration surface). Packages are the priority for high coverage.
    // Will be raised significantly once more unit + contract tests land in subsequent F4 sub-steps.
    global: {
      branches: 8,
      functions: 10,
      lines: 10,
      statements: 10,
    },
  },
};

module.exports = createJestConfig(customJestConfig);
