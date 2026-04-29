import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json({ limit: '100mb' }));

const PORT = process.env.PORT || 3001;
const INLINE_THRESHOLD = 6_000_000;

app.get('/api/status', (_req, res) => {
  res.json({ proxyAvailable: !!process.env.GEMINI_API_KEY });
});

app.post('/api/restore', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY not configured on server.' });
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (ai.models.generateContent as any)({
      model,
      contents: { parts: [imagePart, { text: prompt }] },
      config: { imageConfig: { imageSize: resolution, aspectRatio } },
    });

    if (uploadedFileName) ai.files.delete(uploadedFileName).catch(() => {});

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        res.json({ imageDataUrl: `data:image/png;base64,${part.inlineData.data}` });
        return;
      }
    }

    res.status(500).json({ error: 'Model did not return an image.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`RE-EXIST proxy server running on http://localhost:${PORT}`);
});
