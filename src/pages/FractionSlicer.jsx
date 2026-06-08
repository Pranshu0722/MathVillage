import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, RotateCcw, Scissors, Sparkles } from 'lucide-react';
import { useGamification } from '../hooks/useGamification';
import { useAuthStore } from '../store/useAuthStore';
import { normalizeGrade } from '../lib/gradeUtils';
import { safeRecordAttempt as recordAttempt } from '../lib/safeRecordAttempt';
import { skillForGame } from '../engine/gameSkills';

const SKILL = skillForGame('FractionSlicer');

function getDenomPool(grade) {
  if (grade <= 3) return [2, 2, 3, 3, 4];
  if (grade === 4) return [3, 4, 4, 6, 8];
  return [4, 6, 8, 10, 12];
}

function generatePuzzle(grade) {
  const pool = getDenomPool(grade);
  const denom = pool[Math.floor(Math.random() * pool.length)];
  const numer = Math.floor(Math.random() * (denom - 1)) + 1;
  return { numer, denom };
}

function PizzaBoard({ denom, shaded, onToggle, locked }) {
  const cx = 100, cy = 100, r = 86, crustR = 95;
  return (
    <svg viewBox="0 0 200 200" className="w-full max-w-[280px] mx-auto select-none drop-shadow-md">
      <circle cx={cx} cy={cy} r={crustR} fill="#d97706" />
      {Array.from({ length: denom }, (_, i) => {
        const a1 = (i * 360 / denom - 90) * Math.PI / 180;
        const a2 = ((i + 1) * 360 / denom - 90) * Math.PI / 180;
        const x1 = (cx + r * Math.cos(a1)).toFixed(2);
        const y1 = (cy + r * Math.sin(a1)).toFixed(2);
        const x2 = (cx + r * Math.cos(a2)).toFixed(2);
        const y2 = (cy + r * Math.sin(a2)).toFixed(2);
        const large = (360 / denom) > 180 ? 1 : 0;
        const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
        const isShaded = shaded.has(i);
        return (
          <path
            key={i}
            d={d}
            stroke="#b45309"
            strokeWidth="2"
            strokeLinejoin="round"
            style={{ fill: isShaded ? '#f97316' : '#fef9c3', cursor: locked ? 'default' : 'pointer', transition: 'fill 0.18s' }}
            onMouseEnter={e => { if (!locked && !isShaded) e.currentTarget.style.fill = '#fde68a'; }}
            onMouseLeave={e => { if (!locked && !isShaded) e.currentTarget.style.fill = '#fef9c3'; }}
            onClick={() => !locked && onToggle(i)}
          />
        );
      })}
      <circle cx={cx} cy={cy} r={crustR} fill="none" stroke="#92400e" strokeWidth="3" />
    </svg>
  );
}

export default function FractionSlicer() {
  const { addXP } = useGamification();
  const { user } = useAuthStore();
  const grade = normalizeGrade(user?.grade);
  const navigate = useNavigate();
  const totalRounds = grade <= 3 ? 6 : grade <= 4 ? 8 : 10;

  const [puzzle, setPuzzle] = useState(() => generatePuzzle(grade));
  const [shaded, setShaded] = useState(new Set());
  const [roundIndex, setRoundIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [timer, setTimer] = useState(20);
  const [status, setStatus] = useState('ready');
  const [feedback, setFeedback] = useState('');
  const [feedbackAnim, setFeedbackAnim] = useState(null); // 'correct' | 'wrong' | null
  const processingRef = useRef(false);

  useEffect(() => {
    if (status !== 'playing') return;
    const tick = setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          if (!processingRef.current) {
            processingRef.current = true;
            recordAttempt({ skillId: SKILL, correct: false, responseTime: 20000 });
            setStreak(0);
            setFeedbackAnim('wrong');
            setMistakes(m => {
              const next = m + 1;
              if (next >= 3) { setStatus('ended'); processingRef.current = false; return next; }
              setFeedback("Time's up! Next fraction.");
              setTimeout(() => {
                setFeedbackAnim(null);
                setRoundIndex(r => {
                  const nextR = r + 1;
                  if (nextR >= totalRounds) { setStatus('ended'); processingRef.current = false; return r; }
                  setPuzzle(generatePuzzle(grade));
                  setShaded(new Set());
                  setFeedback('Shade the correct fraction, then press Check.');
                  processingRef.current = false;
                  return nextR;
                });
              }, 700);
              return next;
            });
          }
          return 20;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [grade, roundIndex, status, totalRounds]);

  useEffect(() => {
    if (status !== 'ended') return;
    const acc = Math.max(0, Math.round((score / Math.max(1, score + mistakes)) * 100));
    addXP(Math.max(60, score * 35 + bestStreak * 15 + acc), 'Fraction Slicer', score, acc, 'Fractions');
  }, [addXP, bestStreak, mistakes, score, status]);

  function toggleSlice(idx) {
    if (status !== 'playing' || processingRef.current) return;
    setShaded(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  function checkAnswer() {
    if (status !== 'playing' || processingRef.current) return;
    processingRef.current = true;
    const { numer, denom } = puzzle;
    const correct = shaded.size === numer;
    recordAttempt({ skillId: SKILL, correct, responseTime: (20 - timer) * 1000 });
    if (correct) {
      const nextStreak = streak + 1;
      setScore(s => s + 1);
      setStreak(nextStreak);
      setBestStreak(b => Math.max(b, nextStreak));
      setFeedback(`${numer}/${denom} shaded — correct!`);
      setFeedbackAnim('correct');
      setTimeout(() => {
        setFeedbackAnim(null);
        setRoundIndex(r => {
          const nextR = r + 1;
          if (nextR >= totalRounds) { setStatus('ended'); processingRef.current = false; return r; }
          setPuzzle(generatePuzzle(grade));
          setShaded(new Set());
          setTimer(20);
          setFeedback('Shade the correct fraction, then press Check.');
          processingRef.current = false;
          return nextR;
        });
      }, 950);
    } else {
      setFeedbackAnim('wrong');
      setStreak(0);
      setMistakes(m => {
        const next = m + 1;
        if (next >= 3) { setStatus('ended'); processingRef.current = false; return next; }
        setFeedback(`Not quite — shade exactly ${numer} of ${denom} slices.`);
        setTimeout(() => {
          setFeedbackAnim(null);
          setShaded(new Set());
          setFeedback('Slices cleared. Try again!');
          processingRef.current = false;
        }, 900);
        return next;
      });
    }
  }

  function restart() {
    processingRef.current = false;
    setPuzzle(generatePuzzle(grade));
    setShaded(new Set());
    setRoundIndex(0);
    setScore(0);
    setMistakes(0);
    setStreak(0);
    setBestStreak(0);
    setTimer(20);
    setStatus('ready');
    setFeedback('');
    setFeedbackAnim(null);
  }

  const { numer, denom } = puzzle;
  const acc = Math.max(0, Math.round((score / Math.max(1, score + mistakes)) * 100));
  const timerPct = (timer / 20) * 100;
  const timerColor = timer > 10 ? 'bg-violet-500' : timer > 5 ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f5f0ff] px-3 py-4 text-slate-900 sm:px-5">
      <div className="mx-auto max-w-lg">
        <header className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Link to="/student" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:text-slate-950">
              <ArrowLeft size={19} />
            </Link>
            <div className="flex items-center gap-2">
              <Scissors size={20} className="text-violet-600" />
              <h1 className="font-display text-xl font-black text-slate-950 sm:text-2xl">Fraction Slicer</h1>
            </div>
          </div>
          <div className="flex gap-2">
            {[
              { label: 'Score', val: score, color: '' },
              { label: 'Round', val: `${Math.min(roundIndex+1,totalRounds)}/${totalRounds}`, color: '' },
              { label: 'Mistakes', val: `${mistakes}/3`, color: 'text-rose-700' },
            ].map(s => (
              <div key={s.label} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 shadow-sm text-center sm:px-3 sm:py-2">
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400 sm:text-[10px]">{s.label}</p>
                <p className={`text-sm font-black tabular-nums sm:text-base ${s.color}`}>{s.val}</p>
              </div>
            ))}
          </div>
        </header>

        {status === 'ended' ? (
          <div className="grid min-h-[480px] place-items-center rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <div className="max-w-sm">
              <div className="mb-4 text-6xl">{mistakes >= 3 ? '😵' : '🎉'}</div>
              <h2 className="font-display text-4xl font-black text-slate-950">{mistakes >= 3 ? 'Oops!' : 'Well Sliced!'}</h2>
              <p className="mt-2 text-sm font-semibold text-slate-600">{score} correct · {acc}% accuracy · {bestStreak} best streak</p>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {[['Score', score], ['Streak', bestStreak], ['Accuracy', `${acc}%`]].map(([l, v]) => (
                  <div key={l} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-[10px] font-bold uppercase text-slate-400">{l}</p>
                    <p className="text-xl font-black">{v}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <button onClick={restart} className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-3 text-sm font-bold text-white hover:bg-violet-700">
                  <RotateCcw size={16} /> Play Again
                </button>
                <button onClick={() => navigate('/student')} className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  Dashboard
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Target + timer bar */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Shade this fraction</p>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center leading-none">
                      <span className="text-4xl font-black text-violet-700">{numer}</span>
                      <div className="my-1 h-[3px] w-10 rounded bg-violet-700" />
                      <span className="text-4xl font-black text-violet-700">{denom}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-600">
                      Click <strong className="text-slate-900">{numer}</strong> of <strong className="text-slate-900">{denom}</strong> pizza slices
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Shaded</p>
                  <p className={`text-3xl font-black transition-colors ${shaded.size === numer ? 'text-emerald-600' : 'text-slate-800'}`}>
                    {shaded.size}<span className="text-lg text-slate-400">/{denom}</span>
                  </p>
                </div>
              </div>
              <div className="rounded-full bg-slate-100 h-2.5 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-1000 ${timerColor}`} style={{ width: `${timerPct}%` }} />
              </div>
              <p className="mt-1 text-xs font-bold text-right text-slate-400">{timer}s remaining</p>
            </div>

            {/* Pizza + result overlay */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400 text-center">
                Click slices to shade · {shaded.size === numer ? '✓ Ready to check!' : `${numer - shaded.size > 0 ? numer - shaded.size : 'Too many!'} more to go`}
              </p>
              <div className="relative flex justify-center">
                <PizzaBoard denom={denom} shaded={shaded} onToggle={toggleSlice} locked={status !== 'playing' || !!processingRef.current} />
                <AnimatePresence>
                  {feedbackAnim === 'correct' && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.3 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.8 }}
                      transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    >
                      <span className="text-7xl drop-shadow-lg">✅</span>
                    </motion.div>
                  )}
                  {feedbackAnim === 'wrong' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 0.45, 0.2, 0] }}
                      transition={{ duration: 0.65 }}
                      className="absolute inset-0 rounded-full pointer-events-none"
                      style={{ background: 'radial-gradient(circle, #f87171 0%, transparent 70%)' }}
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Feedback + check button */}
            <div className="flex gap-3">
              <div className="flex-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-1 flex items-center gap-1.5">
                  <Sparkles size={13} className="text-violet-500" />
                  <span className="text-xs font-black uppercase tracking-wide text-slate-400">Feedback</span>
                </div>
                <p className="min-h-[38px] text-sm font-semibold text-slate-700">
                  {feedback || (status === 'playing' ? 'Click slices to shade, then press Check.' : 'Press Start to begin.')}
                </p>
              </div>
              {status === 'playing' && (
                <button
                  onClick={checkAnswer}
                  disabled={shaded.size === 0}
                  className="flex min-w-[62px] flex-col items-center justify-center gap-1 rounded-xl bg-emerald-600 px-4 text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                >
                  <CheckCircle2 size={20} />
                  <span className="text-xs font-bold">Check</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {status === 'ready' && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl">
            <div className="mb-3 text-5xl">🍕</div>
            <h2 className="font-display text-3xl font-black text-slate-950">Fraction Slicer</h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
              A pizza divided into equal slices appears. Click to shade the right fraction, then press <strong>Check</strong>. You have 20 seconds!
            </p>
            <button
              onClick={() => { setStatus('playing'); setFeedback('Click pizza slices to shade the correct fraction, then press Check.'); }}
              className="mt-6 w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white hover:bg-violet-700"
            >
              Start Slicing!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
