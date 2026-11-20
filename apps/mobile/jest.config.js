module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/__tests__/**/*.test.ts?(x)'],
  moduleNameMapper: {
    '^@nacall/core/(.*)$': '<rootDir>/../../src/lib/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^zod$': '<rootDir>/node_modules/zod',
  },
};
