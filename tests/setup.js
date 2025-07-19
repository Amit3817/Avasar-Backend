// Test setup file for Jest

// Set environment to production mode with test database
process.env.NODE_ENV = 'production';
process.env.MONGODB_URI = 'mongodb://localhost:27017/avasar_test';

// Mock MongoDB connection for testing
jest.mock('mongoose', () => {
  const originalMongoose = jest.requireActual('mongoose');
  
  return {
    ...originalMongoose,
    connect: jest.fn().mockResolvedValue(originalMongoose),
    connection: {
      ...originalMongoose.connection,
      close: jest.fn().mockResolvedValue(true)
    }
  };
});

// Global test timeout
jest.setTimeout(30000);

// Console log mocking to reduce noise during tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};