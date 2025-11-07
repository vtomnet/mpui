import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';

function createServer() {
  const app = express();
  const PORT = process.env.PORT || 8002;
  const API_PROXY_PORT = process.env.API_PROXY_PORT || 8003;

  // Logging middleware
  app.use((req, res, next) => {
    const start = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - start;
      console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ` +
        `Status: ${res.statusCode} - ${duration}ms`
      );
    });

    next();
  });

  // Proxy /api/ requests to the backend API server
  app.use('/api', createProxyMiddleware({
    target: `http://localhost:${API_PROXY_PORT}`,
    changeOrigin: true,
  }));

  // Serve static files from dist directory
  app.use(express.static(path.join(process.cwd(), 'dist')));

  // Serve index.html for all other routes (SPA fallback)
  app.get('*', (_req, res) => {
    res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
    console.log(`Proxying /api requests to http://localhost:${API_PROXY_PORT}`);
  });
}

createServer();
