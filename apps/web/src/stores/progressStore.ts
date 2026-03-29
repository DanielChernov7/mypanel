import { create } from 'zustand';

export interface ProgressState {
  isActive: boolean;
  current: number;
  total: number;
  label: string;
  status: 'running' | 'success' | 'error';
  errorCount?: number;
  startProgress: (label: string, total: number) => void;
  updateProgress: (current: number) => void;
  completeProgress: (errorCount?: number) => void;
  resetProgress: () => void;
}

export const useProgressStore = create<ProgressState>((set) => ({
  isActive: false,
  current: 0,
  total: 0,
  label: '',
  status: 'running',
  errorCount: 0,

  startProgress: (label: string, total: number) =>
    set({
      isActive: true,
      current: 0,
      total,
      label,
      status: 'running',
      errorCount: 0,
    }),

  updateProgress: (current: number) =>
    set({
      current,
    }),

  completeProgress: (errorCount = 0) =>
    set({
      status: errorCount > 0 ? 'error' : 'success',
      errorCount,
    }),

  resetProgress: () =>
    set({
      isActive: false,
      current: 0,
      total: 0,
      label: '',
      status: 'running',
      errorCount: 0,
    }),
}));
