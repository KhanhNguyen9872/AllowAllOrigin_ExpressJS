// Route đơn giản check health của server
function healthHandler(req, res) {
  res.json({ status: 'ok', message: 'Proxy server is running' });
}

module.exports = {
  healthHandler
};


