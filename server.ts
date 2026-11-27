import express from 'express';
import { createServer as createHttpServer } from 'http';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { chunkStorage } from './src/services/chunkStorage';
import {
  DEFAULT_GCP_PROJECT,
  DEFAULT_VERTEX_LOCATION,
  getAuthStatusSummary,
} from './src/server/geminiClient';
import { attachLiveWebSocketProxy } from './src/server/liveWsProxy';
import { MODEL_REGISTRY } from './src/server/modelRegistry';
import { createTtsRouter } from './src/server/routes/ttsRoutes';
import { createStorageRouter } from './src/server/routes/storageRoutes';
import { createStudioRouter } from './src/server/routes/studioRoutes';
import { createStudyRouter } from './src/server/routes/studyRoutes';
import { createAgentRouter } from './src/server/routes/agentRoutes';

dotenv.config({ override: true });

if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.trim() === '') {
  console.warn(
    `[BOOT] INFO: GEMINI_API_KEY ausente. Utilizando Vertex AI Application Default Credentials (projeto: ${DEFAULT_GCP_PROJECT}, location: ${DEFAULT_VERTEX_LOCATION}).`
  );
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  })
);

app.use('/api/extract-text', express.json({ limit: '25mb' }));
app.use('/api/transcribe-audio', express.json({ limit: '25mb' }));
app.use('/api/live-agent-turn', express.json({ limit: '25mb' }));
app.use('/api/mix-audio', express.json({ limit: '50mb' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Muitas requisições deste endereço. Tente novamente em alguns minutos.',
  },
});
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Limite de requisições de IA atingido. Aguarde alguns minutos e tente novamente.',
  },
});

app.use('/api', apiLimiter);
app.use(
  [
    '/api/extract-text',
    '/api/generate-script',
    '/api/synthesize-turn',
    '/api/mix-audio',
    '/api/preview-voice',
    '/api/synthesize-chunk',
    '/api/synthesize-speech',
    '/api/transcribe-audio',
    '/api/generate-chunks',
    '/api/translate-parallel-chunks',
    '/api/generate-flashcard',
    '/api/live/ticket',
    '/api/live-agent-turn',
    '/api/agent-explore',
  ],
  aiLimiter
);

app.use(createTtsRouter());
app.use(createStorageRouter());
app.use(createStudioRouter());
app.use(createStudyRouter());
app.use(createAgentRouter());

app.get('/api/health', (_req, res) => {
  const storage = chunkStorage.getStorageMode();
  const authStatus = getAuthStatusSummary();
  res.json({
    status: 'online',
    service: 'DialecticPod & FastChunks API',
    modelTts: MODEL_REGISTRY.TTS_FLAGSHIP_MODEL,
    modelTtsFast: MODEL_REGISTRY.TTS_FAST_MODEL,
    modelGen: MODEL_REGISTRY.TEXT_REASONING_MODEL,
    modelFast: MODEL_REGISTRY.TEXT_FAST_MODEL,
    modelTranscribe: MODEL_REGISTRY.TRANSCRIBE_BATCH_MODEL,
    modelLiveAgent: MODEL_REGISTRY.LIVE_AGENT_MODEL,
    modelLiveTranscribe: MODEL_REGISTRY.LIVE_TRANSCRIBE_MODEL,
    authMode: authStatus.authMode,
    geminiKeyConfigured: authStatus.geminiKeyConfigured,
    project: authStatus.project,
    location: authStatus.location,
    storage,
    uptimeSec: Math.round(process.uptime()),
  });
});

app.get('/favicon.ico', (_req, res) => {
  const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0f172a"/><path d="M9 16v-4m4 8V12m4 10V10m4 8v-4m4 2v-1" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round"/></svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.status(200).send(svgIcon);
});

app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint não encontrado: ${req.method} ${req.originalUrl}`,
  });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(
      express.static(path.resolve(__dirname, 'dist'), {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          } else {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );

    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3002;
  const httpServer = createHttpServer(app);
  attachLiveWebSocketProxy(httpServer);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`DialecticPod server listening on http://0.0.0.0:${PORT} (WS /ws/live active)`);
  });
}

startServer().catch((err: unknown) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
