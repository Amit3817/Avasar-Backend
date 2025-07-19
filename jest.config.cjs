module.exports = {
  transform: {},
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json'],
  testMatch: ['**/tests/**/*.test.js'],
  globalSetup: './jest-mongodb-setup.cjs',
  globalTeardown: './jest-mongodb-teardown.cjs',
  testTimeout: 30000,
}; 