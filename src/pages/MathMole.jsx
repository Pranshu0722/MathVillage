import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Hammer, RotateCcw } from 'lucide-react';
import { useGamification } from '../hooks/useGamification';
import { useAuthStore } from '../store/useAuthStore';
import { normalizeGrade } from '../lib/gradeUtils';
import { safeRecordAttempt as recordAttempt } from '../lib/safeRecordAttempt';
import { skillForGame } from '../engine/gameSkills';
import GameStartScreen from '../components/GameStartScreen';

const SKILL = skillForGame('MathMole');
const HOLE_COUNT = 9;
const GAME_TIME = 60;

function isPrime(n) {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}

const ALL_RULES = [
  { id: 'even',     desc: 'Hit EVEN numbers!',           emoji: '2️⃣', classify: n => n % 2 === 0,              range: [1, 20] },
  { id: 'odd',      desc: 'Hit ODD numbers!',             emoji: '1️⃣', classify: n => n % 2 !== 0,              range: [1, 20] },
  { id: 'gt10',     desc: 'Hit numbers GREATER than 10!', emoji: '⬆️', classify: n => n > 10,                   range: [1, 20] },
  { id: 'mult3',    desc: 'Hit MULTIPLES of 3!',          emoji: '✖️', classify: n => n % 3 === 0,              range: [1, 30], minGrade: 3 },
  { id: 'mult5',    desc: 'Hit MULTIPLES of 5!',          emoji: '✖️', classify: n => n % 5 === 0,              range: [1, 30], minGrade: 3 },
  { id: 'mult4',    desc: 'Hit MULTIPLES of 4!',          emoji: '✖️', classify: n => n % 4 === 0,              range: [1, 40], minGrade: 4 },
  { id: 'mult6',    desc: 'Hit MULTIPLES of 6!',          emoji: '✖️', classify: n => n % 6 === 0,              range: [1, 50], minGrade: 5 },
  { id: 'prime',    desc: 'Hit PRIME numbers!',           emoji: '⭐', classify: n => isPrime(n),               range: [2, 30], minGrade: 5 },
  { id: 'factor24', desc: 'Hit FACTORS of 24!',           emoji: '➗', classify: n => n > 0 && 24 % n === 0,   range: [1, 24], minGrade: 5 },
];

function getRulesForGrade(grade) {
  return ALL_RULES.filter(r => !r.minGrade || grade >= r.minGrade);
}

function pickRule(grade, excludeId = null) {
  const pool = getRulesForGrade(grade).filter(r => r.id !== excludeId);
  return pool[Math.floor(Math.random() * pool.length)];
}

function generateNumber(rule) {
  const [min, max] = rule.range;
  const rand = () => Math.floor(Math.random() * (max - min + 1)) + min;
  // bias ~50% correct, 50% incorrect
  for (let i = 0; i < 12; i++) {
    const n = rand();
    if (Math.random() < 0.5 ? rule.classify(n) : !rule.classify(n)) return n;
  }
  return rand();
}

export default function MathMole() {
  const { addXP } = useGamification();
  const { user } = useAuthStore();
  const grade = normalizeGrade(user?.grade);
  const navigate = useNavigate();

  const initRule = pickRule(grade);

  const [holes, setHoles] = useState(() => Array(HOLE_COUNT).fill(null));
  const [rule, setRule] = useState(initRule);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [timer, setTimer] = useState(GAME_TIME);
  const [status, setStatus] = useState('ready');
  const [ruleKey, setRuleKey] = useState(0);

  // Refs — authoritative state for all setTimeout/setInterval callbacks (no stale closures)
  const holesRef = useRef(Array(HOLE_COUNT).fill(null));
  const moleTimeoutsRef = useRef({});
  const moleIdRef = useRef(0);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
  const mistakesRef = useRef(0);
  const ruleRef = useRef(initRule);
  const statusRef = useRef('ready');

  useEffect(() => { ruleRef.current = rule; }, [rule]);
  useEffect(() => { statusRef.current = status; }, [status]);

  // Countdown
  useEffect(() => {
    if (status !== 'playing') return;
    const tick = setInterval(() => {
      setTimer(t => {
        if (t <= 1) { setStatus('ended'); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [status]);

  // XP on end
  useEffect(() => {
    if (status !== 'ended') return;
    const s = scoreRef.current, m = mistakesRef.current, bs = bestStreakRef.current;
    const acc = Math.max(0, Math.round((s / Math.max(1, s + m)) * 100));
    addXP(Math.max(60, s * 20 + bs * 10 + acc), 'Math Mole', s, acc, 'Arithmetic');
  }, [status]);

  // Mole spawner
  useEffect(() => {
    if (status !== 'playing') return;

    function spawnMole() {
      if (statusRef.current !== 'playing') return;
      const idx = Math.floor(Math.random() * HOLE_COUNT);
      if (holesRef.current[idx] !== null) return;

      const moleId = `m${++moleIdRef.current}`;
      const number = generateNumber(ruleRef.current);
      const mole = { moleId, number, correct: ruleRef.current.classify(number), anim: null };

      holesRef.current[idx] = mole;
      setHoles([...holesRef.current]);

      const sc = scoreRef.current;
      const visibleMs = sc < 10 ? 2200 : sc < 20 ? 1800 : 1500;
      moleTimeoutsRef.current[moleId] = setTimeout(() => {
        if (holesRef.current[idx]?.moleId === moleId) {
          holesRef.current[idx] = null;
          setHoles([...holesRef.current]);
        }
        delete moleTimeoutsRef.current[moleId];
      }, visibleMs);
    }

    let spawnTimer;
    function schedule() {
      const delay = scoreRef.current < 10 ? 1400 : scoreRef.current < 20 ? 1100 : 950;
      spawnTimer = setTimeout(() => { spawnMole(); schedule(); }, delay);
    }

    // Initial burst so the board isn't empty
    setTimeout(spawnMole, 250);
    setTimeout(spawnMole, 650);
    setTimeout(spawnMole, 1050);
    schedule();

    return () => {
      clearTimeout(spawnTimer);
      Object.values(moleTimeoutsRef.current).forEach(clearTimeout);
      moleTimeoutsRef.current = {};
      holesRef.current = Array(HOLE_COUNT).fill(null);
      setHoles(Array(HOLE_COUNT).fill(null));
    };
  }, [status]);

  function whack(idx) {
    if (statusRef.current !== 'playing') return;
    const mole = holesRef.current[idx];
    if (!mole || mole.anim) return;

    clearTimeout(moleTimeoutsRef.current[mole.moleId]);
    delete moleTimeoutsRef.current[mole.moleId];
    recordAttempt({ skillId: SKILL, correct: mole.correct, responseTime: 500 });

    if (mole.correct) {
      scoreRef.current++;
      streakRef.current++;
      if (streakRef.current > bestStreakRef.current) bestStreakRef.current = streakRef.current;
      setScore(scoreRef.current);
      setStreak(streakRef.current);
      setBestStreak(bestStreakRef.current);

      if (scoreRef.current % 10 === 0) {
        const next = pickRule(grade, ruleRef.current.id);
        ruleRef.current = next;
        setRule(next);
        setRuleKey(k => k + 1);
      }
    } else {
      streakRef.current = 0;
      mistakesRef.current++;
      setStreak(0);
      setMistakes(mistakesRef.current);
      if (mistakesRef.current >= 3) {
        statusRef.current = 'ended';
        setStatus('ended');
      }
    }

    holesRef.current[idx] = { ...mole, anim: mole.correct ? 'correct' : 'wrong' };
    setHoles([...holesRef.current]);

    setTimeout(() => {
      if (holesRef.current[idx]?.moleId === mole.moleId) {
        holesRef.current[idx] = null;
        setHoles([...holesRef.current]);
      }
    }, 350);
  }

  function restart() {
    Object.values(moleTimeoutsRef.current).forEach(clearTimeout);
    moleTimeoutsRef.current = {};
    moleIdRef.current = 0;
    scoreRef.current = 0;
    streakRef.current = 0;
    bestStreakRef.current = 0;
    mistakesRef.current = 0;
    statusRef.current = 'ready';
    holesRef.current = Array(HOLE_COUNT).fill(null);
    const r = pickRule(grade);
    ruleRef.current = r;
    setHoles(Array(HOLE_COUNT).fill(null));
    setRule(r);
    setRuleKey(0);
    setScore(0);
    setMistakes(0);
    setStreak(0);
    setBestStreak(0);
    setTimer(GAME_TIME);
    setStatus('ready');
  }

  const acc = Math.max(0, Math.round((score / Math.max(1, score + mistakes)) * 100));
  const timerPct = (timer / GAME_TIME) * 100;
  const timerColor = timer > 30 ? 'bg-emerald-500' : timer > 15 ? 'bg-amber-500' : 'bg-rose-500';

  function MolePreview() {
    const colors = ['#f97316', '#ef4444', '#22c55e', '#3b82f6', '#f97316', '#ef4444', '#22c55e', '#3b82f6', '#f97316'];
    const nums = [7, null, 12, 3, 15, null, 8, 21, 5];
    return (
      <div className="flex flex-col items-center gap-3 select-none">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Preview</p>
        <div className="grid grid-cols-3 gap-2">
          {nums.map((n, i) => (
            <div key={i} className="w-16 h-16 rounded-xl flex items-center justify-center font-black text-xl text-white shadow-md"
              style={{ background: n !== null ? `radial-gradient(ellipse at 50% 75%, #3d1800, #0a0400)` : 'transparent', border: '3px solid #1a0800' }}>
              {n !== null ? (
                <div className="w-12 h-12 rounded-lg flex items-center justify-center font-black text-white text-lg"
                  style={{ background: colors[i], border: `2px solid ${colors[i]}` }}>
                  {n}
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <p className="text-sm text-slate-400 font-medium">Whack numbers that match the rule!</p>
      </div>
    );
  }

  if (status === 'ready') {
    return (
      <GameStartScreen
        title="Math Mole"
        emoji="🔨"
        category="Arithmetic"
        description="Numbers pop up from holes — whack the ones that match the rule, avoid the rest. Rules change every 10 correct hits. You have 60 seconds and 3 lives!"
        stats={[
          { label: 'Time', value: `${GAME_TIME}s` },
          { label: 'Lives', value: '3' },
          { label: 'Grade', value: grade },
        ]}
        gradient="linear-gradient(135deg, #f59e0b, #d97706)"
        onStart={() => setStatus('playing')}
      >
        <MolePreview />
      </GameStartScreen>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f5f5e8] px-3 py-4 text-slate-900 sm:px-5">
      <div className="mx-auto max-w-lg">

        <header className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Link to="/student" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:text-slate-950">
              <ArrowLeft size={19} />
            </Link>
            <div className="flex items-center gap-2">
              <Hammer size={20} className="text-amber-600" />
              <h1 className="font-display text-xl font-black text-slate-950 sm:text-2xl">Math Mole</h1>
            </div>
          </div>
          <div className="flex gap-2">
            {[
              { label: 'Score',    val: score,           color: '' },
              { label: 'Streak',   val: streak,          color: 'text-amber-700' },
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
              <h2 className="font-display text-4xl font-black text-slate-950">
                {mistakes >= 3 ? 'Splatted!' : "Time's Up!"}
              </h2>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                {score} whacked · {acc}% accuracy · {bestStreak} best streak
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
                <button onClick={restart} className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-5 py-3 text-sm font-bold text-white hover:bg-amber-600">
                  <RotateCcw size={16} /> Play Again
                </button>
                <button onClick={() => navigate('/student')} className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  Dashboard
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">

            {/* Rule + timer */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Current rule</p>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={ruleKey}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.2 }}
                      className="text-xl font-black text-slate-950"
                    >
                      {rule.emoji} {rule.desc}
                    </motion.p>
                  </AnimatePresence>
                  <p className="mt-1 text-xs font-medium text-slate-400">Rule changes every 10 correct hits</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Time</p>
                  <p className={`text-2xl font-black tabular-nums ${timer <= 15 ? 'text-rose-600' : timer <= 30 ? 'text-amber-600' : 'text-emerald-700'}`}>
                    {timer}s
                  </p>
                </div>
              </div>
              <div className="rounded-full bg-slate-100 h-2.5 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-1000 ${timerColor}`} style={{ width: `${timerPct}%` }} />
              </div>
            </div>

            {/* Mole grid */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid grid-cols-3 gap-3">
                {holes.map((mole, idx) => (
                  <Hole key={idx} mole={mole} onWhack={() => whack(idx)} />
                ))}
              </div>
            </div>

          </div>
        )}
      </div>

    </div>
  );
}

function Hole({ mole, onWhack }) {
  return (
    <button
      type="button"
      onClick={onWhack}
      className="relative aspect-square rounded-2xl overflow-hidden select-none focus:outline-none active:scale-95 transition-transform"
      style={{ background: 'radial-gradient(ellipse at 50% 75%, #3d1800 0%, #0a0400 100%)', border: '4px solid #1a0800' }}
    >
      <div className="absolute inset-0" style={{ boxShadow: 'inset 0 6px 12px rgba(0,0,0,0.7)' }} />

      <AnimatePresence>
        {mole && (
          <motion.div
            key={mole.moleId}
            initial={{ y: '105%' }}
            animate={
              mole.anim === 'wrong'
                ? { y: '8%', x: [0, -9, 9, -7, 7, 0] }
                : mole.anim === 'correct'
                ? { y: '0%', scale: [1, 1.25, 0], opacity: [1, 1, 0] }
                : { y: '8%' }
            }
            exit={{ y: '105%' }}
            transition={
              mole.anim === 'wrong'   ? { duration: 0.35 } :
              mole.anim === 'correct' ? { duration: 0.32 } :
              { type: 'spring', stiffness: 480, damping: 30 }
            }
            className="absolute inset-x-2 bottom-0 flex items-center justify-center"
            style={{ height: '88%' }}
          >
            <div
              className="w-full h-full rounded-xl flex items-center justify-center shadow-lg"
              style={{
                background: mole.anim === 'correct' ? '#22c55e' : mole.anim === 'wrong' ? '#ef4444' : '#f97316',
                border: `3px solid ${mole.anim === 'correct' ? '#16a34a' : mole.anim === 'wrong' ? '#dc2626' : '#c2410c'}`,
              }}
            >
              <span className="text-2xl font-black text-white drop-shadow-md sm:text-3xl">
                {mole.anim === 'correct' ? '✓' : mole.anim === 'wrong' ? '✗' : mole.number}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}
