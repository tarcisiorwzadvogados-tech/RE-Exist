import { useRef, useState, useCallback, useEffect } from 'react';

interface Props {
  before: string;
  after: string;
}

export function BeforeAfterSlider({ before, after }: Props) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updatePosition = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setPosition((x / rect.width) * 100);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging.current) updatePosition(e.clientX);
    };
    const onTouch = (e: TouchEvent) => {
      if (dragging.current) updatePosition(e.touches[0].clientX);
    };
    const onUp = () => {
      dragging.current = false;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouch);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('touchend', onUp);
    };
  }, [updatePosition]);

  const startDrag = (clientX: number) => {
    dragging.current = true;
    updatePosition(clientX);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden rounded-xl cursor-col-resize select-none"
      onMouseDown={(e) => startDrag(e.clientX)}
      onTouchStart={(e) => startDrag(e.touches[0].clientX)}
    >
      {/* After (restored) — full width */}
      <img src={after} alt="Restored" className="absolute inset-0 w-full h-full object-contain" />

      {/* Before (original) — clipped via clipPath, same layout as after */}
      <img
        src={before}
        alt="Original"
        className="absolute inset-0 w-full h-full object-contain"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      />

      {/* Divider */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.6)] z-10 pointer-events-none"
        style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
          <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
            <path
              d="M1 5h12M4 2L1 5l3 3M10 2l3 3-3 3"
              stroke="#555"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Labels */}
      <span className="absolute top-3 left-3 text-[9px] font-mono uppercase tracking-widest bg-black/50 text-white px-2 py-1 rounded-full pointer-events-none z-10">
        Before
      </span>
      <span className="absolute top-3 right-3 text-[9px] font-mono uppercase tracking-widest bg-emerald-600/80 text-white px-2 py-1 rounded-full pointer-events-none z-10">
        After
      </span>
    </div>
  );
}
