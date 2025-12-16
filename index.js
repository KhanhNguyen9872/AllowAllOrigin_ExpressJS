const express = require('express');
const { corsMiddleware } = require('./config/cors');
const { securityHeaders } = require('./middlewares/security');
const { proxyHandler } = require('./routes/proxy');
const { healthHandler } = require('./routes/health');

const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares chung
app.use(corsMiddleware);
app.use(securityHeaders);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.all('/proxy', proxyHandler);
app.get('/', healthHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Proxy server listening on http://localhost:${PORT}`);
});

