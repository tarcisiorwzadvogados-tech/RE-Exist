import { describe, it, expect } from 'vitest';
import { imageReducer, initialImageState } from './useImageState';
import { sessionReducer, initialSessionState } from './useSessionState';
import { uiReducer, initialUIState } from './useUIState';
import { RestorationLog } from '../types';

// ─── imageReducer ──────────────────────────────────────────────────────────────

describe('imageReducer', () => {
  it('LOAD_FILE opens crop modal and sets rawImage + fileName', () => {
    const state = imageReducer(initialImageState, {
      type: 'LOAD_FILE',
      rawImage: 'data:image/png;base64,abc',
      fileName: 'grandma',
    });
    expect(state.rawImage).toBe('data:image/png;base64,abc');
    expect(state.originalFileName).toBe('grandma');
    expect(state.isCropping).toBe(true);
    expect(state.restoredImage).toBeNull();
  });

  it('LOAD_FILE clears previous restoredImage', () => {
    const withRestored = { ...initialImageState, restoredImage: 'data:image/png;base64,old' };
    const state = imageReducer(withRestored, { type: 'LOAD_FILE', rawImage: 'new', fileName: 'file' });
    expect(state.restoredImage).toBeNull();
  });

  it('CONFIRM_CROP sets originalImage and closes crop modal', () => {
    const state = imageReducer(
      { ...initialImageState, isCropping: true },
      { type: 'CONFIRM_CROP', croppedImage: 'data:image/jpeg;base64,cropped', aspectRatio: '16:9' },
    );
    expect(state.originalImage).toBe('data:image/jpeg;base64,cropped');
    expect(state.detectedAspectRatio).toBe('16:9');
    expect(state.isCropping).toBe(false);
  });

  it('CLOSE_CROP sets isCropping to false', () => {
    const state = imageReducer({ ...initialImageState, isCropping: true }, { type: 'CLOSE_CROP' });
    expect(state.isCropping).toBe(false);
  });

  it('REOPEN_CROP sets rawImage to originalImage and opens crop modal', () => {
    const withOriginal = { ...initialImageState, originalImage: 'data:image/jpeg;base64,orig' };
    const state = imageReducer(withOriginal, { type: 'REOPEN_CROP' });
    expect(state.rawImage).toBe('data:image/jpeg;base64,orig');
    expect(state.isCropping).toBe(true);
  });

  it('SET_RESTORED_IMAGE sets restoredImage', () => {
    const state = imageReducer(initialImageState, { type: 'SET_RESTORED_IMAGE', payload: 'data:image/png;base64,restored' });
    expect(state.restoredImage).toBe('data:image/png;base64,restored');
  });

  it('START_RESTORING sets isRestoring to true', () => {
    const state = imageReducer(initialImageState, { type: 'START_RESTORING' });
    expect(state.isRestoring).toBe(true);
  });

  it('STOP_RESTORING sets isRestoring to false', () => {
    const state = imageReducer({ ...initialImageState, isRestoring: true }, { type: 'STOP_RESTORING' });
    expect(state.isRestoring).toBe(false);
  });

  it('DISCARD resets to initial state', () => {
    const dirty = {
      rawImage: 'raw',
      originalImage: 'orig',
      restoredImage: 'restored',
      originalFileName: 'grandma',
      detectedAspectRatio: '16:9',
      isRestoring: true,
      isCropping: true,
    };
    const state = imageReducer(dirty, { type: 'DISCARD' });
    expect(state).toEqual(initialImageState);
  });
});

// ─── sessionReducer ────────────────────────────────────────────────────────────

const fakeLog: RestorationLog = {
  id: 'ABC123',
  timestamp: new Date('2025-01-01'),
  model: 'Nano Banana Pro',
  resolution: '2K',
  cost: 0.06,
  fileName: 'grandma',
  prompt: 'restore',
};

describe('sessionReducer', () => {
  it('ADD_LOG prepends log and updates currentCost', () => {
    const state = sessionReducer(initialSessionState, { type: 'ADD_LOG', log: fakeLog });
    expect(state.restorationHistory).toHaveLength(1);
    expect(state.restorationHistory[0]).toBe(fakeLog);
    expect(state.currentCost).toBe(0.06);
  });

  it('ADD_LOG keeps existing history', () => {
    const withOne = sessionReducer(initialSessionState, { type: 'ADD_LOG', log: fakeLog });
    const log2 = { ...fakeLog, id: 'DEF456', cost: 0.03 };
    const state = sessionReducer(withOne, { type: 'ADD_LOG', log: log2 });
    expect(state.restorationHistory).toHaveLength(2);
    expect(state.restorationHistory[0].id).toBe('DEF456'); // newest first
  });

  it('RESET clears history and currentCost', () => {
    const withHistory = sessionReducer(initialSessionState, { type: 'ADD_LOG', log: fakeLog });
    const state = sessionReducer(withHistory, { type: 'RESET' });
    expect(state.restorationHistory).toHaveLength(0);
    expect(state.currentCost).toBeNull();
  });

  it('SET_PROMPT updates prompt', () => {
    const state = sessionReducer(initialSessionState, { type: 'SET_PROMPT', payload: 'new prompt' });
    expect(state.prompt).toBe('new prompt');
  });

  it('LOAD_HISTORY replaces history array', () => {
    const state = sessionReducer(initialSessionState, { type: 'LOAD_HISTORY', history: [fakeLog] });
    expect(state.restorationHistory).toEqual([fakeLog]);
  });
});

// ─── uiReducer ─────────────────────────────────────────────────────────────────

describe('uiReducer', () => {
  it('SET_DRAGGING updates isDragging', () => {
    const state = uiReducer(initialUIState, { type: 'SET_DRAGGING', payload: true });
    expect(state.isDragging).toBe(true);
  });

  it('TOGGLE_DOWNLOAD_MENU toggles showDownloadMenu', () => {
    const open = uiReducer(initialUIState, { type: 'TOGGLE_DOWNLOAD_MENU' });
    expect(open.showDownloadMenu).toBe(true);
    const closed = uiReducer(open, { type: 'TOGGLE_DOWNLOAD_MENU' });
    expect(closed.showDownloadMenu).toBe(false);
  });

  it('CLOSE_DOWNLOAD_MENU closes menu', () => {
    const open = { ...initialUIState, showDownloadMenu: true };
    const state = uiReducer(open, { type: 'CLOSE_DOWNLOAD_MENU' });
    expect(state.showDownloadMenu).toBe(false);
  });

  it('SET_ERROR sets error message', () => {
    const state = uiReducer(initialUIState, { type: 'SET_ERROR', payload: 'oops' });
    expect(state.error).toBe('oops');
  });

  it('SET_ERROR with null clears error', () => {
    const withError = { ...initialUIState, error: 'oops' };
    const state = uiReducer(withError, { type: 'SET_ERROR', payload: null });
    expect(state.error).toBeNull();
  });

  it('SET_HAS_API_KEY updates hasApiKey', () => {
    const state = uiReducer(initialUIState, { type: 'SET_HAS_API_KEY', payload: true });
    expect(state.hasApiKey).toBe(true);
  });

  it('SET_MODEL updates selectedModel', () => {
    const state = uiReducer(initialUIState, { type: 'SET_MODEL', payload: 'gemini-3.1-flash-image-preview' });
    expect(state.selectedModel).toBe('gemini-3.1-flash-image-preview');
  });

  it('SET_MODEL auto-downgrades 4K to 2K when switching to flash', () => {
    const with4K = { ...initialUIState, selectedResolution: '4K', selectedModel: 'gemini-3-pro-image-preview' };
    const state = uiReducer(with4K, { type: 'SET_MODEL', payload: 'gemini-3.1-flash-image-preview' });
    expect(state.selectedResolution).toBe('2K');
  });

  it('SET_MODEL keeps resolution when switching to pro', () => {
    const with2K = { ...initialUIState, selectedResolution: '2K' };
    const state = uiReducer(with2K, { type: 'SET_MODEL', payload: 'gemini-3-pro-image-preview' });
    expect(state.selectedResolution).toBe('2K');
  });

  it('SET_RESOLUTION updates selectedResolution', () => {
    const state = uiReducer(initialUIState, { type: 'SET_RESOLUTION', payload: '4K' });
    expect(state.selectedResolution).toBe('4K');
  });

  it('TOGGLE_THEME switches lightroom to darkroom', () => {
    const state = uiReducer(initialUIState, { type: 'TOGGLE_THEME' });
    expect(state.theme).toBe('darkroom');
  });

  it('TOGGLE_THEME switches darkroom back to lightroom', () => {
    const dark = { ...initialUIState, theme: 'darkroom' as const };
    const state = uiReducer(dark, { type: 'TOGGLE_THEME' });
    expect(state.theme).toBe('lightroom');
  });

  it('SET_MANIFESTO shows manifesto', () => {
    const hidden = { ...initialUIState, showManifesto: false };
    const state = uiReducer(hidden, { type: 'SET_MANIFESTO', payload: true });
    expect(state.showManifesto).toBe(true);
  });
});
