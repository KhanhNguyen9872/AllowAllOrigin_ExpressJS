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

    const origin = req.headers.origin;
    // Phản hồi CORS cho mọi origin (hoặc giới hạn qua ALLOWED_ORIGINS)
    if (origin && (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    const contentType = response.headers.get('content-type') || '';
    const contentDisposition = response.headers.get('content-disposition');

    const isAttachment =
      !!contentDisposition && /attachment/i.test(contentDisposition);

    const isMediaType =
      // Video / audio / image
      /^video\//i.test(contentType) ||
      /^audio\//i.test(contentType) ||
      /^image\//i.test(contentType) ||
      // HLS playlist: nhiều server set các dạng khác nhau
      /mpegurl/i.test(contentType) || // application/vnd.apple.mpegurl, application/x-mpegURL, ...
      /m3u8/i.test(contentType) ||
      /application\/vnd\.apple\.mpegurl/i.test(contentType) ||
      /application\/x-mpegURL/i.test(contentType) ||
      // Streaming text (SSE, logs liên tục, v.v.)
      /^text\/event-stream/i.test(contentType) ||
      // Một số dạng file application phổ biến có thể stream
      /^application\/octet-stream/i.test(contentType) ||
      /^application\/pdf/i.test(contentType) ||
      /^application\/zip/i.test(contentType) ||
      /^application\/x-7z-compressed/i.test(contentType) ||
      /^application\/x-rar-compressed/i.test(contentType) ||
      /^application\/vnd\.ms-/i.test(contentType) ||
      /^application\/vnd\.openxmlformats-officedocument/i.test(contentType);

    const isBinary =
      isAttachment ||
      isMediaType ||
      (!/^text\//i.test(contentType) &&
        !/^application\/json/i.test(contentType) &&
        !/javascript/i.test(contentType));

    // Nhánh 1: nội dung binary / file download -> stream trực tiếp từ server lên client
    if (isBinary) {
      if (!response.ok) {
        // Giữ lại lỗi nhưng vẫn forward status code từ upstream
        res.status(response.status);
      }

      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }

      if (contentDisposition) {
        res.setHeader('Content-Disposition', contentDisposition);
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

      const contentRange = response.headers.get('content-range');
      if (contentRange) {
        res.setHeader('Content-Range', contentRange);
      }

      const etag = response.headers.get('etag');
      if (etag) {
        res.setHeader('ETag', etag);
      }

      const lastModified = response.headers.get('last-modified');
      if (lastModified) {
        res.setHeader('Last-Modified', lastModified);
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

      return response.body.pipe(res, { end: true });
    }

    // Nhánh 2: nội dung text/JSON -> đọc hết rồi trả về
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Upstream error' });
    }

    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    res.setHeader('Cache-Control', 'no-cache');

    if (/^application\/json/i.test(contentType || '')) {
      const data = await response.json();
      return res.json(data);
    }

    const text = await response.text();
    return res.send(text);
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


