import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

function getGridCols(denom) {
  if (denom <= 4) return denom;
  if (denom === 6) return 3;
  if (denom === 8) return 4;
  if (denom === 10) return 5;
  return 4; // 12 → 3 rows of 4
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
            setMistakes(m => {
              const next = m + 1;
              if (next >= 3) { setStatus('ended'); processingRef.current = false; return next; }
              setFeedback("Time's up! Next fraction.");
              setRoundIndex(r => {
                const nextR = r + 1;
                if (nextR >= totalRounds) { setStatus('ended'); processingRef.current = false; return r; }
                setPuzzle(generatePuzzle(grade));
                setShaded(new Set());
                processingRef.current = false;
                return nextR;
              });
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

  function toggleCell(idx) {
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
      setFeedback(`Correct! ${numer}/${denom} shaded perfectly.`);
      setTimeout(() => {
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
      }, 900);
    } else {
      setStreak(0);
      setMistakes(m => {
        const next = m + 1;
        if (next >= 3) { setStatus('ended'); processingRef.current = false; return next; }
        setFeedback(`Not quite — shade exactly ${numer} out of ${denom} cells.`);
        setTimeout(() => {
          setShaded(new Set());
          setFeedback('Cells cleared. Try again!');
          processingRef.current = false;
        }, 1000);
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
  }

  const { numer, denom } = puzzle;
  const cols = getGridCols(denom);
  const acc = Math.max(0, Math.round((score / Math.max(1, score + mistakes)) * 100));

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f5f0ff] px-3 py-4 text-slate-900 sm:px-5">
      <div className="mx-auto max-w-2xl">
        <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link to="/student" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:text-slate-950">
              <ArrowLeft size={19} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Scissors size={22} className="text-violet-600" />
                <h1 className="font-display text-2xl font-black text-slate-950">Fraction Slicer</h1>
              </div>
              <p className="mt-0.5 text-sm font-semibold text-slate-500">Shade the correct fraction of the shape.</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Score', val: score, color: '' },
              { label: 'Round', val: `${Math.min(roundIndex + 1, totalRounds)}/${totalRounds}`, color: '' },
              { label: 'Timer', val: `${timer}s`, color: 'text-violet-700' },
              { label: 'Mistakes', val: `${mistakes}/3`, color: 'text-rose-700' },
            ].map(s => (
              <div key={s.label} className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.label}</p>
                <p className={`text-base font-black tabular-nums ${s.color}`}>{s.val}</p>
              </div>
            ))}
          </div>
        </header>

        {status === 'ended' ? (
          <div className="grid min-h-[500px] place-items-center rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <div className="max-w-sm">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 text-4xl">
                {mistakes >= 3 ? '😵' : '🎉'}
              </div>
              <h2 className="font-display text-4xl font-black text-slate-950">{mistakes >= 3 ? 'Oops!' : 'Well Sliced!'}</h2>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                {score} correct · {acc}% accuracy · {bestStreak} best streak
              </p>
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
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Shade this fraction</p>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center leading-none">
                      <span className="text-5xl font-black text-violet-700">{numer}</span>
                      <div className="my-1.5 h-[3px] w-12 rounded bg-violet-700" />
                      <span className="text-5xl font-black text-violet-700">{denom}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-600">
                      Shade <strong className="text-slate-900">{numer}</strong> of <strong className="text-slate-900">{denom}</strong> equal cells
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Shaded</p>
                  <p className={`text-3xl font-black ${shaded.size === numer ? 'text-emerald-600' : 'text-slate-800'}`}>
                    {shaded.size}/{denom}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Click cells to shade them</p>
              <div
                className="mx-auto grid gap-2 sm:gap-3"
                style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, maxWidth: `${Math.min(cols * 80, 480)}px` }}
              >
                {Array.from({ length: denom }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleCell(i)}
                    disabled={status !== 'playing'}
                    className={`aspect-square rounded-xl border-2 text-xl font-black transition-all duration-100 ${
                      shaded.has(i)
                        ? 'scale-95 border-violet-400 bg-violet-500 text-white shadow-md'
                        : 'border-slate-200 bg-slate-50 text-slate-300 hover:border-violet-300 hover:bg-violet-50'
                    }`}
                  >
                    {shaded.has(i) ? '✓' : ''}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-1 flex items-center gap-2">
                  <Sparkles size={14} className="text-violet-500" />
                  <span className="text-xs font-black uppercase tracking-wide text-slate-400">Feedback</span>
                </div>
                <p className="min-h-[40px] text-sm font-semibold text-slate-700">
                  {feedback || (status === 'playing' ? 'Click cells to shade the fraction, then press Check.' : 'Press Start to begin.')}
                </p>
              </div>
              {status === 'playing' && (
                <button
                  onClick={checkAnswer}
                  disabled={shaded.size === 0}
                  className="flex min-w-[64px] flex-col items-center justify-center gap-1 rounded-xl bg-emerald-600 px-4 text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
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
              A shape divided into equal parts appears. Click cells to shade the correct fraction, then press <strong>Check</strong>. 20 seconds per round.
            </p>
            <button
              onClick={() => { setStatus('playing'); setFeedback('Click cells to shade the correct fraction, then press Check.'); }}
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
