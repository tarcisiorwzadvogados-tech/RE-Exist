import { useReducer } from 'react';
import { Theme } from '../types';
import { MODELS } from '../lib/constants';

export interface UIState {
  isDragging: boolean;
  showDownloadMenu: boolean;
  error: string | null;
  hasApiKey: boolean;
  selectedModel: string;
  selectedResolution: string;
  showManifesto: boolean;
  theme: Theme;
}

export type UIAction =
  | { type: 'SET_DRAGGING'; payload: boolean }
  | { type: 'TOGGLE_DOWNLOAD_MENU' }
  | { type: 'CLOSE_DOWNLOAD_MENU' }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_HAS_API_KEY'; payload: boolean }
  | { type: 'SET_MODEL'; payload: string }
  | { type: 'SET_RESOLUTION'; payload: string }
  | { type: 'SET_MANIFESTO'; payload: boolean }
  | { type: 'TOGGLE_THEME' };

export const initialUIState: UIState = {
  isDragging: false,
  showDownloadMenu: false,
  error: null,
  hasApiKey: false,
  selectedModel: MODELS[1].id,
  selectedResolution: '1K',
  showManifesto: true,
  theme: 'lightroom',
};

export function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'SET_DRAGGING':
      return { ...state, isDragging: action.payload };
    case 'TOGGLE_DOWNLOAD_MENU':
      return { ...state, showDownloadMenu: !state.showDownloadMenu };
    case 'CLOSE_DOWNLOAD_MENU':
      return { ...state, showDownloadMenu: false };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_HAS_API_KEY':
      return { ...state, hasApiKey: action.payload };
    case 'SET_MODEL':
      return {
        ...state,
        selectedModel: action.payload,
        // flash doesn't support 4K — auto-downgrade
        selectedResolution:
          action.payload.includes('flash') && state.selectedResolution === '4K'
            ? '2K'
            : state.selectedResolution,
      };
    case 'SET_RESOLUTION':
      return { ...state, selectedResolution: action.payload };
    case 'SET_MANIFESTO':
      return { ...state, showManifesto: action.payload };
    case 'TOGGLE_THEME':
      return { ...state, theme: state.theme === 'lightroom' ? 'darkroom' : 'lightroom' };
    default:
      return state;
  }
}

export function useUIState() {
  return useReducer(uiReducer, initialUIState);
}
