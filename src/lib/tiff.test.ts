import { describe, it, expect, vi, beforeEach } from 'vitest';
import { decodeTiffFile } from './tiff';

vi.mock('utif', () => ({
  default: {
    decode: vi.fn(),
    decodeImage: vi.fn(),
    toRGBA8: vi.fn(),
    encodeImage: vi.fn(),
    encode: vi.fn(),
  },
}));

import UTIF from 'utif';

const makeFile = (name: string) => new File([new Uint8Array(100)], name, { type: 'image/tiff' });

let fileReaderOnLoad: ((e: any) => void) | null = null;

function mockFileReader(result: ArrayBuffer) {
  class MockFileReader {
    onload: ((e: any) => void) | null = null;
    readAsArrayBuffer(_file: any) {
      fileReaderOnLoad = this.onload;
      // Trigger asynchronously so the promise chain can set onload first
      Promise.resolve().then(() => this.onload?.({ target: { result } }));
    }
  }
  global.FileReader = MockFileReader as any;
}

function mockCanvas(width: number, height: number, nullCtx = false) {
  const ctx = nullCtx ? null : {
    createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(Math.max(width * height * 4, 1)) })),
    putImageData: vi.fn(),
  };
  const canvas = {
    width: 0, height: 0,
    getContext: vi.fn(() => ctx),
    toDataURL: vi.fn(() => 'data:image/png;base64,abc'),
  };
  vi.spyOn(document, 'createElement').mockReturnValue(canvas as any);
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('decodeTiffFile', () => {
  it('rejects with "Invalid TIFF file." when no IFDs are decoded', async () => {
    mockFileReader(new ArrayBuffer(100));
    vi.mocked(UTIF.decode).mockReturnValue([]);

    await expect(decodeTiffFile(makeFile('test.tiff'))).rejects.toThrow('Invalid TIFF file.');
  });

  it('resolves with a data URL when UTIF decodes a valid TIFF', async () => {
    mockFileReader(new ArrayBuffer(100));
    const fakeIfd = { width: 100, height: 50 } as any;
    vi.mocked(UTIF.decode).mockReturnValue([fakeIfd]);
    vi.mocked(UTIF.decodeImage).mockImplementation(() => {});
    vi.mocked(UTIF.toRGBA8).mockReturnValue(new Uint8Array(100 * 50 * 4));
    mockCanvas(100, 50);

    const result = await decodeTiffFile(makeFile('test.tiff'));
    expect(result).toBe('data:image/png;base64,abc');
  });

  it('rejects when TIFF dimensions are zero', async () => {
    mockFileReader(new ArrayBuffer(100));
    const fakeIfd = { width: 0, height: 0 } as any;
    vi.mocked(UTIF.decode).mockReturnValue([fakeIfd]);
    vi.mocked(UTIF.decodeImage).mockImplementation(() => {});
    vi.mocked(UTIF.toRGBA8).mockReturnValue(new Uint8Array(1));
    mockCanvas(0, 0);

    await expect(decodeTiffFile(makeFile('test.tiff'))).rejects.toThrow('Invalid TIFF dimensions');
  });

  it('rejects when canvas context is unavailable', async () => {
    mockFileReader(new ArrayBuffer(100));
    const fakeIfd = { width: 10, height: 10 } as any;
    vi.mocked(UTIF.decode).mockReturnValue([fakeIfd]);
    vi.mocked(UTIF.decodeImage).mockImplementation(() => {});
    vi.mocked(UTIF.toRGBA8).mockReturnValue(new Uint8Array(10 * 10 * 4));
    mockCanvas(10, 10, true);

    await expect(decodeTiffFile(makeFile('test.tiff'))).rejects.toThrow('Canvas context unavailable');
  });
});
