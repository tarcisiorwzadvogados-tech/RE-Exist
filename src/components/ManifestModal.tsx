import { motion } from 'motion/react';

interface Props {
  onClose: () => void;
}

export function ManifestModal({ onClose }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-ink flex items-start md:items-center justify-center p-6 overflow-y-auto"
    >
      <div className="max-w-2xl w-full text-center space-y-12 py-12 md:py-0">
        <div className="space-y-2">
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-6xl md:text-8xl font-bold tracking-tighter text-white"
          >
            <span className="font-sans">RE-</span>
            <span className="font-serif italic font-light">Exist</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ delay: 0.4 }}
            className="text-xs font-mono uppercase tracking-[0.3em] text-white"
          >
            Honoring the Resistance of Memory
          </motion.p>
        </div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="space-y-6 text-white/80 font-serif text-xl md:text-2xl leading-relaxed italic"
        >
          <p>
            "O tempo é um erosivo implacável. Ele desbota cores, rasga bordas e silencia olhares.
            Mas algumas imagens se recusam a partir. Elas não apenas sobreviveram; elas{' '}
            <span className="text-white font-bold not-italic">resistiram</span>."
          </p>
          <p>
            "Através da inteligência, devolvemos a dignidade ao que o tempo tentou apagar. Não é
            apenas uma restauração. É um ato de presença. O que resistiu, agora{' '}
            <span className="text-white font-bold not-italic">RE-Existe</span>."
          </p>
        </motion.div>

        <motion.button
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1 }}
          onClick={onClose}
          className="px-12 py-4 bg-white text-ink font-bold rounded-full hover:bg-emerald-digital hover:text-white transition-all duration-500"
        >
          Entrar no Laboratório
        </motion.button>
      </div>
    </motion.div>
  );
}
