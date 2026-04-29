import { useReducer, useEffect } from 'react';
import { RestorationLog } from '../types';
import { DEFAULT_PROMPT } from '../lib/constants';

export interface SessionState {
  restorationHistory: RestorationLog[];
  currentCost: number | null;
  prompt: string;
}

export type SessionAction =
  | { type: 'ADD_LOG'; log: RestorationLog }
  | { type: 'RESET' }
  | { type: 'SET_PROMPT'; payload: string }
  | { type: 'LOAD_HISTORY'; history: RestorationLog[] };

export const initialSessionState: SessionState = {
  restorationHistory: [],
  currentCost: null,
  prompt: DEFAULT_PROMPT,
};

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'ADD_LOG':
      return {
        ...state,
        restorationHistory: [action.log, ...state.restorationHistory],
        currentCost: action.log.cost,
      };
    case 'RESET':
      return { ...state, restorationHistory: [], currentCost: null };
    case 'SET_PROMPT':
      return { ...state, prompt: action.payload };
    case 'LOAD_HISTORY':
      return { ...state, restorationHistory: action.history };
    default:
      return state;
  }
}

export function useSessionState() {
  const [state, dispatch] = useReducer(sessionReducer, initialSessionState);

  useEffect(() => {
    const saved = localStorage.getItem('restoration_history');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      dispatch({
        type: 'LOAD_HISTORY',
        history: parsed.map((item: any) => ({ ...item, timestamp: new Date(item.timestamp) })),
      });
    } catch { /* corrupt history — start fresh */ }
  }, []);

  useEffect(() => {
    localStorage.setItem('restoration_history', JSON.stringify(state.restorationHistory));
  }, [state.restorationHistory]);

  return [state, dispatch] as const;
}
