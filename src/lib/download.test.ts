import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadImage } from './download';
import { RestorationLog } from '../types';

vi.mock('utif', () => ({
  default: {
    encodeImage: vi.fn(() => new Uint8Array(10)),
    decode: vi.fn(() => [{}]),
    encode: vi.fn(() => new Uint8Array(10)),
  },
}));

vi.mock('piexifjs', () => ({
  ImageIFD: { ImageDescription: 270, Software: 305, Artist: 315, DateTime: 306 },
  ExifIFD: { UserComment: 37510 },
  dump: vi.fn(() => 'exif-bytes'),
  insert: vi.fn((_, base64) => base64),
}));

vi.mock('./pdf', () => ({
  generateCertificatePDF: vi.fn(),
}));

import { generateCertificatePDF } from './pdf';

const fakeLog: RestorationLog = {
  id: 'ABC123',
  timestamp: new Date('2025-01-01'),
  model: 'Nano Banana Pro',
  resolution: '2K',
  cost: 0.06,
  fileName: 'grandma',
  prompt: 'restore it',
};

function setupDomMocks() {
  const fakeImgProps = { width: 200, height: 100 };

  global.Image = vi.fn().mockImplementation(function (this: any) {
    Object.assign(this, fakeImgProps);
    this.addEventListener = (event: string, cb: () => void) => {
      if (event === 'load') Promise.resolve().then(cb);
    };
    this.setAttribute = vi.fn();
  }) as any;

  const ctx = {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(200 * 100 * 4) })),
  };
  const fakeCanvas = {
    width: 200,
    height: 100,
    getContext: vi.fn(() => ctx),
    toDataURL: vi.fn(() => 'data:image/jpeg;base64,fakejpeg'),
  };
  const fakeLink = { href: '', download: '', click: vi.fn() };

  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'canvas') return fakeCanvas as any;
    if (tag === 'a') return fakeLink as any;
    return document.createElement(tag);
  });

  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake-url');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

  return { fakeLink };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('downloadImage', () => {
  it('calls generateCertificatePDF and onClose for pdf format', async () => {
    setupDomMocks();
    const onClose = vi.fn();

    await downloadImage({
      format: 'pdf',
      restoredImage: 'data:image/png;base64,abc',
      originalFileName: 'grandma',
      restorationHistory: [fakeLog],
      selectedResolution: '2K',
      prompt: 'restore',
      onClose,
    });

    expect(generateCertificatePDF).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls link.click() and onClose for png format', async () => {
    const { fakeLink } = setupDomMocks();
    const onClose = vi.fn();

    await downloadImage({
      format: 'png',
      restoredImage: 'data:image/png;base64,abc',
      originalFileName: 'grandma',
      restorationHistory: [fakeLog],
      selectedResolution: '1K',
      prompt: 'restore',
      onClose,
    });

    expect(fakeLink.click).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('revokes object URL after tiff download', async () => {
    setupDomMocks();
    const onClose = vi.fn();

    await downloadImage({
      format: 'tiff',
      restoredImage: 'data:image/png;base64,abc',
      originalFileName: 'grandma',
      restorationHistory: [fakeLog],
      selectedResolution: '1K',
      prompt: 'restore',
      onClose,
    });

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does NOT revoke object URL for png format', async () => {
    setupDomMocks();
    const onClose = vi.fn();

    await downloadImage({
      format: 'png',
      restoredImage: 'data:image/png;base64,abc',
      originalFileName: 'grandma',
      restorationHistory: [fakeLog],
      selectedResolution: '1K',
      prompt: 'restore',
      onClose,
    });

    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('sets correct filename for jpg download', async () => {
    const { fakeLink } = setupDomMocks();
    const onClose = vi.fn();

    await downloadImage({
      format: 'jpg',
      restoredImage: 'data:image/png;base64,abc',
      originalFileName: 'grandma',
      restorationHistory: [fakeLog],
      selectedResolution: '1K',
      prompt: 'restore',
      onClose,
    });

    expect(fakeLink.download).toBe('grandma_restored.jpg');
  });
});
