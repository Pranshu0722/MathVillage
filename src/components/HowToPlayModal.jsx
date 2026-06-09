import { motion } from 'framer-motion';

export default function HowToPlayModal({ title, emoji, steps, onStart, accent = '#6366f1' }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 340, damping: 26 }}
        className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl"
      >
        <div className="mb-3 text-5xl">{emoji}</div>
        <h2 className="font-display text-2xl font-black text-slate-900">{title}</h2>
        <div className="mt-5 space-y-3 rounded-xl bg-slate-50 p-5 text-left">
          {steps.map((step, i) => (
            <p key={i} className="text-sm font-medium leading-relaxed text-slate-600">
              <span className="font-black text-slate-900">{i + 1}. </span>{step}
            </p>
          ))}
        </div>
        <button
          onClick={onStart}
          className="mt-6 w-full rounded-xl py-3.5 text-sm font-bold text-white shadow-md transition-opacity hover:opacity-90 active:opacity-80"
          style={{ background: accent }}
        >
          Start Game
        </button>
      </motion.div>
    </div>
  );
}
