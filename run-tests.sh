#!/bin/bash

# Income Logic Test Runner
# This script runs the comprehensive income logic tests for the backend

echo "🚀 Starting Income Logic Tests..."
echo "=================================="

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if test dependencies are installed
if ! npm list jest > /dev/null 2>&1; then
    echo "📦 Installing test dependencies..."
    npm install --save-dev jest mongodb-memory-server supertest
fi

# Set environment variables for testing
export NODE_ENV=test
export JWT_SECRET=test-secret-key

echo "🧪 Running Income Logic Tests..."
echo "=================================="

# Run the tests
npm test

# Check if tests passed
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ All tests passed successfully!"
    echo ""
    echo "📊 Test Summary:"
    echo "- Complete income logic flow tested"
    echo "- Referral income distribution verified"
    echo "- Matching income logic validated"
    echo "- Investment logic tested"
    echo "- Reward milestones verified"
    echo "- Edge cases handled"
    echo ""
    echo "🎉 Income logic is working correctly!"
else
    echo ""
    echo "❌ Some tests failed. Please check the output above."
    echo ""
    echo "🔧 Troubleshooting tips:"
    echo "- Make sure MongoDB is not running on default port"
    echo "- Check that all dependencies are installed"
    echo "- Verify environment variables are set correctly"
    exit 1
fi 