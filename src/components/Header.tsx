import { Moon, Sun } from 'lucide-react';
import { Theme } from '../types';

interface Props {
  theme: Theme;
  onThemeToggle: () => void;
  onManifestoOpen: () => void;
  onApiSettings: () => void;
}

export function Header({ theme, onThemeToggle, onManifestoOpen, onApiSettings }: Props) {
  return (
    <header
      className={`border-b ${theme === 'darkroom' ? 'border-white/5 bg-dark-paper/80' : 'border-ink/5 bg-paper/80'} backdrop-blur-md z-10 flex-shrink-0`}
    >
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-baseline">
            <span
              className={`text-3xl font-bold tracking-tighter font-sans ${theme === 'darkroom' ? 'text-white' : 'text-ink'}`}
            >
              RE-
            </span>
            <span
              className={`text-3xl font-serif italic font-light ${theme === 'darkroom' ? 'text-white' : 'text-ink'}`}
            >
              Exist
            </span>
          </div>
          <div
            className={`h-4 w-[1px] ${theme === 'darkroom' ? 'bg-white/10' : 'bg-ink/10'} hidden md:block`}
          />
          <span className="text-[10px] font-mono uppercase tracking-widest text-silver hidden md:block">
            Technical Restoration Lab
          </span>
        </div>
        <div className="flex items-center gap-6">
          <button
            onClick={onThemeToggle}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border ${theme === 'darkroom' ? 'border-white/10 text-silver hover:text-white hover:border-white' : 'border-ink/10 text-silver hover:text-ink hover:border-ink'} text-[10px] font-mono uppercase tracking-widest transition-all`}
          >
            {theme === 'lightroom' ? (
              <>
                <Moon className="w-3 h-3" /> Darkroom
              </>
            ) : (
              <>
                <Sun className="w-3 h-3" /> Lightroom
              </>
            )}
          </button>
          <button
            onClick={onManifestoOpen}
            className={`text-[10px] font-mono uppercase tracking-widest text-silver ${theme === 'darkroom' ? 'hover:text-white' : 'hover:text-ink'} transition-colors`}
          >
            Manifesto
          </button>
          <button
            onClick={onApiSettings}
            className={`px-4 py-2 border ${theme === 'darkroom' ? 'border-white/10 text-silver hover:text-white hover:border-white' : 'border-ink/10 text-silver hover:text-ink hover:border-ink'} rounded-full text-[10px] font-mono uppercase tracking-widest transition-all`}
          >
            API Settings
          </button>
        </div>
      </div>
    </header>
  );
}
