import { describe, it, expect } from 'vitest';
import { escapeXml, getClosestAspectRatio, rotateSize } from './utils';

describe('escapeXml', () => {
  it('escapes double quotes', () => {
    expect(escapeXml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeXml("it's")).toBe('it&apos;s');
  });

  it('escapes angle brackets', () => {
    expect(escapeXml('<b>bold</b>')).toBe('&lt;b&gt;bold&lt;/b&gt;');
  });

  it('escapes ampersands', () => {
    expect(escapeXml('bread & butter')).toBe('bread &amp; butter');
  });

  it('escapes all special chars in one string', () => {
    expect(escapeXml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('returns clean string unchanged', () => {
    expect(escapeXml('hello world')).toBe('hello world');
  });

  it('returns empty string unchanged', () => {
    expect(escapeXml('')).toBe('');
  });
});

describe('getClosestAspectRatio', () => {
  it('returns 1:1 for a square image', () => {
    expect(getClosestAspectRatio(100, 100)).toBe('1:1');
  });

  it('returns 16:9 for a widescreen image', () => {
    expect(getClosestAspectRatio(1920, 1080)).toBe('16:9');
  });

  it('returns 9:16 for a portrait widescreen image', () => {
    expect(getClosestAspectRatio(1080, 1920)).toBe('9:16');
  });

  it('returns 4:3 for a standard photo', () => {
    expect(getClosestAspectRatio(800, 600)).toBe('4:3');
  });

  it('returns 3:4 for a portrait standard photo', () => {
    expect(getClosestAspectRatio(600, 800)).toBe('3:4');
  });

  it('returns closest ratio for an irregular size', () => {
    // 1024x768 is almost exactly 4:3
    expect(getClosestAspectRatio(1024, 768)).toBe('4:3');
  });

  it('returns 8:1 for a very wide panorama', () => {
    expect(getClosestAspectRatio(800, 100)).toBe('8:1');
  });

  it('returns 1:8 for a very tall image', () => {
    expect(getClosestAspectRatio(100, 800)).toBe('1:8');
  });
});

describe('rotateSize', () => {
  it('returns same dimensions for 0 degree rotation', () => {
    const { width, height } = rotateSize(100, 50, 0);
    expect(width).toBeCloseTo(100);
    expect(height).toBeCloseTo(50);
  });

  it('swaps dimensions for 90 degree rotation', () => {
    const { width, height } = rotateSize(100, 50, 90);
    expect(width).toBeCloseTo(50);
    expect(height).toBeCloseTo(100);
  });

  it('swaps dimensions for 270 degree rotation', () => {
    const { width, height } = rotateSize(100, 50, 270);
    expect(width).toBeCloseTo(50);
    expect(height).toBeCloseTo(100);
  });

  it('returns same dimensions for 180 degree rotation', () => {
    const { width, height } = rotateSize(100, 50, 180);
    expect(width).toBeCloseTo(100);
    expect(height).toBeCloseTo(50);
  });

  it('returns enlarged bounding box for 45 degree rotation', () => {
    const { width, height } = rotateSize(100, 100, 45);
    // diagonal of 100x100 square = 100√2 ≈ 141.4
    expect(width).toBeCloseTo(141.4, 0);
    expect(height).toBeCloseTo(141.4, 0);
  });
});
