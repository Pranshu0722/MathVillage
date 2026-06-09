import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Award, Crosshair, Flame, Rocket, RotateCcw, Shield, Zap } from 'lucide-react';
import GameStartScreen from '../components/GameStartScreen';
import { useGamification } from '../hooks/useGamification';
import { useAuthStore } from '../store/useAuthStore';
import { getGradeTier, normalizeGrade } from '../lib/gradeUtils';
import { safeRecordAttempt as recordAttempt } from '../lib/safeRecordAttempt';
import { skillForGame } from '../engine/gameSkills';

const SKILL = skillForGame('MultiplicationMeteor');

const MAX_MISSES = 3;

function getDifficulty(grade) {
  if (grade <= 2) return { max: 6, spawnMs: 2100, fall: 0.62, limit: 16 };
  if (grade === 3) return { max: 9, spawnMs: 1950, fall: 0.72, limit: 20 };
  if (grade === 4) return { max: 12, spawnMs: 1800, fall: 0.82, limit: 24 };
  return { max: 14, spawnMs: 1650, fall: 0.92, limit: 28 };
}

function createMeteor(grade, score) {
  const difficulty = getDifficulty(grade);
  const min = 2;
  const a = Math.floor(Math.random() * (difficulty.max - min + 1)) + min;
  const b = Math.floor(Math.random() * (difficulty.max - min + 1)) + min;
  const drift = Math.random() > 0.5 ? 1 : -1;

  return {
    id: `${Date.now()}-${Math.random()}`,
    a,
    b,
    answer: a * b,
    x: 10 + Math.random() * 80,
    y: -12,
    speed: difficulty.fall + Math.min(0.65, score / 420) + Math.random() * 0.18,
    drift,
    kind: Math.random() > 0.72 ? 'balloon' : 'meteor',
  };
}

const STARS = [
  { left: '8%',  top: '12%', size: 'h-1 w-1',     opacity: 'bg-white/80' },
  { left: '30%', top: '24%', size: 'h-1 w-1',     opacity: 'bg-white/60' },
  { left: '68%', top: '18%', size: 'h-1 w-1',     opacity: 'bg-white/70' },
  { left: '86%', top: '36%', size: 'h-1 w-1',     opacity: 'bg-white/70' },
  { left: '52%', top: '8%',  size: 'h-0.5 w-0.5', opacity: 'bg-white/50' },
  { left: '18%', top: '42%', size: 'h-0.5 w-0.5', opacity: 'bg-[#5EDAD0]/40' },
  { left: '74%', top: '52%', size: 'h-0.5 w-0.5', opacity: 'bg-white/40' },
  { left: '42%', top: '38%', size: 'h-0.5 w-0.5', opacity: 'bg-white/50' },
  { left: '91%', top: '14%', size: 'h-1 w-1',     opacity: 'bg-cyan-100/50' },
  { left: '5%',  top: '55%', size: 'h-0.5 w-0.5', opacity: 'bg-white/30' },
  { left: '60%', top: '62%', size: 'h-1 w-1',     opacity: 'bg-white/40' },
  { left: '23%', top: '68%', size: 'h-0.5 w-0.5', opacity: 'bg-white/35' },
];

function FallingField({ meteors, explosions, lasers, danger, turretAngle }) {
  return (
    <div className={`relative h-[560px] overflow-hidden rounded-2xl border transition-all duration-300 bg-[#060d1f] ${
      danger
        ? 'border-[#FF7052]/70 shadow-[0_0_0_2px_rgba(255,112,82,0.35),0_0_40px_rgba(255,112,82,0.18)]'
        : 'border-white/10 shadow-[0_0_40px_rgba(94,218,208,0.06)]'
    }`}>
      {/* Background gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(94,218,208,0.1),transparent_45%),radial-gradient(ellipse_at_bottom-right,rgba(182,134,246,0.07),transparent_40%)]" />
      {danger && (
        <div className="absolute inset-0 bg-[#FF7052]/10 animate-pulse pointer-events-none" />
      )}

      {/* Stars */}
      {STARS.map((star, i) => (
        <div
          key={i}
          className={`absolute rounded-full ${star.size} ${star.opacity}`}
          style={{ left: star.left, top: star.top }}
        />
      ))}

      {/* Meteors & balloons */}
      {meteors.map((meteor) => (
        <div
          key={meteor.id}
          className={`absolute flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center text-center text-base font-black text-white transition-[top,left] duration-100 ease-linear ${
            meteor.kind === 'balloon'
              ? 'rounded-full border border-[#B686F6]/60 bg-gradient-to-br from-[#B686F6] to-[#7c3aed] shadow-[0_0_20px_rgba(182,134,246,0.5)]'
              : 'rounded-[35%] border border-[#FFCA42]/50 bg-gradient-to-br from-[#FF7052] to-[#c2410c] shadow-[0_0_24px_rgba(255,112,82,0.55)]'
          }`}
          style={{ left: `${meteor.x}%`, top: `${meteor.y}%` }}
        >
          <span className="leading-none">{meteor.a}</span>
          <span className="text-xs opacity-70">×</span>
          <span className="leading-none">{meteor.b}</span>
          {meteor.kind === 'balloon' && (
            <span className="absolute -bottom-5 h-5 w-px bg-[#B686F6]/60" />
          )}
          {meteor.kind === 'meteor' && (
            <span className="absolute -top-10 h-10 w-8 rounded-full bg-gradient-to-t from-[#FF7052]/50 to-transparent blur-sm" />
          )}
        </div>
      ))}

      {/* Lasers */}
      {lasers.map((laser) => (
        <div
          key={laser.id}
          className="absolute bottom-24 left-1/2 h-[760px] w-1.5 origin-bottom -translate-x-1/2 rounded-full bg-[#5EDAD0] shadow-[0_0_18px_rgba(94,218,208,1),0_0_40px_rgba(94,218,208,0.5)]"
          style={{ transform: `translateX(-50%) rotate(${laser.angle}deg)` }}
        />
      ))}

      {/* Explosions */}
      {explosions.map((explosion) => (
        <div
          key={explosion.id}
          className="absolute z-20 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
          style={{ left: `${explosion.x}%`, top: `${explosion.y}%` }}
        >
          <Flame size={56} className="text-amber-300 drop-shadow-[0_0_20px_rgba(251,191,36,0.9)]" />
          <div className="absolute inset-0 animate-ping rounded-full bg-orange-300/30" />
        </div>
      ))}

      {/* Ground base */}
      <div className="absolute inset-x-0 bottom-0 h-24">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#5EDAD0] to-transparent shadow-[0_0_12px_rgba(94,218,208,0.7)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent" />
      </div>

      {/* Turret */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
        <div
          className="mx-auto h-14 w-[7px] origin-bottom rounded-t-full bg-gradient-to-t from-slate-300 to-white shadow-[0_0_14px_rgba(255,255,255,0.35)] transition-transform duration-150"
          style={{ transform: `rotate(${turretAngle}deg)` }}
        />
        <div className="-mt-2 flex h-14 w-32 items-center justify-center rounded-t-[1.5rem] border border-[#5EDAD0]/30 bg-slate-800 shadow-[0_-4px_20px_rgba(94,218,208,0.15)]">
          <Crosshair className="text-[#5EDAD0]" size={26} />
        </div>
      </div>
    </div>
  );
}

function LivesDisplay({ misses }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: MAX_MISSES }, (_, i) => (
        <Shield
          key={i}
          size={20}
          className={i < MAX_MISSES - misses ? 'text-[#5EDAD0] drop-shadow-[0_0_6px_rgba(94,218,208,0.8)]' : 'text-slate-700'}
          fill={i < MAX_MISSES - misses ? 'currentColor' : 'none'}
        />
      ))}
    </div>
  );
}

export default function MultiplicationMeteor() {
  const { addXP } = useGamification();
  const { user } = useAuthStore();
  const grade = normalizeGrade(user?.grade);
  const gradeTier = getGradeTier(grade);
  const navigate = useNavigate();
  const difficulty = useMemo(() => getDifficulty(grade), [grade]);
  const inputRef = useRef(null);
  const awardedRef = useRef(false);

  const [gameState, setGameState] = useState('idle');
  const [meteors, setMeteors] = useState([]);
  const [explosions, setExplosions] = useState([]);
  const [lasers, setLasers] = useState([]);
  const [answer, setAnswer] = useState('');
  const [score, setScore] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [turretAngle, setTurretAngle] = useState(0);
  const [message, setMessage] = useState('Type a falling product answer and press Enter to fire.');

  const accuracy = Math.max(0, Math.round((hits / Math.max(1, hits + misses)) * 100));
  const isPlaying = gameState === 'playing';
  const progressPct = Math.round((hits / difficulty.limit) * 100);

  const startGame = () => {
    awardedRef.current = false;
    setGameState('playing');
    setMeteors([createMeteor(grade, 0)]);
    setExplosions([]);
    setLasers([]);
    setAnswer('');
    setScore(0);
    setHits(0);
    setMisses(0);
    setCombo(0);
    setBestCombo(0);
    setTurretAngle(0);
    setMessage('Defense online. Type the product on a falling object and press Enter.');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const endGame = useCallback((finalScore = score, finalHits = hits, finalAccuracy = accuracy, finalBestCombo = bestCombo) => {
    setGameState('ended');
    if (!awardedRef.current) {
      awardedRef.current = true;
      const xpEarned = Math.max(60, Math.round(finalScore * 0.7 + finalAccuracy + finalBestCombo * 8 + gradeTier * 20));
      addXP(xpEarned, 'Multiplication Meteor', finalHits, finalAccuracy, 'Multiplication');
    }
  }, [accuracy, addXP, bestCombo, gradeTier, hits, score]);

  useEffect(() => {
    if (!isPlaying) return undefined;

    const spawnTimer = setInterval(() => {
      setMeteors((current) => {
        if (current.length >= 6 || hits >= difficulty.limit) return current;
        return [...current, createMeteor(grade, score)];
      });
    }, difficulty.spawnMs);

    const fallTimer = setInterval(() => {
      setMeteors((current) => {
        const survivors = [];
        let lost = 0;

        current.forEach((meteor) => {
          const nextY = meteor.y + meteor.speed;
          const nextX = Math.max(7, Math.min(93, meteor.x + meteor.drift * 0.08));
          if (nextY >= 94) {
            lost += 1;
            return;
          }
          survivors.push({ ...meteor, y: nextY, x: nextX });
        });

        if (lost > 0) {
          setMisses((currentMisses) => {
            const nextMisses = currentMisses + lost;
            if (nextMisses >= MAX_MISSES) setTimeout(endGame, 0);
            return nextMisses;
          });
          setCombo(0);
          setMessage(`${lost} object${lost > 1 ? 's' : ''} reached the floor. ${MAX_MISSES} misses ends the mission.`);
        }

        return survivors;
      });
    }, 100);

    return () => {
      clearInterval(spawnTimer);
      clearInterval(fallTimer);
    };
  }, [difficulty.limit, difficulty.spawnMs, endGame, grade, hits, isPlaying, score]);

  const fire = (event) => {
    event.preventDefault();
    if (!isPlaying) return;

    const value = Number(answer);
    if (!Number.isInteger(value)) {
      setMessage('Enter a whole-number product before firing.');
      return;
    }

    const targetIndex = meteors.findIndex((meteor) => meteor.answer === value);
    recordAttempt({ skillId: SKILL, correct: targetIndex !== -1, responseTime: 0 });
    if (targetIndex === -1) {
      setMisses((current) => {
        const next = current + 1;
        if (next >= MAX_MISSES) setTimeout(endGame, 0);
        return next;
      });
      setCombo(0);
      setMessage(`No falling object has product ${value}. Miss ${Math.min(MAX_MISSES, misses + 1)}/${MAX_MISSES}.`);
      setAnswer('');
      return;
    }

    const target = meteors[targetIndex];
    const nextHits = hits + 1;
    const nextCombo = combo + 1;
    const nextBestCombo = Math.max(bestCombo, nextCombo);
    const nextScore = score + 25 + nextCombo * 5;
    const nextAccuracy = Math.max(0, Math.round((nextHits / Math.max(1, nextHits + misses)) * 100));
    const dx = target.x - 50;
    const dy = 92 - target.y;
    const angle = Math.atan2(dx, dy) * (180 / Math.PI);
    const effectId = `${target.id}-hit`;

    setTurretAngle(angle);
    setLasers((current) => [...current, { id: effectId, angle }]);
    setExplosions((current) => [...current, { id: effectId, x: target.x, y: target.y }]);
    setMeteors((current) => current.filter((_, index) => index !== targetIndex));
    setHits(nextHits);
    setCombo((current) => {
      const updatedCombo = current + 1;
      setBestCombo((best) => Math.max(best, updatedCombo));
      return updatedCombo;
    });
    setScore(nextScore);
    setMessage(`Hit confirmed: ${target.a} × ${target.b} = ${target.answer}.`);
    setAnswer('');

    if (nextHits >= difficulty.limit) {
      setTimeout(() => endGame(nextScore, nextHits, nextAccuracy, nextBestCombo), 300);
    }

    setTimeout(() => {
      setLasers((current) => current.filter((laser) => laser.id !== effectId));
      setExplosions((current) => current.filter((explosion) => explosion.id !== effectId));
      setTurretAngle(0);
    }, 260);
  };

  if (gameState === 'idle') {
    return (
      <GameStartScreen
        title="Multiplication Meteor"
        emoji="🚀"
        category="Multiplication"
        description="Falling meteors and balloons carry multiplication problems. Type the product and press Enter to shoot them before they hit the floor. Three misses ends the mission!"
        stats={[
          { label: 'Misses', value: `${MAX_MISSES} max` },
          { label: 'Hits', value: `${difficulty.limit}` },
          { label: 'Grade', value: grade },
        ]}
        gradient="linear-gradient(135deg, #FF7052, #FFCA42)"
        onStart={startGame}
      >
        <div className="flex flex-col items-center gap-4 select-none">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Preview</p>
          <div className="relative h-44 w-full max-w-[260px] overflow-hidden rounded-xl bg-[#060d1f] border border-white/10 shadow-[0_0_30px_rgba(34,211,238,0.08)]">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.15),transparent_45%)]" />
            <div className="absolute left-[22%] top-[14%] flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-[35%] border border-orange-200/50 bg-gradient-to-br from-orange-400 to-red-800 text-sm font-black text-white shadow-[0_0_16px_rgba(248,113,113,0.5)]">
              <span>6</span><span className="text-[9px] opacity-60">×</span><span>7</span>
            </div>
            <div className="absolute left-[72%] top-[34%] flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-[#B686F6]/60 bg-gradient-to-br from-[#B686F6] to-[#7c3aed] text-sm font-black text-white shadow-[0_0_16px_rgba(182,134,246,0.5)]">
              <span>4</span><span className="text-[9px] opacity-60">×</span><span>9</span>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#5EDAD0] to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-950 to-transparent" />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
              <div className="mx-auto h-7 w-[5px] rounded-t-full bg-white" />
              <div className="-mt-1 flex h-7 w-14 items-center justify-center rounded-t-xl bg-slate-800 border border-[#5EDAD0]/20">
                <Crosshair className="text-[#5EDAD0]" size={12} />
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-400 font-medium">Type the product to shoot it!</p>
        </div>
      </GameStartScreen>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#060d1f] px-3 py-4 text-white sm:px-5 lg:px-8">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <header className="mb-4 relative overflow-hidden rounded-2xl border border-white/8 bg-[#0a1628] px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          {/* gradient top strip */}
          <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-2xl bg-gradient-to-r from-[#FF7052] via-[#FFCA42] to-[#5EDAD0]" />

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <Link
                to="/student"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Back to dashboard"
              >
                <ArrowLeft size={17} />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <Rocket size={18} className="text-[#FF7052]" />
                  <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-[#FF7052] to-[#FFCA42] bg-clip-text text-transparent">
                    Multiplication Meteor
                  </h1>
                  <span className="rounded-full border border-[#FFCA42]/30 bg-[#FFCA42]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-[#FFCA42]">
                    Grade {grade}
                  </span>
                </div>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">
                  Type the product on any falling object and press Enter
                </p>
              </div>
            </div>

            {/* HUD chips */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-col items-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 min-w-[64px]">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Score</span>
                <span className="text-lg font-black tabular-nums text-white">{score}</span>
              </div>
              <div className="flex flex-col items-center rounded-xl border border-[#5EDAD0]/20 bg-[#5EDAD0]/10 px-4 py-2 min-w-[64px]">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#5EDAD0]/70">Hits</span>
                <span className="text-lg font-black tabular-nums text-[#5EDAD0]">{hits}<span className="text-xs text-[#5EDAD0]/50">/{difficulty.limit}</span></span>
              </div>
              <div className={`flex flex-col items-center rounded-xl border px-4 py-2 min-w-[64px] ${misses >= 2 ? 'border-[#FF7052]/40 bg-[#FF7052]/10' : 'border-white/10 bg-white/5'}`}>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Lives</span>
                <LivesDisplay misses={misses} />
              </div>
              {combo >= 2 && (
                <div className="flex flex-col items-center rounded-xl border border-[#FFCA42]/30 bg-[#FFCA42]/10 px-4 py-2 min-w-[64px] animate-pulse">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#FFCA42]/70">Combo</span>
                  <span className="text-lg font-black tabular-nums text-[#FFCA42]">{combo}×</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Mission progress bar */}
        <div className="mb-3 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#FF7052] to-[#FFCA42] transition-all duration-300 shadow-[0_0_8px_rgba(255,202,66,0.5)]"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap">
            {hits}/{difficulty.limit} destroyed
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          {/* Game field */}
          <div className="relative">
            <FallingField
              meteors={meteors}
              explosions={explosions}
              lasers={lasers}
              danger={misses >= 2}
              turretAngle={turretAngle}
            />

            {/* Game ended overlay */}
            {gameState === 'ended' && (
              <div className="absolute inset-0 grid place-items-center rounded-2xl bg-slate-950/80 p-6 text-center backdrop-blur-sm">
                <div className="max-w-sm w-full">
                  <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${
                    misses >= MAX_MISSES ? 'bg-[#FF7052]/20 border border-[#FF7052]/30' : 'bg-[#FFCA42]/20 border border-[#FFCA42]/30'
                  }`}>
                    {misses >= MAX_MISSES
                      ? <Shield size={32} className="text-[#FF7052]" />
                      : <Award size={32} className="text-[#FFCA42]" />
                    }
                  </div>
                  <h2 className="text-3xl font-black">
                    {misses >= MAX_MISSES ? 'Defense Offline' : 'Sector Cleared!'}
                  </h2>
                  <p className="mt-2 text-sm text-slate-400 font-medium">
                    {misses >= MAX_MISSES ? 'Too many objects got through.' : 'All targets destroyed.'}
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-2 text-left">
                    {[
                      { label: 'Hits', value: hits, color: 'text-[#5EDAD0]' },
                      { label: 'Accuracy', value: `${accuracy}%`, color: 'text-emerald-300' },
                      { label: 'Best combo', value: `${bestCombo}×`, color: 'text-[#FFCA42]' },
                      { label: 'Score', value: score, color: 'text-white' },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">{stat.label}</div>
                        <div className={`mt-1 text-xl font-black ${stat.color}`}>{stat.value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex gap-3">
                    <button
                      onClick={startGame}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7052] to-[#FFCA42] px-4 py-3 text-sm font-black text-white shadow-[0_4px_14px_rgba(255,112,82,0.35)] hover:opacity-90 transition-all"
                    >
                      <RotateCcw size={15} /> Play Again
                    </button>
                    <button
                      onClick={() => navigate('/student')}
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:bg-white/10 transition-colors"
                    >
                      Dashboard
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-3">

            {/* Fire control */}
            <div className="rounded-2xl border border-[#5EDAD0]/20 bg-[#0a1628] p-4 shadow-[0_0_30px_rgba(94,218,208,0.05)]">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={14} className="text-[#5EDAD0]" />
                <span className="text-xs font-black uppercase tracking-widest text-[#5EDAD0]">Fire Control</span>
              </div>
              <p className="text-xs font-medium text-slate-400 leading-5 min-h-[2.5rem]">{message}</p>
              <form onSubmit={fire} className="mt-3">
                <input
                  ref={inputRef}
                  type="number"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  disabled={!isPlaying}
                  placeholder="0"
                  inputMode="numeric"
                  className="w-full rounded-xl border border-[#5EDAD0]/20 bg-black/40 px-4 py-4 text-center text-3xl font-black text-white outline-none transition-all focus:border-[#5EDAD0] focus:shadow-[0_0_16px_rgba(94,218,208,0.2)] disabled:opacity-40"
                />
                <button
                  disabled={!isPlaying}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7052] to-[#FFCA42] px-4 py-3 text-sm font-black text-white shadow-[0_4px_16px_rgba(255,112,82,0.3)] transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                >
                  <Rocket size={15} /> Fire Laser
                </button>
              </form>
            </div>

            {/* Performance */}
            <div className="rounded-2xl border border-white/8 bg-[#0a1628] p-4">
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">Performance</span>
              <div className="mt-3 space-y-2">
                {[
                  { label: 'Accuracy', value: `${accuracy}%`, color: accuracy >= 80 ? 'text-emerald-300' : accuracy >= 50 ? 'text-[#FFCA42]' : 'text-[#FF7052]' },
                  { label: 'Best combo', value: `${bestCombo}×`, color: 'text-[#FFCA42]' },
                  { label: 'Active objects', value: meteors.length, color: 'text-slate-300' },
                  { label: 'Combo now', value: combo > 0 ? `${combo}×` : '—', color: combo >= 3 ? 'text-[#FFCA42]' : 'text-slate-400' },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2 text-sm">
                    <span className="font-semibold text-slate-400">{stat.label}</span>
                    <span className={`font-black tabular-nums ${stat.color}`}>{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rules */}
            <div className="rounded-2xl border border-white/8 bg-[#0a1628] p-4">
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">Mission Rules</span>
              <div className="mt-3 space-y-2 text-xs font-semibold text-slate-400 leading-5">
                <div className="flex gap-2 rounded-lg bg-black/20 px-3 py-2">
                  <span className="text-[#5EDAD0] shrink-0">01</span> Solve the multiplication on any falling object.
                </div>
                <div className="flex gap-2 rounded-lg bg-black/20 px-3 py-2">
                  <span className="text-[#5EDAD0] shrink-0">02</span> Type the product and press Enter to shoot it.
                </div>
                <div className="flex gap-2 rounded-lg bg-black/20 px-3 py-2">
                  <span className="text-[#5EDAD0] shrink-0">03</span> 3 objects reaching the floor or 3 wrong answers ends the mission.
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
