/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

async function callGeminiViaProxy(
  imageDataUrl: string,
  prompt: string,
  model: string,
  resolution: string,
  aspectRatio: string,
  signal: AbortSignal
): Promise<string> {
  const res = await fetch('/api/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl, prompt, model, resolution, aspectRatio }),
    signal,
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error || 'Proxy error');
  }
  const { imageDataUrl: result } = await res.json();
  return result;
}

async function uploadViaFilesApi(
  ai: GoogleGenAI,
  base64Data: string,
  mimeType: string
): Promise<{ fileUri: string; fileName: string }> {
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  const uploaded = await ai.files.upload({
    file: blob,
    config: { mimeType, displayName: 're-exist-input' },
  });
  return { fileUri: uploaded.uri!, fileName: uploaded.name! };
}

const INLINE_THRESHOLD = 6_000_000;

async function callGeminiDirect(
  imageDataUrl: string,
  prompt: string,
  model: string,
  resolution: string,
  aspectRatio: string,
  signal: AbortSignal
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiKey =
    (process.env as any).API_KEY ||
    process.env.GEMINI_API_KEY ||
    localStorage.getItem('gemini_api_key') ||
    '';
  const ai = new GoogleGenAI({ apiKey });

  const commaIndex = imageDataUrl.indexOf(',');
  if (commaIndex === -1) throw new Error('Formato de imagem inválido.');
  const base64Data = imageDataUrl.slice(commaIndex + 1);
  const mimeType = imageDataUrl.slice(0, commaIndex).split(';')[0].split(':')[1];

  const rawSize = Math.floor(base64Data.length * 0.75);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let imagePart: any;
  let uploadedFileName: string | undefined;

  if (rawSize >= INLINE_THRESHOLD) {
    const { fileUri, fileName } = await uploadViaFilesApi(ai, base64Data, mimeType);
    uploadedFileName = fileName;
    imagePart = { fileData: { fileUri, mimeType } };
  } else {
    imagePart = { inlineData: { data: base64Data, mimeType } };
  }

  const response = await ai.models.generateContent({
    model,
    contents: { parts: [imagePart, { text: prompt }] },
    config: {
      imageConfig: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        imageSize: resolution as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        aspectRatio: aspectRatio as any,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      abortSignal: signal as any,
    },
  });

  if (uploadedFileName) ai.files.delete({ name: uploadedFileName }).catch(() => {});

  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) return `data:image/png;base64,${part.inlineData.data}`;
  }
  throw new Error('The model did not return a restored image.');
}

async function callGemini(
  imageDataUrl: string,
  prompt: string,
  model: string,
  resolution: string,
  aspectRatio: string,
  signal: AbortSignal
): Promise<string> {
  // Use server proxy when GEMINI_API_KEY is configured server-side (key stays out of browser)
  if (!process.env.GEMINI_API_KEY && !localStorage.getItem('gemini_api_key')) {
    return callGeminiViaProxy(imageDataUrl, prompt, model, resolution, aspectRatio, signal);
  }
  // Fallback: direct call with user-provided key
  return callGeminiDirect(imageDataUrl, prompt, model, resolution, aspectRatio, signal);
}

import { useEffect, useRef, useCallback, useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import {
  Upload,
  Sparkles,
  Image as ImageIcon,
  Download,
  RefreshCw,
  AlertCircle,
  Crop as CropIcon,
  Check,
  X,
  ChevronDown,
  FileText,
  RotateCcw,
  Palette,
  Share2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { DownloadFormat } from './types';
import { RESTORATION_PRESETS, MODELS, RESOLUTIONS, PRICE_TABLE } from './lib/constants';
import { downloadImage } from './lib/download';
import { generateReceiptPDF } from './lib/pdf';
import { decodeTiffFile } from './lib/tiff';
import { generateId, compressImageIfNeeded } from './lib/utils';
import { track } from './lib/analytics';
import { shareBeforeAfter } from './lib/share';

import { useImageState } from './hooks/useImageState';
import { useSessionState } from './hooks/useSessionState';
import { useUIState } from './hooks/useUIState';

import { ManifestModal } from './components/ManifestModal';
import { CropModal } from './components/CropModal';
import { Header } from './components/Header';
import { ApiKeyScreen } from './components/ApiKeyScreen';
import { BeforeAfterSlider } from './components/BeforeAfterSlider';
import { PipelinePanel } from './components/PipelinePanel';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  const [img, dispatchImg] = useImageState();
  const [session, dispatchSession] = useSessionState();
  const [ui, dispatchUI] = useUIState();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [sliderMode, setSliderMode] = useState(false);
  const [provaMode, setProvaMode] = useState(false);

  const checkApiKey = useCallback(async () => {
    if (window.aistudio) {
      dispatchUI({ type: 'SET_HAS_API_KEY', payload: await window.aistudio.hasSelectedApiKey() });
    } else if (process.env.GEMINI_API_KEY || localStorage.getItem('gemini_api_key')) {
      dispatchUI({ type: 'SET_HAS_API_KEY', payload: true });
    } else {
      // No client-side key — check if server proxy has one configured
      try {
        const res = await fetch('/api/status');
        if (res.ok) {
          const { proxyAvailable } = await res.json();
          if (proxyAvailable) dispatchUI({ type: 'SET_HAS_API_KEY', payload: true });
        }
      } catch {
        // proxy unreachable — user will need to enter key manually
      }
    }
  }, [dispatchUI]);

  const processFile = useCallback(
    (file: File) => {
      if (!file) return;

      const fileName = file.name.split('.').slice(0, -1).join('.') || file.name;
      track('upload', { sizeBytes: file.size, mimeType: file.type });
      const isTiff =
        file.name.toLowerCase().endsWith('.tif') ||
        file.name.toLowerCase().endsWith('.tiff') ||
        file.type === 'image/tiff';

      if (isTiff) {
        decodeTiffFile(file)
          .then(compressImageIfNeeded)
          .then((dataUrl) => {
            dispatchImg({ type: 'LOAD_FILE', rawImage: dataUrl, fileName });
            dispatchUI({ type: 'SET_ERROR', payload: null });
          })
          .catch(() =>
            dispatchUI({
              type: 'SET_ERROR',
              payload: 'Failed to decode TIFF image. Please try another format.',
            })
          );
      } else {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const dataUrl = await compressImageIfNeeded(reader.result as string);
            dispatchImg({ type: 'LOAD_FILE', rawImage: dataUrl, fileName });
            dispatchUI({ type: 'SET_ERROR', payload: null });
          } catch {
            dispatchUI({ type: 'SET_ERROR', payload: 'Não foi possível processar a imagem.' });
          }
        };
        reader.readAsDataURL(file);
      }
    },
    [dispatchImg, dispatchUI]
  );

  useEffect(() => {
    checkApiKey();

    const handleClickOutside = (event: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
        dispatchUI({ type: 'CLOSE_DOWNLOAD_MENU' });
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [checkApiKey, dispatchUI]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            processFile(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processFile]);

  const restoreImage = async (overridePrompt?: string | unknown) => {
    if (!img.originalImage) return;

    const actualPrompt = typeof overridePrompt === 'string' ? overridePrompt : session.prompt;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    dispatchImg({ type: 'START_RESTORING' });
    dispatchUI({ type: 'SET_ERROR', payload: null });
    track('restore_start', { model: ui.selectedModel, resolution: ui.selectedResolution });

    try {
      const result = await callGemini(
        img.originalImage,
        actualPrompt,
        ui.selectedModel,
        ui.selectedResolution,
        img.detectedAspectRatio,
        controller.signal
      );

      if (controller.signal.aborted) return;

      track('restore_success', { model: ui.selectedModel, resolution: ui.selectedResolution });
      dispatchImg({ type: 'SET_RESTORED_IMAGE', payload: result });
      const cost = PRICE_TABLE[ui.selectedModel]?.[ui.selectedResolution] || 0;
      dispatchSession({
        type: 'ADD_LOG',
        log: {
          id: generateId(),
          timestamp: new Date(),
          model: MODELS.find((m) => m.id === ui.selectedModel)?.name || ui.selectedModel,
          resolution: ui.selectedResolution,
          cost,
          fileName: img.originalFileName,
          prompt: actualPrompt,
        },
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : '';
      track('restore_fail', { model: ui.selectedModel, resolution: ui.selectedResolution });
      const isPermission =
        msg.includes('PERMISSION_DENIED') ||
        msg.includes('The caller does not have permission') ||
        msg.includes('403');
      const isNotFound = msg.includes('Requested entity was not found');
      if ((isPermission || isNotFound) && localStorage.getItem('gemini_api_key')) {
        dispatchUI({
          type: 'SET_ERROR',
          payload:
            "API Key error or insufficient permissions. Please ensure you've selected a key from a paid Google Cloud project with billing enabled.",
        });
        dispatchUI({ type: 'SET_HAS_API_KEY', payload: false });
      } else {
        dispatchUI({ type: 'SET_ERROR', payload: msg || 'An error occurred during restoration.' });
      }
    } finally {
      dispatchImg({ type: 'STOP_RESTORING' });
      abortControllerRef.current = null;
    }
  };

  const cancelRestoration = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    dispatchImg({ type: 'STOP_RESTORING' });
    setPipelineProgress(null);
  };

  const [pipelineProgress, setPipelineProgress] = useState<{
    current: number;
    total: number;
    label: string;
  } | null>(null);

  const runPipeline = async (steps: { prompt: string; label: string }[]) => {
    if (!img.originalImage || steps.length === 0) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    dispatchImg({ type: 'START_RESTORING' });
    dispatchUI({ type: 'SET_ERROR', payload: null });
    track('pipeline_run', { steps: steps.length, model: ui.selectedModel });

    let currentImage = img.originalImage;
    try {
      for (let i = 0; i < steps.length; i++) {
        if (controller.signal.aborted) return;
        setPipelineProgress({ current: i + 1, total: steps.length, label: steps[i].label });

        currentImage = await callGemini(
          currentImage,
          steps[i].prompt,
          ui.selectedModel,
          ui.selectedResolution,
          img.detectedAspectRatio,
          controller.signal
        );

        const cost = PRICE_TABLE[ui.selectedModel]?.[ui.selectedResolution] || 0;
        dispatchSession({
          type: 'ADD_LOG',
          log: {
            id: generateId(),
            timestamp: new Date(),
            model: MODELS.find((m) => m.id === ui.selectedModel)?.name || ui.selectedModel,
            resolution: ui.selectedResolution,
            cost,
            fileName: img.originalFileName,
            prompt: steps[i].prompt,
          },
        });
      }

      if (!controller.signal.aborted) {
        dispatchImg({ type: 'SET_RESTORED_IMAGE', payload: currentImage });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      dispatchUI({
        type: 'SET_ERROR',
        payload: err instanceof Error ? err.message : 'Pipeline error.',
      });
    } finally {
      dispatchImg({ type: 'STOP_RESTORING' });
      setPipelineProgress(null);
      abortControllerRef.current = null;
    }
  };

  if (!ui.hasApiKey) {
    return (
      <ApiKeyScreen
        onSaveKey={(key) => {
          localStorage.setItem('gemini_api_key', key);
          dispatchUI({ type: 'SET_HAS_API_KEY', payload: true });
        }}
      />
    );
  }

  if (provaMode && img.originalImage && img.restoredImage) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 flex-shrink-0">
          <div className="flex gap-2">
            <button
              onClick={() => setSliderMode(false)}
              className={`px-4 py-1.5 rounded-full text-[9px] font-mono uppercase tracking-widest transition-all ${
                !sliderMode
                  ? 'bg-white text-black'
                  : 'text-white/50 border border-white/10 hover:text-white hover:border-white'
              }`}
            >
              Side by Side
            </button>
            <button
              onClick={() => setSliderMode(true)}
              className={`px-4 py-1.5 rounded-full text-[9px] font-mono uppercase tracking-widest transition-all ${
                sliderMode
                  ? 'bg-emerald-digital text-white'
                  : 'text-white/50 border border-white/10 hover:text-white hover:border-white'
              }`}
            >
              Slider
            </button>
          </div>
          <button
            onClick={() => setProvaMode(false)}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 text-white/50 hover:text-white hover:border-white text-[9px] font-mono uppercase tracking-widest transition-all"
          >
            <X className="w-3 h-3" /> Sair da Prova
          </button>
        </div>

        {/* Image area */}
        <div className="flex-1 min-h-0 px-4 pb-4">
          {sliderMode ? (
            <BeforeAfterSlider before={img.originalImage} after={img.restoredImage} />
          ) : (
            <div className="flex gap-4 h-full">
              <div className="relative flex-1 min-w-0 rounded-2xl overflow-hidden bg-white/5">
                <img
                  src={img.originalImage}
                  alt="Original"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
                <span className="absolute top-3 left-3 px-3 py-1 bg-black/50 backdrop-blur-md text-white text-[9px] font-mono uppercase tracking-widest rounded-full border border-white/10">
                  Original
                </span>
              </div>
              <div className="relative flex-1 min-w-0 rounded-2xl overflow-hidden bg-white/5">
                <img
                  src={img.restoredImage}
                  alt="Restored"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
                <span className="absolute top-3 left-3 px-3 py-1 bg-emerald-600/80 text-white text-[9px] font-mono uppercase tracking-widest rounded-full">
                  Restored
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-[100dvh] flex flex-col bg-paper text-ink font-sans selection:bg-emerald-digital selection:text-white grid-bg ${ui.theme === 'darkroom' ? 'darkroom' : ''}`}
    >
      <AnimatePresence>
        {ui.showManifesto && (
          <ManifestModal onClose={() => dispatchUI({ type: 'SET_MANIFESTO', payload: false })} />
        )}
      </AnimatePresence>

      <Header
        theme={ui.theme}
        onThemeToggle={() => dispatchUI({ type: 'TOGGLE_THEME' })}
        onManifestoOpen={() => dispatchUI({ type: 'SET_MANIFESTO', payload: true })}
        onApiSettings={() => dispatchUI({ type: 'SET_HAS_API_KEY', payload: false })}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 lg:h-[calc(100vh-160px)]">
          {/* Controls Column */}
          <div className="lg:col-span-4 space-y-8 lg:h-full lg:overflow-y-auto lg:pr-4 pb-8 scrollbar-hide hover:scrollbar-default">
            <section
              className={`${ui.theme === 'darkroom' ? 'bg-ink/20' : 'bg-white'} p-8 rounded-3xl shadow-sm border border-ink/5`}
            >
              <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-silver mb-6 flex items-center gap-2">
                <Upload className="w-3 h-3" /> Input Source
              </h2>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  dispatchUI({ type: 'SET_DRAGGING', payload: true });
                }}
                onDragLeave={() => dispatchUI({ type: 'SET_DRAGGING', payload: false })}
                onDrop={(e) => {
                  e.preventDefault();
                  dispatchUI({ type: 'SET_DRAGGING', payload: false });
                  const file = e.dataTransfer.files?.[0];
                  if (file && file.type.startsWith('image/')) processFile(file);
                }}
                className={`border border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer group ${
                  ui.isDragging
                    ? 'border-emerald-digital bg-emerald-digital/5'
                    : `${ui.theme === 'darkroom' ? 'border-white/10 hover:border-emerald-digital hover:bg-emerald-digital/5' : 'border-ink/10 hover:border-emerald-digital hover:bg-emerald-digital/5'}`
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) processFile(f);
                  }}
                  accept="image/*, .tif, .tiff"
                  className="hidden"
                />
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-all ${
                    ui.isDragging
                      ? 'bg-emerald-digital text-white scale-110'
                      : `${ui.theme === 'darkroom' ? 'bg-white/5 text-silver group-hover:scale-110 group-hover:bg-white/10' : 'bg-ink/5 text-silver group-hover:scale-110 group-hover:bg-ink/10'}`
                  }`}
                >
                  <ImageIcon className="w-7 h-7" />
                </div>
                <p
                  className={`text-xs font-bold uppercase tracking-widest ${ui.isDragging ? 'text-emerald-digital' : `${ui.theme === 'darkroom' ? 'text-white' : 'text-ink'}`}`}
                >
                  {ui.isDragging ? 'Release' : 'Upload'}
                </p>
                <p className="text-[9px] font-mono uppercase tracking-tighter text-silver mt-2">
                  Drag, Paste or Click
                </p>
              </div>
            </section>

            {img.originalImage && (
              <button
                onClick={() => dispatchImg({ type: 'REOPEN_CROP' })}
                className={`w-full py-4 px-4 ${ui.theme === 'darkroom' ? 'bg-ink/20 hover:bg-ink/40 text-dark-ink' : 'bg-paper hover:bg-ink hover:text-white text-ink'} rounded-2xl text-[10px] font-mono uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-ink/5`}
              >
                <CropIcon className="w-3 h-3" /> Re-Define Crop
              </button>
            )}

            <section
              className={`${ui.theme === 'darkroom' ? 'bg-ink/20' : 'bg-white'} p-8 rounded-3xl shadow-sm border border-ink/5`}
            >
              <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-silver mb-6 flex items-center gap-2">
                <Sparkles className="w-3 h-3" /> Engine Selection
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {MODELS.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => dispatchUI({ type: 'SET_MODEL', payload: model.id })}
                    className={`p-4 rounded-2xl border transition-all flex items-center gap-4 group ${
                      ui.selectedModel === model.id
                        ? 'border-emerald-digital bg-emerald-digital/5'
                        : `${ui.theme === 'darkroom' ? 'border-white/5 bg-white/5 hover:border-white/20' : 'border-ink/5 bg-paper/30 hover:border-ink/20'}`
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                        ui.selectedModel === model.id
                          ? 'bg-emerald-digital text-white'
                          : `${ui.theme === 'darkroom' ? 'bg-white/5 text-silver group-hover:bg-white/10' : 'bg-ink/5 text-silver group-hover:bg-ink/10'}`
                      }`}
                    >
                      <model.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 text-left">
                      <div
                        className={`text-xs font-bold ${ui.selectedModel === model.id ? (ui.theme === 'darkroom' ? 'text-white' : 'text-ink') : 'text-silver'}`}
                      >
                        {model.name}
                      </div>
                      <div className="text-[9px] font-mono uppercase tracking-tighter opacity-50">
                        {model.description}
                      </div>
                    </div>
                    {ui.selectedModel === model.id && (
                      <Check className="w-4 h-4 text-emerald-digital" />
                    )}
                  </button>
                ))}
              </div>
            </section>

            <section
              className={`${ui.theme === 'darkroom' ? 'bg-ink/20' : 'bg-white'} p-8 rounded-3xl shadow-sm border border-ink/5`}
            >
              <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-silver mb-6 flex items-center gap-2">
                <Palette className="w-3 h-3" /> Output Fidelity
              </h2>
              <div className="flex gap-2">
                {RESOLUTIONS.map((res) => (
                  <button
                    key={res.id}
                    onClick={() => dispatchUI({ type: 'SET_RESOLUTION', payload: res.id })}
                    disabled={res.id === '4K' && ui.selectedModel.includes('flash')}
                    className={`flex-1 py-3 px-3 rounded-xl border text-[10px] font-mono uppercase tracking-widest transition-all ${
                      ui.selectedResolution === res.id
                        ? 'border-emerald-digital bg-emerald-digital text-white'
                        : `${ui.theme === 'darkroom' ? 'border-white/5 bg-white/5 text-silver hover:border-white/20' : 'border-ink/5 bg-paper/30 text-silver hover:border-ink/20'}`
                    } ${res.id === '4K' && ui.selectedModel.includes('flash') ? 'opacity-10 cursor-not-allowed' : ''}`}
                  >
                    {res.name}
                  </button>
                ))}
              </div>
            </section>

            <section
              className={`${ui.theme === 'darkroom' ? 'bg-ink/20' : 'bg-white'} p-8 rounded-3xl shadow-sm border border-ink/5`}
            >
              <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-silver mb-6 flex items-center gap-2">
                <FileText className="w-3 h-3" /> Session Metadata
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-silver">Restorations</span>
                  <span
                    className={`text-sm font-bold ${ui.theme === 'darkroom' ? 'text-white' : 'text-ink'}`}
                  >
                    {session.restorationHistory.length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-silver">Session Cost</span>
                  <span className="text-sm font-bold text-emerald-digital">
                    $
                    {session.restorationHistory
                      .reduce((sum, item) => sum + item.cost, 0)
                      .toFixed(2)}
                  </span>
                </div>
                <div className="pt-4 space-y-2">
                  <button
                    onClick={() => generateReceiptPDF(session.restorationHistory)}
                    disabled={session.restorationHistory.length === 0}
                    className={`w-full py-3 px-4 ${ui.theme === 'darkroom' ? 'bg-white text-ink hover:bg-emerald-digital hover:text-white' : 'bg-ink text-white hover:bg-emerald-digital'} rounded-xl text-[10px] font-mono uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-10 disabled:cursor-not-allowed`}
                  >
                    <Download className="w-3 h-3" /> Export Receipt
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Clear session history?')) dispatchSession({ type: 'RESET' });
                    }}
                    disabled={session.restorationHistory.length === 0}
                    className="w-full py-2 px-4 text-silver hover:text-red-500 rounded-xl text-[9px] font-mono uppercase tracking-widest transition-all flex items-center justify-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset Session
                  </button>
                </div>
              </div>
            </section>
          </div>

          {/* Preview Column */}
          <div className="lg:col-span-8 flex flex-col lg:h-full space-y-6 min-h-[400px] lg:min-h-0">
            <div
              className={`flex-1 ${ui.theme === 'darkroom' ? 'bg-white/5 border-white/5' : 'bg-ink/5 border-ink/5'} rounded-[40px] border relative overflow-hidden flex items-center justify-center group min-h-[350px] lg:min-h-0`}
            >
              <div className="absolute inset-0 grid-bg opacity-50" />

              <AnimatePresence mode="wait">
                {!img.originalImage && !img.isRestoring && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center space-y-4 z-10"
                  >
                    <div
                      className={`w-20 h-20 ${ui.theme === 'darkroom' ? 'bg-white/5' : 'bg-ink/5'} rounded-full flex items-center justify-center mx-auto mb-6`}
                    >
                      <ImageIcon className="w-10 h-10 text-silver" />
                    </div>
                    <h3 className="text-2xl font-serif italic text-silver">Aguardando imagem...</h3>
                    <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-silver/50">
                      O laboratório está pronto
                    </p>
                  </motion.div>
                )}

                {img.originalImage && !img.isRestoring && (
                  <motion.div
                    key={img.restoredImage ? 'comparison' : 'original'}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-3 overflow-hidden"
                  >
                    {img.restoredImage && (
                      <div className="flex gap-2 flex-shrink-0 z-10">
                        <button
                          onClick={() => setSliderMode(false)}
                          className={`px-4 py-1.5 rounded-full text-[9px] font-mono uppercase tracking-widest transition-all ${
                            !sliderMode
                              ? 'bg-ink text-white'
                              : ui.theme === 'darkroom'
                                ? 'text-silver hover:text-white border border-white/10'
                                : 'text-silver hover:text-ink border border-ink/10'
                          }`}
                        >
                          Side by Side
                        </button>
                        <button
                          onClick={() => setSliderMode(true)}
                          className={`px-4 py-1.5 rounded-full text-[9px] font-mono uppercase tracking-widest transition-all ${
                            sliderMode
                              ? 'bg-emerald-digital text-white'
                              : ui.theme === 'darkroom'
                                ? 'text-silver hover:text-white border border-white/10'
                                : 'text-silver hover:text-ink border border-ink/10'
                          }`}
                        >
                          Slider
                        </button>
                        <button
                          onClick={() => setProvaMode(true)}
                          className={`px-4 py-1.5 rounded-full text-[9px] font-mono uppercase tracking-widest transition-all border ${
                            ui.theme === 'darkroom'
                              ? 'border-white/10 text-silver hover:text-white hover:border-white'
                              : 'border-ink/10 text-silver hover:text-ink hover:border-ink'
                          }`}
                        >
                          Prova
                        </button>
                      </div>
                    )}

                    {img.restoredImage && sliderMode ? (
                      <div className="w-full flex-1 min-h-0 shadow-2xl rounded-2xl overflow-hidden">
                        <BeforeAfterSlider before={img.originalImage} after={img.restoredImage} />
                      </div>
                    ) : (
                      <div className="flex flex-col md:flex-row w-full flex-1 min-h-0 gap-3 items-stretch justify-center">
                        <div
                          className={`relative ${img.restoredImage ? 'w-full md:w-1/2' : 'w-full'} min-h-0 flex items-center justify-center shadow-2xl rounded-2xl overflow-hidden slam-in bg-black/5`}
                        >
                          <img
                            src={img.originalImage}
                            alt="Original"
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute top-3 left-3 px-3 py-1 bg-ink/50 backdrop-blur-md text-white text-[9px] font-mono uppercase tracking-widest rounded-full border border-white/10 z-10">
                            Original
                          </div>
                        </div>
                        {img.restoredImage && (
                          <div className="relative w-full md:w-1/2 min-h-0 flex items-center justify-center shadow-2xl rounded-2xl overflow-hidden slam-in bg-black/5">
                            <img
                              src={img.restoredImage}
                              alt="Restored"
                              className="w-full h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute top-3 left-3 px-3 py-1 bg-emerald-digital text-white text-[9px] font-mono uppercase tracking-widest rounded-full z-10">
                              Restored
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}

                {img.isRestoring && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 z-20 bg-paper/80 backdrop-blur-sm flex flex-col justify-center items-center"
                  >
                    <div className="text-center space-y-8">
                      <div className="relative">
                        <RefreshCw className="w-16 h-16 text-emerald-digital animate-spin mx-auto" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Sparkles className="w-6 h-6 text-emerald-digital" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-serif italic text-ink">Re-Existindo...</h3>
                        {pipelineProgress ? (
                          <>
                            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-emerald-digital">
                              Passo {pipelineProgress.current}/{pipelineProgress.total}:{' '}
                              {pipelineProgress.label}
                            </p>
                            <div className="w-48 mx-auto h-1 rounded-full bg-ink/10 overflow-hidden">
                              <div
                                className="h-full bg-emerald-digital transition-all duration-500"
                                style={{
                                  width: `${(pipelineProgress.current / pipelineProgress.total) * 100}%`,
                                }}
                              />
                            </div>
                          </>
                        ) : (
                          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-silver animate-pulse">
                            Processando resistência da memória
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Action Bar */}
            <div
              className={`${ui.theme === 'darkroom' ? 'bg-white/5 border-white/5' : 'bg-white border-ink/5'} p-6 rounded-[32px] shadow-sm border flex flex-col items-stretch gap-6`}
            >
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <span className="text-[9px] font-mono uppercase tracking-widest text-silver w-full md:w-auto mb-2 md:mb-0 md:mr-2">
                  Protocolos Especializados:
                </span>
                {img.originalImage &&
                  !img.isRestoring &&
                  RESTORATION_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        dispatchSession({ type: 'SET_PROMPT', payload: preset.prompt });
                        restoreImage(preset.prompt);
                      }}
                      className={`px-4 py-3 ${ui.theme === 'darkroom' ? 'bg-white/5 hover:bg-emerald-digital hover:text-white text-dark-ink' : 'bg-paper hover:bg-emerald-digital hover:text-white text-ink'} rounded-xl text-[9px] font-mono uppercase tracking-widest transition-all flex items-center gap-2 border border-ink/5 group`}
                      title={preset.description}
                    >
                      <preset.icon className="w-3 h-3" />
                      <span>{preset.label}</span>
                    </button>
                  ))}
              </div>

              {img.originalImage && !img.isRestoring && (
                <PipelinePanel theme={ui.theme} disabled={img.isRestoring} onRun={runPipeline} />
              )}

              <div
                className={`flex flex-col md:flex-row items-center justify-between gap-4 border-t ${ui.theme === 'darkroom' ? 'border-white/5' : 'border-ink/5'} pt-6`}
              >
                <div className="flex items-center gap-4 w-full md:w-auto">
                  {img.restoredImage && (
                    <div className="relative w-full md:w-auto" ref={downloadMenuRef}>
                      <button
                        onClick={() => dispatchUI({ type: 'TOGGLE_DOWNLOAD_MENU' })}
                        className={`w-full md:w-auto px-6 py-4 ${ui.theme === 'darkroom' ? 'bg-white text-ink hover:bg-emerald-digital hover:text-white' : 'bg-ink text-white hover:bg-emerald-digital'} rounded-2xl text-[10px] font-mono uppercase tracking-widest transition-all flex items-center justify-center gap-3`}
                      >
                        <Download className="w-4 h-4" /> Exportar{' '}
                        <ChevronDown
                          className={`w-3 h-3 transition-transform ${ui.showDownloadMenu ? 'rotate-180' : ''}`}
                        />
                      </button>

                      <AnimatePresence>
                        {ui.showDownloadMenu && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className={`absolute bottom-full left-0 md:right-0 md:left-auto mb-4 w-56 ${ui.theme === 'darkroom' ? 'bg-dark-paper border-white/10' : 'bg-white border-ink/5'} rounded-2xl shadow-2xl border overflow-hidden p-2 z-30`}
                          >
                            {(['png', 'jpg', 'pdf', 'tiff'] as DownloadFormat[]).map((format) => (
                              <button
                                key={format}
                                onClick={() => {
                                  track(`download_${format}`);
                                  downloadImage({
                                    format,
                                    restoredImage: img.restoredImage!,
                                    originalFileName: img.originalFileName,
                                    restorationHistory: session.restorationHistory,
                                    selectedResolution: ui.selectedResolution,
                                    prompt: session.prompt,
                                    onClose: () => dispatchUI({ type: 'CLOSE_DOWNLOAD_MENU' }),
                                    watermark:
                                      !process.env.GEMINI_API_KEY &&
                                      !localStorage.getItem('gemini_api_key'),
                                  });
                                }}
                                className={`w-full text-left px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-silver ${ui.theme === 'darkroom' ? 'hover:text-white hover:bg-white/5' : 'hover:text-ink hover:bg-paper'} rounded-xl transition-colors flex items-center justify-between group`}
                              >
                                {format}
                                <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  →
                                </span>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {img.restoredImage && (
                    <button
                      onClick={async () => {
                        track('share_click');
                        try {
                          await shareBeforeAfter(
                            img.originalImage!,
                            img.restoredImage!,
                            img.originalFileName
                          );
                        } catch {
                          dispatchUI({
                            type: 'SET_ERROR',
                            payload: 'Não foi possível gerar a imagem de compartilhamento.',
                          });
                        }
                      }}
                      className={`w-full md:w-auto px-6 py-4 border ${ui.theme === 'darkroom' ? 'border-white/10 text-silver hover:text-white hover:border-white' : 'border-ink/10 text-silver hover:text-ink hover:border-ink'} rounded-2xl text-[10px] font-mono uppercase tracking-widest transition-all flex items-center justify-center gap-3`}
                    >
                      <Share2 className="w-4 h-4" /> Compartilhar
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto justify-end">
                  {img.originalImage && (
                    <button
                      onClick={() => dispatchImg({ type: 'DISCARD' })}
                      className="px-4 py-4 text-silver hover:text-red-500 text-[10px] font-mono uppercase tracking-widest transition-colors"
                    >
                      Descartar
                    </button>
                  )}

                  <button
                    onClick={() => restoreImage()}
                    disabled={!img.originalImage || img.isRestoring}
                    className={`flex-1 md:flex-none px-10 py-4 rounded-2xl text-[10px] font-mono uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${
                      !img.originalImage || img.isRestoring
                        ? `${ui.theme === 'darkroom' ? 'bg-white/5 text-silver' : 'bg-ink/5 text-silver'} cursor-not-allowed`
                        : `bg-emerald-digital text-white ${ui.theme === 'darkroom' ? 'hover:bg-white hover:text-ink' : 'hover:bg-ink'} shadow-lg shadow-emerald-digital/20`
                    }`}
                  >
                    {img.isRestoring ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Processando
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" /> RE-Existor
                      </>
                    )}
                  </button>
                  {img.isRestoring && (
                    <button
                      onClick={cancelRestoration}
                      className={`px-5 py-4 rounded-2xl text-[10px] font-mono uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 border ${
                        ui.theme === 'darkroom'
                          ? 'border-white/10 text-silver hover:text-white hover:border-white'
                          : 'border-ink/10 text-silver hover:text-ink hover:border-ink'
                      }`}
                    >
                      <X className="w-4 h-4" /> Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: 'Fidelity',
              text: 'Imagens de alta resolução resultam em restaurações mais precisas. O laboratório recomenda 300 DPI para resultados ótimos.',
            },
            {
              title: 'Identity',
              text: 'O protocolo de restauração é instruído a preservar a identidade facial original, honrando a essência de quem resistiu ao tempo.',
            },
            {
              title: 'Texture',
              text: 'A textura original do papel e o grão da película são preservados para manter a autenticidade analógica da memória.',
            },
          ].map(({ title, text }) => (
            <div
              key={title}
              className={`p-6 ${ui.theme === 'darkroom' ? 'bg-white/5 border-white/5' : 'bg-white border-ink/5'} rounded-2xl border shadow-sm`}
            >
              <h3 className="text-[10px] font-mono uppercase tracking-widest text-silver mb-3 flex items-center gap-2">
                <div className="w-1 h-1 bg-emerald-digital rounded-full" /> {title}
              </h3>
              <p className="text-[11px] text-silver leading-relaxed font-serif italic">{text}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Error Toast */}
      <AnimatePresence>
        {ui.error && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 right-8 z-50 max-w-md"
          >
            <div className="bg-red-50 border border-red-100 p-4 rounded-2xl shadow-2xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-bold text-red-900 uppercase tracking-widest mb-1">
                  Protocol Error
                </p>
                <p className="text-[10px] text-red-700 leading-relaxed">{ui.error}</p>
              </div>
              <button
                onClick={() => dispatchUI({ type: 'SET_ERROR', payload: null })}
                className="text-red-400 hover:text-red-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Crop Modal */}
      <AnimatePresence>
        {img.isCropping && img.rawImage && (
          <CropModal
            rawImage={img.rawImage}
            theme={ui.theme}
            onConfirm={(croppedImage, aspectRatio) =>
              dispatchImg({ type: 'CONFIRM_CROP', croppedImage, aspectRatio })
            }
            onError={(msg) => dispatchUI({ type: 'SET_ERROR', payload: msg })}
            onClose={() => dispatchImg({ type: 'CLOSE_CROP' })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
