/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)sx?$': '@swc/jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['**/__tests__/**/*.test.(ts|tsx|js)'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    // Fase 4 ratchet (post Fase 3 type safety + new tests: idempotency, LWW, sampling, audit, rate-limiter, planning, etc.)
    // Latest run: 18 suites / 74 tests. Many F4 files at 93-100%. Ratchet continues.
    global: {
      branches: 25,
      functions: 40,
      lines: 42,
      statements: 40,
    },
  },
};
