import '@testing-library/jest-dom';

// Mock Next.js router if needed in future tests
// jest.mock('next/navigation', () => ({
//   useRouter: () => ({ push: jest.fn() }),
//   usePathname: () => '',
// }));

// Silence console errors during tests unless we want them
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
