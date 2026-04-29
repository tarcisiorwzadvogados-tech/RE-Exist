import { useState } from 'react';
import { Plus, X, Play, GripVertical } from 'lucide-react';
import { RESTORATION_PRESETS } from '../lib/constants';
import { Theme } from '../types';

interface Step {
  id: string;
  label: string;
  prompt: string;
}

interface Props {
  theme: Theme;
  disabled: boolean;
  onRun: (steps: Step[]) => void;
}

export function PipelinePanel({ theme, disabled, onRun }: Props) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [open, setOpen] = useState(false);

  const addStep = (preset: (typeof RESTORATION_PRESETS)[number]) => {
    setSteps((s) => [...s, { id: `${preset.id}-${Date.now()}`, label: preset.label, prompt: preset.prompt }]);
  };

  const removeStep = (id: string) => setSteps((s) => s.filter((step) => step.id !== id));

  const isDark = theme === 'darkroom';
  const border = isDark ? 'border-white/10' : 'border-ink/10';
  const text = isDark ? 'text-silver' : 'text-silver';
  const hoverText = isDark ? 'hover:text-white' : 'hover:text-ink';

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`px-4 py-2 rounded-full border ${border} ${text} ${hoverText} text-[9px] font-mono uppercase tracking-widest transition-all flex items-center gap-1.5`}
      >
        <Play className="w-3 h-3" /> Pipeline
      </button>
    );
  }

  return (
    <div className={`rounded-2xl border ${border} p-4 space-y-4 ${isDark ? 'bg-dark-paper' : 'bg-white'}`}>
      <div className="flex items-center justify-between">
        <span className={`text-[9px] font-mono uppercase tracking-widest ${text}`}>
          Restoration Pipeline
        </span>
        <button onClick={() => setOpen(false)} className={`${text} ${hoverText} transition-colors`}>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Step sequence */}
      {steps.length > 0 && (
        <ol className="space-y-1.5">
          {steps.map((step, i) => (
            <li
              key={step.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${border} text-[10px] font-mono`}
            >
              <GripVertical className="w-3 h-3 text-silver/40 flex-shrink-0" />
              <span className={`w-4 text-center ${isDark ? 'text-white/40' : 'text-ink/30'}`}>{i + 1}</span>
              <span className={`flex-1 ${isDark ? 'text-white' : 'text-ink'}`}>{step.label}</span>
              <button
                onClick={() => removeStep(step.id)}
                className={`${text} ${hoverText} transition-colors flex-shrink-0`}
              >
                <X className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ol>
      )}

      {/* Preset picker */}
      <div className="grid grid-cols-2 gap-1.5">
        {RESTORATION_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => addStep(preset)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border ${border} ${text} ${hoverText} text-[9px] font-mono uppercase tracking-widest transition-all text-left`}
          >
            <Plus className="w-3 h-3 flex-shrink-0" />
            {preset.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => { onRun(steps); setOpen(false); }}
        disabled={steps.length === 0 || disabled}
        className="w-full py-2.5 rounded-xl bg-emerald-digital text-white text-[9px] font-mono uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed transition-colors hover:bg-emerald-700 flex items-center justify-center gap-2"
      >
        <Play className="w-3 h-3" />
        Run {steps.length} Step{steps.length !== 1 ? 's' : ''}
      </button>
    </div>
  );
}
