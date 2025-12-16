const cors = require('cors');

// Cấu hình CORS (cho frontend gọi proxy)
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['*']; // mặc định cho phép mọi origin

const corsOptions = {
  // Phản hồi lại origin bất kỳ (nếu cần giới hạn, set ALLOWED_ORIGINS env)
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: false,
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


