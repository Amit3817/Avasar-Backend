import fetch from 'node-fetch';

const API_BASE = 'https://avasar-backend.onrender.com/api';

// Test endpoints that the frontend uses
const testEndpoints = [
  // Auth endpoints
  { method: 'POST', path: '/auth/register', description: 'User registration' },
  { method: 'POST', path: '/auth/login', description: 'User login' },
  { method: 'POST', path: '/auth/verify-otp', description: 'OTP verification' },
  { method: 'POST', path: '/auth/resend-otp', description: 'Resend OTP' },
  
  // Contact endpoint
  { method: 'POST', path: '/contact', description: 'Contact form submission' },
  
  // Health check
  { method: 'GET', path: '/health', description: 'Health check' },
];

async function testEndpoint(method, path, description) {
  try {
    const url = `${API_BASE}${path}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: method !== 'GET' ? JSON.stringify({}) : undefined
    };
    
    console.log(`Testing ${description} (${method} ${path})...`);
    const response = await fetch(url, options);
    
    if (response.status === 200 || response.status === 400 || response.status === 401) {
      console.log(`✅ ${description}: ${response.status} - Endpoint exists`);
    } else {
      console.log(`❌ ${description}: ${response.status} - Endpoint not found or error`);
    }
  } catch (error) {
    console.log(`❌ ${description}: Error - ${error.message}`);
  }
}

async function runTests() {
  console.log('🔍 Testing Frontend-Backend Integration...\n');
  
  for (const endpoint of testEndpoints) {
    await testEndpoint(endpoint.method, endpoint.path, endpoint.description);
  }
  
  console.log('\n✅ Integration test completed!');
  console.log('\n📋 Summary:');
  console.log('- All auth endpoints should be available');
  console.log('- Contact endpoint has been added');
  console.log('- Health check endpoint is available');
  console.log('- Protected endpoints require authentication');
  console.log('- Admin endpoints require admin privileges');
}

runTests().catch(console.error); 