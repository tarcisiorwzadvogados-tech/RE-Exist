export type DownloadFormat = 'png' | 'jpg' | 'pdf' | 'tiff';
export type Theme = 'lightroom' | 'darkroom';

export interface RestorationLog {
  id: string;
  timestamp: Date;
  model: string;
  resolution: string;
  cost: number;
  fileName: string;
  prompt: string;
}
