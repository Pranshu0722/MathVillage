import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';

export default function GameStartScreen({ title, emoji, category, description, stats, gradient, onStart, children }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f8fafc] px-3 py-4 sm:px-5 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5">
          <Link
            to="/student"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 shadow-sm text-sm font-bold text-slate-800 hover:bg-slate-50"
          >
            <ArrowLeft size={17} /> Back
          </Link>
        </div>

        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-4 lg:gap-6 items-stretch">
          {/* Left: info panel */}
          <div className="bg-white rounded-[28px] border border-slate-100 shadow-[0_12px_36px_rgba(15,23,42,0.06)] p-5 sm:p-7 overflow-hidden relative">
            <div className="absolute inset-x-0 top-0 h-1 rounded-t-[28px]" style={{ background: gradient }} />
            <div className="mt-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 text-slate-500 text-[11px] font-black uppercase tracking-wider border border-slate-100">
              <Sparkles size={12} /> {category}
            </div>
            <h1 className="mt-4 text-3xl sm:text-4xl font-black text-slate-900 leading-tight">
              {emoji} {title}
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-500 font-medium leading-7 max-w-xl">
              {description}
            </p>
            <div className="grid grid-cols-3 gap-3 mt-6">
              {stats.map((s) => (
                <div key={s.label} className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{s.label}</div>
                  <div className="mt-2 text-xl font-black text-slate-900">{s.value}</div>
                </div>
              ))}
            </div>
            <button
              onClick={onStart}
              className="mt-7 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-white font-black shadow-lg hover:opacity-90 active:scale-[0.98] transition-all"
              style={{ background: gradient }}
            >
              Start Game →
            </button>
          </div>

          {/* Right: preview panel */}
          <div className="bg-white rounded-[28px] border border-slate-100 shadow-[0_12px_36px_rgba(15,23,42,0.06)] p-5 sm:p-7 flex items-center justify-center min-h-[300px]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
