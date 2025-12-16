// Helper để forward headers từ user request sang upstream
function getForwardHeaders(req) {
  const forwardHeaders = {};
  const headersToSkip = [
    'host',
    'connection',
    'content-length',
    'transfer-encoding',
    'upgrade',
    'x-forwarded-for',
    'x-forwarded-proto',
    'x-forwarded-host'
  ];

  Object.keys(req.headers).forEach((key) => {
    const lowerKey = key.toLowerCase();
    if (!headersToSkip.includes(lowerKey)) {
      forwardHeaders[key] = req.headers[key];
    }
  });

  return forwardHeaders;
}

module.exports = {
  getForwardHeaders
};


