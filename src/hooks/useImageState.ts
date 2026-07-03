import { useReducer } from 'react';

export interface ImageState {
  rawImage: string | null;
  originalImage: string | null;
  restoredImage: string | null;
  originalFileName: string;
  detectedAspectRatio: string;
  isRestoring: boolean;
  isCropping: boolean;
}

export type ImageAction =
  | { type: 'LOAD_FILE'; rawImage: string; fileName: string }
  | { type: 'CLOSE_CROP' }
  | { type: 'CONFIRM_CROP'; croppedImage: string; aspectRatio: string }
  | { type: 'REOPEN_CROP' }
  | { type: 'SET_RESTORED_IMAGE'; payload: string }
  | { type: 'START_RESTORING' }
  | { type: 'STOP_RESTORING' }
  | { type: 'DISCARD' };

export const initialImageState: ImageState = {
  rawImage: null,
  originalImage: null,
  restoredImage: null,
  originalFileName: 'restored-photo',
  detectedAspectRatio: '1:1',
  isRestoring: false,
  isCropping: false,
};

export function imageReducer(state: ImageState, action: ImageAction): ImageState {
  switch (action.type) {
    case 'LOAD_FILE':
      return {
        ...state,
        rawImage: action.rawImage,
        originalFileName: action.fileName,
        isCropping: true,
        restoredImage: null,
      };
    case 'CLOSE_CROP':
      return { ...state, isCropping: false };
    case 'CONFIRM_CROP':
      return {
        ...state,
        originalImage: action.croppedImage,
        detectedAspectRatio: action.aspectRatio,
        isCropping: false,
      };
    case 'REOPEN_CROP':
      return { ...state, rawImage: state.originalImage, isCropping: true };
    case 'SET_RESTORED_IMAGE':
      return { ...state, restoredImage: action.payload };
    case 'START_RESTORING':
      return { ...state, isRestoring: true };
    case 'STOP_RESTORING':
      return { ...state, isRestoring: false };
    case 'DISCARD':
      return { ...initialImageState };
    default:
      return state;
  }
}

export function useImageState() {
  return useReducer(imageReducer, initialImageState);
}
