@echo off
REM Income Logic Test Runner for Windows
REM This script runs the comprehensive income logic tests for the backend

echo 🚀 Starting Income Logic Tests...
echo ==================================

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    call npm install
)

REM Check if test dependencies are installed
call npm list jest >nul 2>&1
if errorlevel 1 (
    echo 📦 Installing test dependencies...
    call npm install --save-dev jest mongodb-memory-server supertest
)

REM Set environment variables for testing
set NODE_ENV=test
set JWT_SECRET=test-secret-key

echo 🧪 Running Income Logic Tests...
echo ==================================

REM Run the tests
call npm test

REM Check if tests passed
if %errorlevel% equ 0 (
    echo.
    echo ✅ All tests passed successfully!
    echo.
    echo 📊 Test Summary:
    echo - Complete income logic flow tested
    echo - Referral income distribution verified
    echo - Matching income logic validated
    echo - Investment logic tested
    echo - Reward milestones verified
    echo - Edge cases handled
    echo.
    echo 🎉 Income logic is working correctly!
) else (
    echo.
    echo ❌ Some tests failed. Please check the output above.
    echo.
    echo 🔧 Troubleshooting tips:
    echo - Make sure MongoDB is not running on default port
    echo - Check that all dependencies are installed
    echo - Verify environment variables are set correctly
    pause
    exit /b 1
)

pause 