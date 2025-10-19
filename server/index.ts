import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';

function createServer() {
  const app = express();
  const PORT = process.env.PORT || 9001;
  const API_TARGET = process.env.API_TARGET || 'http://localhost:9002';

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

  // Proxy /api/ requests to the API server
  app.use('/api', createProxyMiddleware({
    target: API_TARGET,
    changeOrigin: true,
    logLevel: 'info'
  }));

  // Serve static files from dist directory
  app.use(express.static(path.join(process.cwd(), 'dist')));

  // Serve index.html for all other routes (SPA fallback)
  app.get('*', (_req, res) => {
    res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
    console.log(`Proxying /api/* requests to ${API_TARGET}`);
  });
}

createServer();
