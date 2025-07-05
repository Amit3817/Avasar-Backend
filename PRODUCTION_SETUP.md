# Production Setup Guide

## Environment Variables

Create a `.env` file in the backend root directory with the following variables:

```env
# Production Environment Configuration
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://avasar.netlify.app

# MongoDB Configuration
MONGODB_URI=your_mongodb_connection_string_here

# JWT Configuration
JWT_SECRET=your_jwt_secret_here

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Email Configuration (optional)
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_password

# API URL for Swagger documentation
API_URL=https://avasar-backend.onrender.com
```

## CORS Configuration

The backend is configured for production only and allows requests from:
- https://avasar.netlify.app (your production frontend)
- https://avasar-backend.onrender.com (your production backend)

## Production Features Enabled

1. **Production-Only Mode**: Always uses production configuration
2. **Rate Limiting**: 100 requests per 15 minutes per IP
3. **Enhanced Security**: MongoDB sanitization, CORS protection
4. **Production Logging**: Structured logging with proper levels
5. **Database Optimization**: Connection pooling and timeout settings
6. **Error Handling**: Comprehensive error handling and logging

## Deployment Checklist

- [ ] Set all environment variables in your hosting platform (Render, Heroku, etc.)
- [ ] Ensure MongoDB connection string is accessible
- [ ] Configure Cloudinary credentials
- [ ] Set up email service (if required)
- [ ] Verify CORS settings allow your frontend domain
- [ ] Test API endpoints in production environment

## Health Check

The API includes a health check endpoint:
```
GET https://avasar-backend.onrender.com/api/health
```

This should return:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
``` 