// Production configuration
export const productionConfig = {
  // Security settings
  cors: {
    allowedOrigins: [
      'https://avasar.netlify.app',
      'https://avasar-growth-platform.vercel.app',
      'https://avasar-growth-platform.netlify.app',
      'https://avasar-frontend.vercel.app',
      'https://avasar-frontend.netlify.app',
      'https://avasar.com',
      'https://www.avasar.com'
    ]
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
  },
  
  // Logging
  logging: {
    level: 'info',
    format: 'combined'
  },
  
  // Database
  database: {
    options: {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 30000, // Increased from 5000ms
      socketTimeoutMS: 60000, // Increased from 45000ms
      connectTimeoutMS: 30000, // Added connection timeout
      maxIdleTimeMS: 30000 // Added max idle time
    }
  },
  
  // JWT
  jwt: {
    expiresIn: '7d',
    refreshExpiresIn: '30d'
  },
  
  // File upload
  upload: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
  }
};

export default productionConfig; 