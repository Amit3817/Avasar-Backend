import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Avasar Growth Platform API',
      version: '1.0.0',
      description: 'API documentation for Avasar Growth Platform - A referral and investment platform',
      contact: {
        name: 'Avasar Support',
        email: 'support@avasar.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.API_URL || 'https://avasar-backend.onrender.com',
        description: 'Production server'
      },
      {
        url: 'http://localhost:5000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for authentication'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string', description: 'User ID' },
            fullName: { type: 'string', description: 'User full name' },
            email: { type: 'string', format: 'email', description: 'User email' },
            phone: { type: 'string', description: 'User phone number' },
            referralCode: { type: 'string', description: 'User referral code' },
            isVerified: { type: 'boolean', description: 'Email verification status' },
            isAdmin: { type: 'boolean', description: 'Admin status' },
            walletBalance: { type: 'number', description: 'Current wallet balance' },
            referralIncome: { type: 'number', description: 'Total referral income' },
            matchingIncome: { type: 'number', description: 'Total matching income' },
            rewardIncome: { type: 'number', description: 'Total reward income' },
            createdAt: { type: 'string', format: 'date-time', description: 'Account creation date' }
          }
        },
        PaymentSlip: {
          type: 'object',
          properties: {
            _id: { type: 'string', description: 'Payment slip ID' },
            user: { type: 'string', description: 'User ID' },
            file: { type: 'string', description: 'File URL' },
            amount: { type: 'number', description: 'Payment amount' },
            method: { type: 'string', description: 'Payment method' },
            status: { type: 'string', enum: ['pending', 'approved', 'rejected'], description: 'Payment status' },
            transactionId: { type: 'string', description: 'Transaction ID' },
            createdAt: { type: 'string', format: 'date-time', description: 'Creation date' }
          }
        },
        Withdrawal: {
          type: 'object',
          properties: {
            _id: { type: 'string', description: 'Withdrawal ID' },
            user: { type: 'string', description: 'User ID' },
            amount: { type: 'number', description: 'Withdrawal amount' },
            status: { type: 'string', enum: ['pending', 'approved', 'rejected'], description: 'Withdrawal status' },
            remarks: { type: 'string', description: 'Admin remarks' },
            bankAccount: {
              type: 'object',
              properties: {
                accountHolder: { type: 'string' },
                accountNumber: { type: 'string' },
                ifsc: { type: 'string' },
                bankName: { type: 'string' },
                branch: { type: 'string' }
              }
            },
            upiId: { type: 'string', description: 'UPI ID' },
            createdAt: { type: 'string', format: 'date-time', description: 'Creation date' }
          }
        },
        Investment: {
          type: 'object',
          properties: {
            _id: { type: 'string', description: 'Investment ID' },
            user: { type: 'string', description: 'User ID' },
            amount: { type: 'number', description: 'Investment amount' },
            monthlyROI: { type: 'number', description: 'Monthly ROI percentage' },
            status: { type: 'string', enum: ['active', 'completed', 'cancelled'], description: 'Investment status' },
            startDate: { type: 'string', format: 'date-time', description: 'Investment start date' },
            endDate: { type: 'string', format: 'date-time', description: 'Investment end date' },
            totalEarned: { type: 'number', description: 'Total amount earned' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', description: 'Error message' },
            message: { type: 'string', description: 'Detailed error description' }
          }
        },
        PaginationResponse: {
          type: 'object',
          properties: {
            data: { type: 'array', description: 'Array of items' },
            pagination: {
              type: 'object',
              properties: {
                currentPage: { type: 'integer', description: 'Current page number' },
                totalPages: { type: 'integer', description: 'Total number of pages' },
                totalItems: { type: 'integer', description: 'Total number of items' },
                itemsPerPage: { type: 'integer', description: 'Items per page' },
                hasNextPage: { type: 'boolean', description: 'Whether next page exists' },
                hasPrevPage: { type: 'boolean', description: 'Whether previous page exists' },
                nextPage: { type: 'integer', nullable: true, description: 'Next page number' },
                prevPage: { type: 'integer', nullable: true, description: 'Previous page number' }
              }
            }
          }
        }
      }
    },
    tags: [
      { name: 'Authentication', description: 'User authentication endpoints' },
      { name: 'Users', description: 'User management endpoints' },
      { name: 'Admin', description: 'Admin-only endpoints' },
      { name: 'Payments', description: 'Payment slip management' },
      { name: 'Withdrawals', description: 'Withdrawal request management' },
      { name: 'Investments', description: 'Investment management' }
    ]
  },
  apis: [
    './routes/*.js',
    './controllers/*.js',
    './models/*.js'
  ]
};

const specs = swaggerJsdoc(options);

export default specs; 