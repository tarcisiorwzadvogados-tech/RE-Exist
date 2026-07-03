import { Key, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';

interface Props {
  onSaveKey: (key: string) => void;
}

export function ApiKeyScreen({ onSaveKey }: Props) {
  const [key, setKey] = useState('');
  const [showGuide, setShowGuide] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = key.trim();
    if (trimmed) onSaveKey(trimmed);
  };

  return (
    <div className="min-h-[100dvh] bg-stone-100 flex items-center justify-center p-4 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-stone-200"
      >
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Key className="text-emerald-600 w-8 h-8" />
        </div>
        <h1 className="text-2xl font-semibold text-stone-900 mb-2 text-center">
          Chave de API necessária
        </h1>
        <p className="text-stone-600 mb-6 text-center text-sm">
          Insere a tua chave de API do Google Gemini. É guardada apenas no teu browser e nunca é
          enviada para lado nenhum.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="AIza..."
            className="w-full px-4 py-3 border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            autoFocus
          />
          <button
            type="submit"
            disabled={!key.trim()}
            className="w-full py-3 px-6 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <Key className="w-4 h-4" />
            Guardar & Continuar
          </button>
        </form>

        <div className="mt-5 border-t border-stone-100 pt-4">
          <button
            type="button"
            onClick={() => setShowGuide((v) => !v)}
            className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-emerald-600 transition-colors w-full text-left"
          >
            {showGuide ? (
              <ChevronDown className="w-4 h-4 shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 shrink-0" />
            )}
            Como obter a minha chave?
          </button>

          <AnimatePresence>
            {showGuide && (
              <motion.ol
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mt-3 space-y-2.5 text-sm text-stone-600"
              >
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Acede ao{' '}
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-600 underline inline-flex items-center gap-0.5 font-medium"
                    >
                      Google AI Studio <ExternalLink className="w-3 h-3" />
                    </a>
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>Faz login com a tua conta Google</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Clica em <strong className="text-stone-700">"Create API key"</strong>
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                    4
                  </span>
                  <span>Copia a chave gerada e cola no campo acima</span>
                </li>
              </motion.ol>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
