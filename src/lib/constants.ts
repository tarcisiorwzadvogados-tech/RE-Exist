import { AlertCircle, User, Palette, Sparkles } from 'lucide-react';

export const MAX_FILE_SIZE = 100 * 1024 * 1024;

export const DEFAULT_PROMPT = "Restore this vintage photograph with maximum fidelity to the original scene. Remove dust, scratches, stains and scanning artifacts while preserving the natural film grain and photographic texture. Reconstruct missing or damaged details realistically, especially facial features, eyes, hair and clothing, without altering the identity of the person. Maintain the original lighting, lens characteristics and tonal range of analog photography. Avoid modern digital look, avoid plastic skin smoothing, avoid artificial sharpening. Result should look like a carefully restored high-quality scan of the original photograph, not a newly generated image. Preserve facial identity and expression exactly as in the original image. Reconstruct damaged areas naturally without changing age, facial proportions or historical authenticity. Repair torn areas and missing regions using context-aware reconstruction consistent with the surrounding photographic structure.";

export const RESTORATION_PRESETS = [
  {
    id: 'repair_torn',
    label: 'Reparo de Estrutura',
    description: 'Reconstrução de áreas rasgadas e faltantes',
    icon: AlertCircle,
    prompt: "Repair torn areas and missing regions using context-aware reconstruction consistent with the surrounding photographic structure.",
  },
  {
    id: 'facial_identity',
    label: 'Identidade Facial',
    description: 'Preservar identidade e expressões originais',
    icon: User,
    prompt: "Preserve facial identity and expression exactly as in the original image. Reconstruct damaged areas naturally without changing age, facial proportions or historical authenticity.",
  },
  {
    id: 'colorization',
    label: 'Colorização Histórica',
    description: 'Cores realistas e tons naturais',
    icon: Palette,
    prompt: "Colorize this aged or faded photograph using historically plausible colors while preserving the original lighting, tonal structure and photographic texture. Restore natural color balance where pigments have faded due to aging or chemical deterioration. Reconstruct realistic colors for skin, clothing and environment using contextual understanding of the scene. Maintain subtle and natural color tones consistent with analog photography of the original period. Avoid oversaturation, artificial color grading or modern digital appearance. Preserve film grain, original contrast and the authentic look of a historically restored photograph.",
  },
  {
    id: 'bw_colorization',
    label: 'Colorização P&B',
    description: 'Colorir fotos em preto e branco',
    icon: Palette,
    prompt: "Colorize this black and white vintage photograph using historically accurate and contextually realistic colors. Preserve the original lighting, shadows, tonal range and photographic composition of the image. Apply natural and subtle colors consistent with the historical period represented in the photograph. Maintain authentic film grain and analog photographic texture. Avoid modern color palettes, oversaturation or artificial digital effects. The final result should resemble a carefully colorized historical photograph while remaining faithful to the original image. Use historically plausible colors appropriate for the likely time period of the photograph.",
  },
];

export const ASPECT_RATIOS = [
  { label: 'Original', value: undefined },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
  { label: '1:4', value: 1 / 4 },
  { label: '1:8', value: 1 / 8 },
  { label: '4:1', value: 4 },
  { label: '8:1', value: 8 },
];

export const PRICE_TABLE: Record<string, Record<string, number>> = {
  'gemini-3.1-flash-image-preview': { '1K': 0.01, '2K': 0.02, '4K': 0.00 },
  'gemini-3-pro-image-preview': { '1K': 0.03, '2K': 0.06, '4K': 0.12 },
};

export const MODELS = [
  {
    id: 'gemini-3.1-flash-image-preview',
    name: 'Nano Banana 2',
    description: 'Fast & Cost-effective (Flash 3.1)',
    icon: Sparkles,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    id: 'gemini-3-pro-image-preview',
    name: 'Nano Banana Pro',
    description: 'Maximum Precision (Pro 3)',
    icon: Sparkles,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
];

export const RESOLUTIONS = [
  { id: '1K', name: '1K', description: 'Standard Quality' },
  { id: '2K', name: '2K', description: 'High Definition' },
  { id: '4K', name: '4K', description: 'Ultra HD (Pro only)' },
];
