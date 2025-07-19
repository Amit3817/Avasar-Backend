@echo off
echo Running Avasar Lovable Business Logic Tests...

set NODE_ENV=production
set MONGODB_URI=mongodb://localhost:27017/avasar_test

echo.
echo === Referral Income Tests ===
npx jest referral-income.test.js --verbose

echo.
echo === Matching Income Tests ===
npx jest matching-income.test.js --verbose

echo.
echo === Investment Referral Income Tests ===
npx jest investment-referral-income.test.js --verbose

echo.
echo === Investment Return Income Tests ===
npx jest investment-referral-return-income.test.js --verbose

echo.
echo === Reward Income Tests ===
npx jest reward-income.test.js --verbose

echo.
echo All tests completed!