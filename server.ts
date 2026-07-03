import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import pino from 'pino';
import PQueue from 'p-queue';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const app = express();
app.use(
  helmet({
    // SPA serves inline scripts/styles from Vite build; CSP tuned for that
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'img-src': ["'self'", 'data:', 'blob:'],
        'connect-src': ["'self'", 'https://generativelanguage.googleapis.com'],
      },
    },
  })
);
app.use(express.json({ limit: '20mb' }));

const PORT = process.env.PORT || 3001;
const INLINE_THRESHOLD = 6_000_000;
const startedAt = Date.now();

// Concurrency gate: at most 5 in-flight Gemini calls; excess requests wait in line
// instead of blowing the API quota. In-process by design — move to Redis only if
// this ever runs multi-instance.
const geminiQueue = new PQueue({ concurrency: 5 });

// Daily global spend cap. The cap — not traffic — defines max daily Gemini cost.
const DAILY_CAP = Number(process.env.DAILY_RESTORE_CAP || 200);
let dailyCount = 0;
let dailyCountDate = new Date().toDateString();

function checkDailyCap(): boolean {
  const today = new Date().toDateString();
  if (today !== dailyCountDate) {
    dailyCountDate = today;
    dailyCount = 0;
  }
  return dailyCount < DAILY_CAP;
}

const restoreLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded. Try again in a few minutes.' },
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    queueSize: geminiQueue.size,
    queuePending: geminiQueue.pending,
    dailyUsed: dailyCount,
    dailyCap: DAILY_CAP,
  });
});

app.get('/api/status', (_req, res) => {
  res.json({ proxyAvailable: !!process.env.GEMINI_API_KEY });
});

const RETRYABLE = [429, 500, 503];

async function generateWithRetry(
  ai: GoogleGenAI,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any,
  maxAttempts = 3
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await (ai.models.generateContent as any)(params);
    } catch (err: unknown) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : '';
      const retryable = RETRYABLE.some((code) => msg.includes(String(code)));
      if (!retryable || attempt === maxAttempts) throw err;
      const delayMs = 1000 * 2 ** (attempt - 1);
      logger.warn({ attempt, delayMs, error: msg }, 'gemini retryable error, backing off');
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

app.post('/api/restore', restoreLimiter, async (req, res) => {
  const startMs = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY not configured on server.' });
    return;
  }

  if (!checkDailyCap()) {
    logger.warn({ dailyCount, dailyCap: DAILY_CAP }, 'daily cap reached');
    res.status(429).json({ error: 'Daily restoration limit reached. Try again tomorrow or use your own API key.' });
    return;
  }

  const { imageDataUrl, prompt, model, resolution, aspectRatio } = req.body as {
    imageDataUrl: string;
    prompt: string;
    model: string;
    resolution: string;
    aspectRatio: string;
  };

  if (!imageDataUrl || !prompt || !model) {
    res.status(400).json({ error: 'Missing required fields.' });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const commaIndex = imageDataUrl.indexOf(',');
    if (commaIndex === -1) {
      res.status(400).json({ error: 'Invalid image data URL.' });
      return;
    }
    const base64Data = imageDataUrl.slice(commaIndex + 1);
    const mimeType = imageDataUrl.slice(0, commaIndex).split(';')[0].split(':')[1];

    const rawSize = Math.floor(base64Data.length * 0.75);
    let imagePart: Record<string, unknown>;
    let uploadedFileName: string | undefined;

    if (rawSize >= INLINE_THRESHOLD) {
      const buffer = Buffer.from(base64Data, 'base64');
      const blob = new Blob([buffer], { type: mimeType });
      const uploaded = await ai.files.upload({ file: blob, config: { mimeType, displayName: 're-exist-proxy' } });
      uploadedFileName = uploaded.name!;
      imagePart = { fileData: { fileUri: uploaded.uri!, mimeType } };
    } else {
      imagePart = { inlineData: { data: base64Data, mimeType } };
    }

    dailyCount++;
    const response = await geminiQueue.add(() =>
      generateWithRetry(ai, {
        model,
        contents: { parts: [imagePart, { text: prompt }] },
        config: { imageConfig: { imageSize: resolution, aspectRatio } },
      })
    );

    if (uploadedFileName) ai.files.delete({ name: uploadedFileName }).catch(() => {});

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        logger.info(
          { model, resolution, rawSizeBytes: rawSize, viaFilesApi: !!uploadedFileName, durationMs: Date.now() - startMs, outcome: 'success' },
          'restore completed'
        );
        res.json({ imageDataUrl: `data:image/png;base64,${part.inlineData.data}` });
        return;
      }
    }

    logger.warn({ model, resolution, durationMs: Date.now() - startMs, outcome: 'no_image' }, 'model returned no image');
    res.status(500).json({ error: 'Model did not return an image.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ model, durationMs: Date.now() - startMs, error: msg, outcome: 'error' }, 'restore failed');
    res.status(500).json({ error: msg });
  }
});

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Guard listen so supertest can import `app` without binding a port
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info({ port: PORT }, 'RE-EXIST proxy server running');
  });
}

export { app };
