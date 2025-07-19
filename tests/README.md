# Avasar Lovable Business Logic Tests

This directory contains tests for the business logic of the Avasar Lovable platform, focusing on the referral system, income distribution, and rewards.

## Test Files

1. **referral-income.test.js** - Tests the referral income distribution when a new user registers.
2. **matching-income.test.js** - Tests the matching income distribution when binary pairs are formed.
3. **investment-referral-income.test.js** - Tests the one-time investment referral income distribution.
4. **investment-referral-return-income.test.js** - Tests the monthly investment return income distribution.
5. **reward-income.test.js** - Tests the reward system based on pair milestones.

## Running Tests

### Windows
```
cd backend
tests\run-tests.bat
```

### Linux/Mac
```
cd backend
chmod +x tests/run-tests.sh
./tests/run-tests.sh
```

## Test Environment

Tests run in a dedicated test environment with the following characteristics:

- Uses a separate test database (`avasar_test`)
- Sets `NODE_ENV=test` to enable test-specific code paths
- Mocks certain functions to isolate tests from external dependencies
- Each test file can be run independently

## Test Data

The tests create their own test data, including:

- User hierarchies for testing referral chains
- Binary structures for testing matching income
- Investment records for testing investment-related income
- Pair accumulation for testing rewards

## Important Notes

1. Always run tests on a separate database, never on production data.
2. Tests will clear all data in the test database before running.
3. The test environment is configured to bypass certain validations to focus on business logic.
4. Some tests may take longer to run due to the complex nature of the referral calculations.