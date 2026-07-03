import { createImage } from './utils';

// Builds a side-by-side before/after composite — the shareable viral asset.
// Uses Web Share API when available (mobile), falls back to file download.
export async function shareBeforeAfter(
  originalUrl: string,
  restoredUrl: string,
  fileName: string
): Promise<'shared' | 'downloaded'> {
  const [before, after] = await Promise.all([createImage(originalUrl), createImage(restoredUrl)]);

  const height = Math.min(1080, after.height);
  const beforeW = Math.round((before.width / before.height) * height);
  const afterW = Math.round((after.width / after.height) * height);
  const gap = Math.round(height * 0.01);
  const footer = Math.round(height * 0.06);

  const canvas = document.createElement('canvas');
  canvas.width = beforeW + gap + afterW;
  canvas.height = height + footer;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(before, 0, 0, beforeW, height);
  ctx.drawImage(after, beforeW + gap, 0, afterW, height);

  const labelFont = Math.max(14, Math.round(height * 0.025));
  ctx.font = `bold ${labelFont}px monospace`;
  ctx.textBaseline = 'top';
  const drawLabel = (text: string, x: number, bg: string) => {
    const pad = labelFont * 0.5;
    const w = ctx.measureText(text).width + pad * 2;
    ctx.fillStyle = bg;
    ctx.fillRect(x, pad, w, labelFont + pad);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x + pad, pad * 1.5);
  };
  drawLabel('ANTES', labelFont, 'rgba(0,0,0,0.65)');
  drawLabel('DEPOIS', beforeW + gap + labelFont, 'rgba(16,185,129,0.85)');

  ctx.fillStyle = '#9ca3af';
  ctx.font = `${Math.max(12, Math.round(footer * 0.45))}px monospace`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(
    'RE-EXIST · Restauração com IA · re-exist.app',
    canvas.width / 2,
    height + footer / 2
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.92)
  );
  if (!blob) throw new Error('Failed to encode composite');

  const file = new File([blob], `${fileName}_antes-depois.jpg`, { type: 'image/jpeg' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'RE-EXIST — Restauração de foto com IA',
        text: 'Olha essa restauração que fiz no RE-EXIST',
      });
      return 'shared';
    } catch {
      // User cancelled or share failed — fall through to download
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
}
