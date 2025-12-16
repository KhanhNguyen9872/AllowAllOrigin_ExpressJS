const fetch = require('node-fetch');
const { ALLOWED_ORIGINS } = require('../config/cors');
const { isValidUrl } = require('../utils/urlValidator');
const { getForwardHeaders } = require('../utils/headers');

// Route proxy đa method: user -> proxy -> real server
async function proxyHandler(req, res) {
  const targetUrl = req.query.url || (req.body && req.body.url);

  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing url query param or body.url' });
  }

  if (typeof targetUrl !== 'string' || !isValidUrl(targetUrl)) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const sanitizedUrl = targetUrl.trim().replace(/[\x00-\x1F\x7F]/g, '');

  try {
    const method = req.method.toUpperCase();
    const forwardHeaders = getForwardHeaders(req);

    const fetchOptions = {
      method,
      redirect: 'follow',
      headers: forwardHeaders
    };

    // Đính kèm body cho các method cho phép
    if (!['GET', 'HEAD'].includes(method)) {
      let body;

      if (req.body && Object.keys(req.body).length > 0) {
        if (req.is('application/json')) {
          body = JSON.stringify(req.body);
          if (!forwardHeaders['Content-Type'] && !forwardHeaders['content-type']) {
            fetchOptions.headers['Content-Type'] = 'application/json';
          }
        } else if (req.is('application/x-www-form-urlencoded')) {
          body = new URLSearchParams(req.body).toString();
          if (!forwardHeaders['Content-Type'] && !forwardHeaders['content-type']) {
            fetchOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
          }
        } else {
          body = JSON.stringify(req.body);
          if (!forwardHeaders['Content-Type'] && !forwardHeaders['content-type']) {
            fetchOptions.headers['Content-Type'] = 'application/json';
          }
        }
      }

      if (body) {
        fetchOptions.body = body;
      }
    }

    const response = await fetch(sanitizedUrl, fetchOptions);

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Upstream error' });
    }

    const origin = req.headers.origin;
    if (origin && (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
      console.log('Forwarding Content-Length:', contentLength);
    } else {
      console.warn('No Content-Length header from upstream');
    }

    const acceptRanges = response.headers.get('accept-ranges');
    if (acceptRanges) {
      res.setHeader('Accept-Ranges', acceptRanges);
    }

    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    response.body.on('error', (err) => {
      console.error('Upstream stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream error' });
      } else {
        res.end();
      }
    });

    res.on('error', (err) => {
      console.error('Client response error:', err);
      if (response.body && typeof response.body.destroy === 'function') {
        response.body.destroy();
      }
    });

    req.on('close', () => {
      if (response.body && typeof response.body.destroy === 'function') {
        response.body.destroy();
      }
    });

    response.body.pipe(res, { end: true });
  } catch (err) {
    console.error('Proxy error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Proxy request failed' });
    } else {
      res.end();
    }
  }
}

module.exports = {
  proxyHandler
};


