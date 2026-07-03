import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compressImageIfNeeded } from './utils';

const makeDataUrl = (rawBytes: number) => {
  // base64 length ≈ raw * 4/3; build a data URL whose payload decodes to ~rawBytes
  const b64Len = Math.ceil((rawBytes * 4) / 3);
  return `data:image/png;base64,${'A'.repeat(b64Len)}`;
};

const originalImage = global.Image;
const originalCreateElement = document.createElement.bind(document);

function mockImage(width: number, height: number) {
  global.Image = vi.fn().mockImplementation(function (this: HTMLImageElement) {
    Object.assign(this, { width, height });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).addEventListener = (event: string, cb: () => void) => {
      if (event === 'load') Promise.resolve().then(cb);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).setAttribute = () => {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

describe('compressImageIfNeeded', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.Image = originalImage;
  });

  it('returns the original data URL when image is small in bytes and dimensions', async () => {
    mockImage(1200, 800);
    const dataUrl = makeDataUrl(1 * 1024 * 1024); // 1MB
    const result = await compressImageIfNeeded(dataUrl);
    expect(result).toBe(dataUrl);
  });

  it('compresses when raw size exceeds 4MB', async () => {
    mockImage(3000, 2000);
    const fakeCtx = { drawImage: vi.fn() };
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(fakeCtx),
      toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,COMPRESSED'),
    };
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
      tag === 'canvas' ? fakeCanvas : originalCreateElement(tag)) as typeof document.createElement);

    const result = await compressImageIfNeeded(makeDataUrl(10 * 1024 * 1024)); // 10MB
    expect(result).toBe('data:image/jpeg;base64,COMPRESSED');
    expect(fakeCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.9);
    // 3000px < 4000px cap → no downscale, dimensions preserved
    expect(fakeCanvas.width).toBe(3000);
    expect(fakeCanvas.height).toBe(2000);
  });

  it('downscales to the 4000px cap when dimensions exceed it', async () => {
    mockImage(8000, 4000);
    const fakeCtx = { drawImage: vi.fn() };
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(fakeCtx),
      toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,SCALED'),
    };
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
      tag === 'canvas' ? fakeCanvas : originalCreateElement(tag)) as typeof document.createElement);

    const result = await compressImageIfNeeded(makeDataUrl(1 * 1024 * 1024)); // small bytes, huge pixels
    expect(result).toBe('data:image/jpeg;base64,SCALED');
    expect(fakeCanvas.width).toBe(4000);
    expect(fakeCanvas.height).toBe(2000);
  });

  it('falls back to the original when canvas context is unavailable', async () => {
    mockImage(8000, 4000);
    const fakeCanvas = { width: 0, height: 0, getContext: vi.fn().mockReturnValue(null) };
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
      tag === 'canvas' ? fakeCanvas : originalCreateElement(tag)) as typeof document.createElement);

    const dataUrl = makeDataUrl(10 * 1024 * 1024);
    const result = await compressImageIfNeeded(dataUrl);
    expect(result).toBe(dataUrl);
  });
});
