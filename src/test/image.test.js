import { describe, it, expect } from 'vitest';
import {
  validateBillFile,
  MAX_INPUT_BYTES,
  MAX_PDF_BYTES,
  QR_MAX_SIDE,
  fitWithin,
  qrToDataUrl,
  QrError,
} from '../utils/image.js';
import { sanitizeState } from '../storage/storage.js';

describe('validateBillFile', () => {
  it('accepts photos and PDFs', () => {
    expect(validateBillFile({ type: 'image/jpeg', size: 3_000_000 })).toBeNull();
    expect(validateBillFile({ type: 'image/png', size: 100 })).toBeNull();
    expect(validateBillFile({ type: 'application/pdf', size: 1_000_000 })).toBeNull();
  });

  it('rejects other types and oversized files', () => {
    expect(validateBillFile(null)).toMatch(/No file/);
    expect(validateBillFile({ type: 'text/plain', size: 10 })).toMatch(/photo or a PDF/);
    expect(validateBillFile({ type: 'application/pdf', size: MAX_PDF_BYTES + 1 })).toMatch(/PDF is too large/);
    expect(validateBillFile({ type: 'image/jpeg', size: MAX_INPUT_BYTES + 1 })).toMatch(/too large/);
  });
});

describe('receiptId persistence', () => {
  it('keeps a valid receiptId and drops junk', () => {
    const base = { description: 'x', amount: 100, paidBy: 'a', participantIds: ['a'], dateTime: '2026-01-01T00:00:00Z' };
    const state = sanitizeState({
      trips: [
        {
          id: 't',
          name: 'T',
          participants: [{ id: 'a', name: 'A' }],
          expenses: [
            { ...base, id: 'e1', receiptId: 'bill-1' },
            { ...base, id: 'e2', receiptId: 42 },
            { ...base, id: 'e3' },
          ],
        },
      ],
    });
    expect(state.trips[0].expenses.map((e) => e.receiptId)).toEqual(['bill-1', null, null]);
  });
});

describe('fitWithin', () => {
  it('keeps the longer side within max', () => {
    expect(fitWithin(1440, 1080, 720)).toEqual({ w: 720, h: 540 });
    expect(fitWithin(1000, 3000, 720)).toEqual({ w: 240, h: 720 });
    expect(fitWithin(2000, 2000)).toEqual({ w: QR_MAX_SIDE, h: QR_MAX_SIDE });
  });

  it('never upscales', () => {
    expect(fitWithin(300, 200, 720)).toEqual({ w: 300, h: 200 });
    expect(fitWithin(720, 100, 720)).toEqual({ w: 720, h: 100 });
    expect(fitWithin(1, 1, 720)).toEqual({ w: 1, h: 1 });
  });

  it('preserves aspect ratio and keeps each side at least 1', () => {
    const out = fitWithin(1601, 900, 720);
    expect(Math.max(out.w, out.h)).toBeLessThanOrEqual(720);
    expect(Math.abs(out.w / out.h - 1601 / 900)).toBeLessThan(0.01);
    expect(fitWithin(100000, 10, 720)).toEqual({ w: 720, h: 1 });
  });
});

describe('qrToDataUrl rejections', () => {
  const rejectCode = async (file) => {
    try {
      await qrToDataUrl(file);
    } catch (e) {
      expect(e).toBeInstanceOf(QrError);
      return e.code;
    }
    throw new Error('expected rejection');
  };

  it('rejects non-images with code "type"', async () => {
    expect(await rejectCode({ type: 'application/pdf', size: 10 })).toBe('type');
    expect(await rejectCode({ type: 'text/plain', size: 10 })).toBe('type');
    expect(await rejectCode(null)).toBe('type');
    await expect(qrToDataUrl({ type: 'text/plain', size: 10 })).rejects.toThrow(
      'That file isn’t an image. Choose a PNG or JPG.',
    );
  });

  it('checks type before size', async () => {
    expect(await rejectCode({ type: 'application/pdf', size: MAX_INPUT_BYTES + 1 })).toBe('type');
  });

  it('rejects images over 20 MB with code "size"', async () => {
    expect(await rejectCode({ type: 'image/png', size: MAX_INPUT_BYTES + 1 })).toBe('size');
    await expect(qrToDataUrl({ type: 'image/jpeg', size: MAX_INPUT_BYTES + 1 })).rejects.toThrow(
      'That image is too large (max 20 MB).',
    );
  });
});
