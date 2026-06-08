import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Layers, RotateCcw, Sparkles } from 'lucide-react';
import { useGamification } from '../hooks/useGamification';
import { useAuthStore } from '../store/useAuthStore';
import { normalizeGrade } from '../lib/gradeUtils';
import { safeRecordAttempt as recordAttempt } from '../lib/safeRecordAttempt';
import { skillForGame } from '../engine/gameSkills';

const SKILL = skillForGame('NumberSortRush');
const ROUND_TIME = 45;
const TOTAL_ROUNDS = 5;

function isPrime(n) {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}

const CATEGORIES = [
  {
    id: 'evenOdd',
    buckets: ['Even', 'Odd'],
    desc: 'Is the number Even or Odd?',
    icon: ['2️⃣', '1️⃣'],
    classify: n => n % 2 === 0 ? 0 : 1,
    styles: [
      { base: 'border-indigo-200 bg-indigo-50', glow: 'border-indigo-500 bg-indigo-100 ring-2 ring-indigo-300 shadow-xl shadow-indigo-200', label: 'text-indigo-700', badge: 'bg-indigo-500 text-white' },
      { base: 'border-rose-200 bg-rose-50', glow: 'border-rose-500 bg-rose-100 ring-2 ring-rose-300 shadow-xl shadow-rose-200', label: 'text-rose-700', badge: 'bg-rose-500 text-white' },
    ],
  },
  {
    id: 'multOf3',
    buckets: ['Multiple of 3', 'Not ×3'],
    desc: 'Is it a Multiple of 3?',
    icon: ['✖️', '❌'],
    classify: n => n % 3 === 0 ? 0 : 1,
    styles: [
      { base: 'border-emerald-200 bg-emerald-50', glow: 'border-emerald-500 bg-emerald-100 ring-2 ring-emerald-300 shadow-xl shadow-emerald-200', label: 'text-emerald-700', badge: 'bg-emerald-500 text-white' },
      { base: 'border-amber-200 bg-amber-50', glow: 'border-amber-500 bg-amber-100 ring-2 ring-amber-300 shadow-xl shadow-amber-200', label: 'text-amber-700', badge: 'bg-amber-500 text-white' },
    ],
  },
  {
    id: 'multOf4',
    buckets: ['Multiple of 4', 'Not ×4'],
    desc: 'Is it a Multiple of 4?',
    icon: ['✖️', '❌'],
    classify: n => n % 4 === 0 ? 0 : 1,
    styles: [
      { base: 'border-violet-200 bg-violet-50', glow: 'border-violet-500 bg-violet-100 ring-2 ring-violet-300 shadow-xl shadow-violet-200', label: 'text-violet-700', badge: 'bg-violet-500 text-white' },
      { base: 'border-orange-200 bg-orange-50', glow: 'border-orange-500 bg-orange-100 ring-2 ring-orange-300 shadow-xl shadow-orange-200', label: 'text-orange-700', badge: 'bg-orange-500 text-white' },
    ],
  },
  {
    id: 'primeComposite',
    buckets: ['Prime', 'Composite'],
    desc: 'Is the number Prime or Composite?',
    icon: ['⭐', '🔢'],
    classify: n => isPrime(n) ? 0 : 1,
    styles: [
      { base: 'border-cyan-200 bg-cyan-50', glow: 'border-cyan-500 bg-cyan-100 ring-2 ring-cyan-300 shadow-xl shadow-cyan-200', label: 'text-cyan-700', badge: 'bg-cyan-500 text-white' },
      { base: 'border-pink-200 bg-pink-50', glow: 'border-pink-500 bg-pink-100 ring-2 ring-pink-300 shadow-xl shadow-pink-200', label: 'text-pink-700', badge: 'bg-pink-500 text-white' },
    ],
  },
];

const ROUND_CATS = {
  2: [0, 0, 0, 0, 0],
  3: [0, 0, 1, 0, 1],
  4: [0, 1, 2, 0, 1],
  5: [0, 1, 3, 2, 3],
  6: [0, 1, 3, 2, 3],
};

function getCatIndices(grade) {
  return ROUND_CATS[Math.min(6, Math.max(2, grade))] || ROUND_CATS[4];
}

function generateNumbers(catIdx, grade, count = 8) {
  const max = grade <= 3 ? 20 : grade <= 4 ? 30 : 50;
  const cat = CATEGORIES[catIdx];
  const g0 = [], g1 = [];
  for (let i = 2; i <= max; i++) {
    if (cat.classify(i) === 0) g0.push(i); else g1.push(i);
  }
  g0.sort(() => Math.random() - 0.5);
  g1.sort(() => Math.random() - 0.5);
  const half = Math.min(Math.floor(count / 2), g0.length, g1.length);
  return [...g0.slice(0, half), ...g1.slice(0, count - half)].sort(() => Math.random() - 0.5);
}

function buildRound(roundIdx, grade) {
  const cats = getCatIndices(grade);
  const catIdx = cats[roundIdx % cats.length];
  const nums = generateNumbers(catIdx, grade);
  return {
    category: CATEGORIES[catIdx],
    items: nums.map((v, i) => ({ id: `r${roundIdx}-${i}`, value: v, sorted: false })),
  };
}

export default function NumberSortRush() {
  const { addXP } = useGamification();
  const { user } = useAuthStore();
  const grade = normalizeGrade(user?.grade);
  const navigate = useNavigate();
  const processingRef = useRef(false);

  const [roundIndex, setRoundIndex] = useState(0);
  const [round, setRound] = useState(() => buildRound(0, grade));
  const [selected, setSelected] = useState(null);
  const [bucketCounts, setBucketCounts] = useState([0, 0]);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [timer, setTimer] = useState(ROUND_TIME);
  const [status, setStatus] = useState('ready');
  const [feedback, setFeedback] = useState('');
  const [wrongId, setWrongId] = useState(null);
  const [sortAnim, setSortAnim] = useState(null); // { id, bucket }

  // Per-round countdown timer
  useEffect(() => {
    if (status !== 'playing') return;
    const tick = setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          if (!processingRef.current) {
            processingRef.current = true;
            recordAttempt({ skillId: SKILL, correct: false, responseTime: ROUND_TIME * 1000 });
            setStreak(0);
            setSelected(null);
            setMistakes(m => {
              const next = m + 1;
              if (next >= 3) { setStatus('ended'); processingRef.current = false; return next; }
              setFeedback("Time's up! Moving to next round.");
              setTimeout(() => {
                setRoundIndex(r => {
                  const nextR = r + 1;
                  if (nextR >= TOTAL_ROUNDS) { setStatus('ended'); processingRef.current = false; return r; }
                  setRound(buildRound(nextR, grade));
                  setBucketCounts([0, 0]);
                  setFeedback('New round — sort them all!');
                  processingRef.current = false;
                  return nextR;
                });
              }, 800);
              return next;
            });
          }
          return ROUND_TIME;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [grade, roundIndex, status]);

  useEffect(() => {
    if (status !== 'ended') return;
    const acc = Math.max(0, Math.round((score / Math.max(1, score + mistakes)) * 100));
    addXP(Math.max(50, score * 15 + bestStreak * 10 + acc), 'Number Sort Rush', score, acc, 'Patterns');
  }, [addXP, bestStreak, mistakes, score, status]);

  function handleNumberClick(item) {
    if (status !== 'playing' || item.sorted || processingRef.current) return;
    const isDeselecting = selected?.id === item.id;
    setSelected(isDeselecting ? null : { id: item.id, value: item.value });
    setFeedback(isDeselecting ? 'Click a number to select it.' : `${item.value} selected — drop it in the right bucket!`);
  }

  function handleBucketClick(bucketIdx) {
    if (status !== 'playing' || !selected || processingRef.current) return;
    const { id: selId, value: selVal } = selected;
    const correct = round.category.classify(selVal) === bucketIdx;
    recordAttempt({ skillId: SKILL, correct, responseTime: (ROUND_TIME - timer) * 1000 });
    setSelected(null);

    if (correct) {
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setBestStreak(b => Math.max(b, nextStreak));
      setScore(s => s + 1);
      setBucketCounts(bc => { const n = [...bc]; n[bucketIdx]++; return n; });
      setSortAnim({ id: selId, bucket: bucketIdx });
      setTimeout(() => setSortAnim(null), 400);
      setFeedback(`Correct! ${selVal} → ${round.category.buckets[bucketIdx]}`);
      const remaining = round.items.filter(n => !n.sorted && n.id !== selId).length;
      setRound(r => ({ ...r, items: r.items.map(n => n.id === selId ? { ...n, sorted: true } : n) }));
      if (remaining === 0) {
        processingRef.current = true;
        setTimeout(() => {
          setRoundIndex(idx => {
            const nextIdx = idx + 1;
            if (nextIdx >= TOTAL_ROUNDS) { setStatus('ended'); processingRef.current = false; return idx; }
            setRound(buildRound(nextIdx, grade));
            setBucketCounts([0, 0]);
            setTimer(ROUND_TIME);
            setFeedback('Round complete! Keep sorting.');
            processingRef.current = false;
            return nextIdx;
          });
        }, 700);
      }
    } else {
      setStreak(0);
      setMistakes(m => {
        const next = m + 1;
        if (next >= 3) { setStatus('ended'); processingRef.current = false; return next; }
        setFeedback(`${selVal} is ${round.category.buckets[round.category.classify(selVal)]}! Try again.`);
        return next;
      });
      setWrongId(selId);
      setTimeout(() => setWrongId(null), 600);
    }
  }

  function restart() {
    processingRef.current = false;
    setRoundIndex(0);
    setRound(buildRound(0, grade));
    setSelected(null);
    setBucketCounts([0, 0]);
    setScore(0);
    setMistakes(0);
    setStreak(0);
    setBestStreak(0);
    setTimer(ROUND_TIME);
    setStatus('ready');
    setFeedback('');
    setWrongId(null);
    setSortAnim(null);
  }

  const acc = Math.max(0, Math.round((score / Math.max(1, score + mistakes)) * 100));
  const { category } = round;
  const timerPct = (timer / ROUND_TIME) * 100;
  const timerColor = timer > 20 ? 'bg-emerald-500' : timer > 10 ? 'bg-amber-500' : 'bg-rose-500';
  const unsortedCount = round.items.filter(n => !n.sorted).length;
  const hasSelected = !!selected && status === 'playing';

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f0fdf4] px-3 py-4 text-slate-900 sm:px-5">
      <div className="mx-auto max-w-2xl">
        <header className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Link to="/student" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:text-slate-950">
              <ArrowLeft size={19} />
            </Link>
            <div className="flex items-center gap-2">
              <Layers size={20} className="text-emerald-600" />
              <h1 className="font-display text-xl font-black text-slate-950 sm:text-2xl">Number Sort Rush</h1>
            </div>
          </div>
          <div className="flex gap-2">
            {[
              { label: 'Score', val: score, color: '' },
              { label: 'Round', val: `${Math.min(roundIndex + 1, TOTAL_ROUNDS)}/${TOTAL_ROUNDS}`, color: '' },
              { label: 'Left', val: unsortedCount, color: 'text-emerald-700' },
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
          <div className="grid min-h-[500px] place-items-center rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <div className="max-w-sm">
              <div className="mb-4 text-6xl">{mistakes >= 3 ? '😵' : '🎉'}</div>
              <h2 className="font-display text-4xl font-black text-slate-950">{mistakes >= 3 ? 'Busted!' : 'Sorted!'}</h2>
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
                <button onClick={restart} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700">
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
            {/* Rule + timer */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between mb-3 gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Round rule</p>
                  <p className="text-lg font-black text-slate-950">{category.desc}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Time</p>
                  <p className={`text-2xl font-black tabular-nums transition-colors ${timer <= 10 ? 'text-rose-600' : timer <= 20 ? 'text-amber-600' : 'text-emerald-700'}`}>{timer}s</p>
                </div>
              </div>
              <div className="rounded-full bg-slate-100 h-2.5 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-1000 ${timerColor}`} style={{ width: `${timerPct}%` }} />
              </div>
            </div>

            {/* Number cards */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-1.5">
                <Sparkles size={13} className="text-emerald-500" />
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                  {hasSelected ? `${selected.value} selected — pick a bucket below!` : 'Click a number to select it'}
                </p>
              </div>
              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                {round.items.map(item => {
                  const isSelected = selected?.id === item.id;
                  const isWrong = wrongId === item.id;
                  const isSorting = sortAnim?.id === item.id;
                  return (
                    <motion.button
                      key={item.id}
                      animate={
                        isWrong ? { x: [0, -9, 9, -6, 6, 0] } :
                        isSorting ? { scale: [1, 1.25, 0], opacity: [1, 1, 0] } :
                        isSelected ? { scale: 1.1 } : { scale: 1 }
                      }
                      transition={isWrong ? { duration: 0.4 } : isSorting ? { duration: 0.35 } : { type: 'spring', stiffness: 400, damping: 20 }}
                      type="button"
                      onClick={() => handleNumberClick(item)}
                      disabled={item.sorted || status !== 'playing'}
                      className={`rounded-xl border-2 py-3 text-xl font-black transition-colors duration-150 ${
                        item.sorted
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-400 opacity-50 cursor-default'
                          : isSelected
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-lg ring-2 ring-emerald-300 cursor-pointer'
                          : 'border-slate-200 bg-white text-slate-800 hover:border-emerald-300 hover:bg-emerald-50 cursor-pointer'
                      }`}
                    >
                      {item.sorted ? '✓' : item.value}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Buckets */}
            <div className="grid grid-cols-2 gap-3">
              <AnimatePresence>
                {category.buckets.map((label, i) => {
                  const st = category.styles[i];
                  return (
                    <motion.button
                      key={label}
                      layout
                      animate={hasSelected ? { scale: 1.02 } : { scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                      type="button"
                      onClick={() => handleBucketClick(i)}
                      disabled={!hasSelected}
                      className={`rounded-xl border-2 text-center transition-colors duration-150 ${
                        hasSelected ? st.glow : `${st.base} opacity-80`
                      } disabled:cursor-default`}
                      style={{ padding: hasSelected ? '1.5rem 1rem' : '1rem' }}
                    >
                      <p className={`text-lg font-black sm:text-xl ${st.label}`}>{label}</p>
                      {hasSelected && (
                        <p className="mt-1 text-xs font-bold text-slate-500 animate-pulse">← Sort here</p>
                      )}
                      <div className={`mx-auto mt-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${st.badge}`}>
                        {bucketCounts[i]}
                      </div>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Feedback bar */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="min-h-[20px] text-sm font-semibold text-slate-700">
                {feedback || (status === 'playing' ? 'Click a number to select it, then click the correct bucket.' : 'Press Start to begin!')}
              </p>
            </div>
          </div>
        )}
      </div>

      {status === 'ready' && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl">
            <div className="mb-3 text-5xl">🗂️</div>
            <h2 className="font-display text-3xl font-black text-slate-950">Number Sort Rush</h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
              Click a number to select it, then drop it into the correct bucket. You have <strong>{ROUND_TIME} seconds</strong> per round — sort them all before time runs out!
            </p>
            <button
              onClick={() => { setStatus('playing'); setFeedback('Click a number to select it, then click the correct bucket.'); }}
              className="mt-6 w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700"
            >
              Start Sorting!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
