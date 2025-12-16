const cors = require('cors');

// Cấu hình CORS (cho frontend gọi proxy)
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.indexOf(origin) !== -1 || ALLOWED_ORIGINS.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'User-Agent',
    'Accept',
    'Accept-Language',
    'Referer',
    'Origin',
    'X-Requested-With'
  ],
  exposedHeaders: ['Content-Type', 'Content-Length', 'Accept-Ranges'],
  maxAge: 86400 // 24h
};

module.exports = {
  corsMiddleware: cors(corsOptions),
  ALLOWED_ORIGINS
};


