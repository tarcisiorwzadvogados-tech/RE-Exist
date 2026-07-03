import { useState, useCallback } from 'react';
import Cropper, { Area, Point } from 'react-easy-crop';
import { X, RotateCcw, RotateCw } from 'lucide-react';
import { motion } from 'motion/react';
import { Theme } from '../types';
import { ASPECT_RATIOS } from '../lib/constants';
import { rotateSize, createImage, getClosestAspectRatio } from '../lib/utils';

interface Props {
  rawImage: string;
  onConfirm: (croppedImage: string, aspectRatio: string) => void;
  onError: (msg: string) => void;
  onClose: () => void;
  theme: Theme;
}

export function CropModal({ rawImage, onConfirm, onError, onClose, theme }: Props) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: Area,
    rot: number
  ): Promise<string | null> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const rotRad = (rot * Math.PI) / 180;
    const { width: bBoxWidth, height: bBoxHeight } = rotateSize(image.width, image.height, rot);
    canvas.width = bBoxWidth;
    canvas.height = bBoxHeight;
    ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
    ctx.rotate(rotRad);
    ctx.translate(-image.width / 2, -image.height / 2);
    ctx.drawImage(image, 0, 0);

    const data = ctx.getImageData(pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height);
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    ctx.putImageData(data, 0, 0);
    return canvas.toDataURL('image/jpeg');
  };

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    try {
      const cropped = await getCroppedImg(rawImage, croppedAreaPixels, rotation);
      if (cropped) {
        const img = await createImage(cropped);
        onConfirm(cropped, getClosestAspectRatio(img.width, img.height));
      }
    } catch {
      onError('Failed to crop image.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-ink/95 backdrop-blur-xl flex items-center justify-center p-0 md:p-6"
    >
      <div className="w-full max-w-5xl h-[100dvh] md:h-[85vh] bg-paper rounded-none md:rounded-[40px] overflow-hidden flex flex-col shadow-2xl border border-white/10">
        <div className="p-6 md:p-8 border-b border-ink/5 flex items-center justify-between">
          <div>
            <h2 className="text-xl md:text-2xl font-serif italic text-ink">Define o Foco</h2>
            <p className="text-[9px] md:text-[10px] font-mono uppercase tracking-widest text-silver mt-1">
              Ajuste o enquadramento da memória
            </p>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex bg-ink/5 p-1 rounded-xl">
              <button
                onClick={() => setRotation((r) => r - 90)}
                className="p-2 hover:bg-white rounded-lg transition-all text-silver hover:text-ink"
              >
                <RotateCcw className="w-3 md:w-4 h-3 md:h-4" />
              </button>
              <button
                onClick={() => setRotation((r) => r + 90)}
                className="p-2 hover:bg-white rounded-lg transition-all text-silver hover:text-ink"
              >
                <RotateCw className="w-3 md:w-4 h-3 md:h-4" />
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-silver hover:text-red-500 transition-colors"
            >
              <X className="w-5 md:w-6 h-5 md:h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 relative bg-ink/10 min-h-[300px]">
          <Cropper
            image={rawImage}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            onCropChange={setCrop}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
          />
        </div>

        <div className="p-6 md:p-8 bg-white border-t border-ink/5 space-y-6 md:space-y-8 overflow-y-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <label className="text-[10px] font-mono uppercase tracking-widest text-silver">
                Aspect Ratio
              </label>
              <div className="flex flex-wrap gap-2">
                {ASPECT_RATIOS.map((ratio) => (
                  <button
                    key={ratio.label}
                    onClick={() => setAspect(ratio.value)}
                    className={`px-3 py-1.5 md:px-4 md:py-2 rounded-full text-[9px] md:text-[10px] font-mono uppercase tracking-widest transition-all ${
                      aspect === ratio.value
                        ? 'bg-ink text-white'
                        : 'bg-paper text-silver hover:bg-ink/5'
                    }`}
                  >
                    {ratio.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 w-full md:min-w-[200px] md:w-auto">
              <div className="flex justify-between">
                <label className="text-[10px] font-mono uppercase tracking-widest text-silver">
                  Zoom
                </label>
                <span className="text-[10px] font-mono text-ink">{Math.round(zoom * 100)}%</span>
              </div>
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-1 bg-ink/5 rounded-lg appearance-none cursor-pointer accent-ink"
              />
            </div>
          </div>

          <div className="flex justify-end gap-4 pb-4 md:pb-0">
            <button
              onClick={onClose}
              className="px-6 py-3 md:px-8 md:py-4 text-silver hover:text-ink text-[10px] font-mono uppercase tracking-widest transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-8 py-3 md:px-12 md:py-4 bg-emerald-digital text-white rounded-2xl text-[10px] font-mono uppercase tracking-widest hover:bg-ink transition-all shadow-lg shadow-emerald-digital/20"
            >
              Confirm Focus
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
