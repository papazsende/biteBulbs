import React, { useEffect, useMemo, useState } from "react";
import logoUrl from "./assets/logo.png"; // ensure this exists
import { ByteNameScreen } from './ByteNameScreen';
import RGBitScreen from './RGBitScreen';

// BiteBulbs by Barış Çetin — Minimal Edition + Quiz + Local Leaderboard
// Now with Home/Menu screens & routing (no external router needed).

// ----- Quiz configuration -----
const QUESTIONS_TOTAL = 5; // questions per round
const SECONDS_PER_Q = 15; // time limit per question

// Types
type Q = { id: string; target: number; label: string; kind: "DEC" | "ASCII" };
type Entry = {
  name: string;
  email?: string;
  score: number;
  total: number;
  timestamp: number; // ms since epoch
  durationSec: number;
};

const LS_KEY = "bitebulbs_leaderboard_v1";

// ----- Utilities -----
function buildQuestionBank(): Q[] {
  const decs = [
    5, 10, 13, 17, 21, 31, 32, 42, 64, 65, 73, 85, 97, 100, 113, 127, 128, 150,
    170, 200,
  ];
  const asciiPick = [
    "A",
    "C",
    "E",
    "H",
    "I",
    "J",
    "K",
    "L",
    "N",
    "O",
    "R",
    "S",
    "T",
    "Z",
    "a",
    "e",
    "i",
    "o",
    "u",
    "0",
    "1",
    "2",
    "5",
    "8",
    "?",
  ];
  const bank: Q[] = [];
  decs.slice(0, 12).forEach((n, i) =>
    bank.push({ id: `D${i}-${n}`, target: n, label: `DEC ${n}`, kind: "DEC" })
  );
  asciiPick.slice(0, 8).forEach((ch, i) =>
    bank.push({
      id: `A${i}-${ch}`,
      target: ch.charCodeAt(0),
      label: `ASCII '${ch}'`,
      kind: "ASCII",
    })
  );
  while (bank.length < 20) {
    const pool =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789?! ";
    const ch = pool[Math.floor(Math.random() * pool.length)];
    bank.push({
      id: `R-${bank.length}-${ch}`,
      target: ch.charCodeAt(0),
      label: `ASCII '${ch}'`,
      kind: "ASCII",
    });
  }
  return bank.slice(0, 20);
}

function pickQuiz(count = QUESTIONS_TOTAL) {
  const pool = buildQuestionBank();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function loadLeaderboard(): Entry[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr as Entry[];
  } catch { }
  return [];
}

function saveLeaderboard(entries: Entry[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(entries));
  } catch { }
}

function toCSV(rows: Entry[]): string {
  const header = [
    "Name",
    "Email",
    "Score",
    "Total",
    "Percent",
    "Timestamp",
    "Date",
    "Duration(s)",
  ].join(",");
  const lines = rows.map((r) => {
    const dt = new Date(r.timestamp);
    const pct = ((r.score / r.total) * 100).toFixed(0) + "%";
    const dateStr = dt.toISOString();
    const esc = (s?: string) =>
      s == null ? "" : String(s).replaceAll('"', '""');
    return [
      `"${esc(r.name)}"`,
      `"${esc(r.email || "")}"`,
      r.score,
      r.total,
      pct,
      r.timestamp,
      `"${dateStr}"`,
      r.durationSec,
    ].join(",");
  });
  return [header, ...lines].join("\n");
}

// ==============================
// ByteBulbs main screen (module)
// ==============================
function ByteBulbsScreen({ onExit }: { onExit: () => void }) {
  const [bits, setBits] = useState<number[]>(Array(8).fill(0));
  const [msbLeft, setMsbLeft] = useState(true);

  // Quiz state
  const [quizOn, setQuizOn] = useState(false);
  const [questions, setQuestions] = useState<ReturnType<typeof pickQuiz>>([]);
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_Q);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [quizStart, setQuizStart] = useState<number | null>(null);

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<Entry[]>(loadLeaderboard());
  const [showLogForm, setShowLogForm] = useState(false);
  const [logName, setLogName] = useState("");
  const [logEmail, setLogEmail] = useState("");

  const weights = useMemo(() => {
    const base = [128, 64, 32, 16, 8, 4, 2, 1];
    return msbLeft ? base : [...base].reverse();
  }, [msbLeft]);

  const valueUnsigned = useMemo(
    () => bits.reduce((sum, b, i) => sum + b * weights[i], 0),
    [bits, weights]
  );
  const binaryStr = useMemo(
    () => valueUnsigned.toString(2).padStart(8, "0"),
    [valueUnsigned]
  );

  function setFromValue(v: number) {
    const clamped = ((v % 256) + 256) % 256;
    const newBits: number[] = [];
    let rem = clamped;
    const actualWeights = msbLeft
      ? [128, 64, 32, 16, 8, 4, 2, 1]
      : [1, 2, 4, 8, 16, 32, 64, 128];
    for (let w of actualWeights) {
      const bit = rem >= w ? 1 : 0;
      newBits.push(bit);
      if (bit === 1) rem -= w;
    }
    setBits(newBits);
  }

  function toggleBit(i: number) {
    if (locked) return;
    setBits((prev) => {
      const next = [...prev];
      next[i] = prev[i] ? 0 : 1;
      return next;
    });
  }

  function clearAll() {
    if (!locked) setBits(Array(8).fill(0));
  }
  function randomize() {
    if (!locked) setFromValue(Math.floor(Math.random() * 256));
  }

  // Quiz timer
  useEffect(() => {
    if (!quizOn || locked) return;
    if (timeLeft <= 0) {
      handleCheck(true);
      return;
    }
    const t = setTimeout(() => setTimeLeft((tl) => tl - 1), 1000);
    return () => clearTimeout(t);
  }, [quizOn, locked, timeLeft]);

  function startQuiz() {
    setQuestions(pickQuiz());
    setQIndex(0);
    setScore(0);
    setTimeLeft(SECONDS_PER_Q);
    setFeedback(null);
    setQuizOn(true);
    setLocked(false);
    setQuizStart(Date.now());
    setShowLogForm(false);
    clearAll();
  }

  function endQuizDisplayScore() {
    setQuizOn(false);
    setLocked(false);
    setFeedback(`Quiz complete. Score: ${score}/${QUESTIONS_TOTAL}`);
  }

  function nextQuestion() {
    const next = qIndex + 1;
    if (next >= QUESTIONS_TOTAL) {
      endQuizDisplayScore();
      return;
    }
    setQIndex(next);
    setTimeLeft(SECONDS_PER_Q);
    setFeedback(null);
    setLocked(false);
    clearAll();
  }

  function handleCheck(timeExpired = false) {
    if (locked) return;
    const target = questions[qIndex]?.target ?? 0;
    const correct = valueUnsigned === target;
    if (correct && !timeExpired) setScore((s) => s + 1);
    const msg = correct
      ? `✅ Correct! (${binary(target)} = ${target})`
      : timeExpired
        ? `⏰ Time! Answer: ${binary(target)} (${target})`
        : `❌ Not quite. Answer: ${binary(target)} (${target})`;
    setFeedback(msg);
    setLocked(true);
  }

  function binary(v: number) {
    return v.toString(2).padStart(8, "0");
  }

  // ----- Leaderboard logging -----
  function openLogForm() {
    setShowLogForm(true);
  }
  function cancelLog() {
    setShowLogForm(false);
  }

  function confirmLog() {
    if (!logName.trim()) return; // require a name
    const now = Date.now();
    const durationSec = quizStart
      ? Math.max(1, Math.round((now - quizStart) / 1000))
      : QUESTIONS_TOTAL * SECONDS_PER_Q;
    const entry: Entry = {
      name: logName.trim(),
      email: logEmail.trim() || undefined,
      score,
      total: QUESTIONS_TOTAL,
      timestamp: now,
      durationSec,
    };
    const next = [entry, ...leaderboard].slice(0, 200); // keep most recent 200
    setLeaderboard(next);
    saveLeaderboard(next);
    setShowLogForm(false);
    setLogName("");
    setLogEmail("");
  }

  function clearLeaderboard() {
    if (confirm("Clear all leaderboard entries on this device?")) {
      setLeaderboard([]);
      saveLeaderboard([]);
    }
  }

  function exportCSV() {
    const csv = toCSV(leaderboard);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bitebulbs_leaderboard.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const currentQ = quizOn ? questions[qIndex] : null;

  return (
    <div className="min-h-screen w-full bg-[#0c0f13] text-gray-100 p-6 sm:p-10">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <img
              src={logoUrl}
              alt="BiteBulbs logo"
              className="h-12 sm:h-16 w-auto object-contain shrink-0"
            />
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={onExit}
              className="px-3 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-[#1a1f26]"
            >
              Menu
            </button>
            <div className="text-sm text-gray-300">
              Score: <span className="font-semibold">{score}</span>
              {quizOn ? ` / ${QUESTIONS_TOTAL}` : ""}
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={msbLeft}
                onChange={(e) => {
                  const prev = valueUnsigned;
                  setMsbLeft(e.target.checked);
                  setTimeout(() => setFromValue(prev), 0);
                }}
              />
              MSB on left
            </label>
          </div>
        </div>

        {/* Quiz banner */}
        {quizOn && currentQ && (
          <div className="mb-4 p-4 rounded-xl border border-gray-700 bg-[#11151a] flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-400">
                Question {qIndex + 1} / {QUESTIONS_TOTAL}
              </div>
              <div className="mt-1 text-lg font-semibold">
                {currentQ.kind === "DEC" ? (
                  <>
                    Set bulbs to show{" "}
                    <span className="text-emerald-400">{currentQ.label}</span>
                  </>
                ) : (
                  <>
                    Set bulbs to show{" "}
                    <span className="text-amber-300">{currentQ.label}</span>{" "}
                    <span className="text-gray-400">
                      (DEC {currentQ.target})
                    </span>
                  </>
                )}
              </div>
            </div>
            <div
              className={`text-center px-3 py-2 rounded-lg border ${timeLeft <= 5
                ? "border-red-500 text-red-400"
                : "border-gray-600 text-gray-300"
                }`}
            >
              ⏱ {timeLeft}s
            </div>
          </div>
        )}

        {/* Bulbs */}
        <div className="grid grid-cols-8 gap-4 sm:gap-5 mb-6 select-none">
          {bits.map((b, i) => (
            <button
              key={i}
              onClick={() => toggleBit(i)}
              className="group focus:outline-none"
              aria-label={`Bulb ${i + 1} ${b ? "on" : "off"}`}
            >
              <div className="relative h-16 w-16 sm:h-20 sm:w-20">
                {/* Outer halo */}
                <div
                  className={`absolute -inset-4 rounded-full blur-2xl transition-opacity ${b ? "opacity-30" : "opacity-0"
                    }`}
                  style={{
                    background:
                      "radial-gradient(circle, rgba(255,200,120,0.35) 0%, rgba(255,180,90,0.15) 40%, rgba(0,0,0,0) 70%)",
                  }}
                />

                {/* Glass body */}
                <div className="relative h-full w-full rounded-full overflow-visible">
                  <div
                    className={`absolute inset-0 rounded-full border ${b ? "border-amber-300" : "border-gray-600"
                      }`}
                    style={{
                      background: b
                        ? "radial-gradient(closest-side, rgba(255,225,150,0.6), rgba(255,210,120,0.15) 60%, rgba(0,0,0,0) 70%)"
                        : "radial-gradient(closest-side, rgba(200,200,200,0.12), rgba(60,60,60,0.08) 60%, rgba(0,0,0,0) 70%)",
                    }}
                  />

                  {/* Edison filament */}
                  <svg viewBox="0 0 100 100" className="absolute inset-0">
                    <line
                      x1="35"
                      y1="65"
                      x2="35"
                      y2="45"
                      stroke={b ? "#f5b45a" : "#555"}
                      strokeWidth="3"
                    />
                    <line
                      x1="65"
                      y1="65"
                      x2="65"
                      y2="45"
                      stroke={b ? "#f5b45a" : "#555"}
                      strokeWidth="3"
                    />
                    <polyline
                      points="35,45 40,50 45,45 50,50 55,45 60,50 65,45"
                      fill="none"
                      stroke={b ? "#ffd27a" : "#333"}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {b && (
                      <polyline
                        points="35,45 40,50 45,45 50,50 55,45 60,50 65,45"
                        fill="none"
                        stroke="#ffdd9c"
                        strokeOpacity="0.6"
                        strokeWidth="8"
                      />
                    )}
                    <rect
                      x="48"
                      y="60"
                      width="4"
                      height="10"
                      fill={b ? "#f1c27a" : "#666"}
                    />
                  </svg>

                  {/* Sheen */}
                  <div
                    className="absolute -top-1 left-2 right-2 h-6 rounded-full opacity-30"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0.6), rgba(255,255,255,0))",
                    }}
                  />

                  {/* Weight tag (inside bulb, avoids overlap on mobile) */}
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-[#0f131a] border border-gray-700 text-[10px] sm:text-xs text-gray-300 font-mono pointer-events-none">
                    {msbLeft
                      ? [128, 64, 32, 16, 8, 4, 2, 1][i]
                      : [1, 2, 4, 8, 16, 32, 64, 128][i]}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Switches */}
        <div className="grid grid-cols-8 gap-4 sm:gap-5 mb-6">
          {bits.map((b, i) => (
            <button
              key={i}
              onClick={() => toggleBit(i)}
              className={`h-8 sm:h-10 rounded-lg border text-sm font-semibold transition-colors ${b
                ? "bg-emerald-500/90 border-emerald-400 text-white"
                : "bg-[#12161b] border-gray-700 text-gray-300"
                }`}
            >
              {b ? "1" : "0"}
            </button>
          ))}
        </div>

        {/* Readouts */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {/* Decimal Value */}
          <div className="p-4 rounded-xl border border-gray-700 bg-[#11151a]">
            <div className="text-xs uppercase tracking-wide text-gray-400">
              Decimal
            </div>
            <div className="mt-1 text-3xl sm:text-4xl font-bold text-gray-100">
              {valueUnsigned}
            </div>
          </div>

          {/* ASCII Letter */}
          <div className="p-4 rounded-xl border border-gray-700 bg-[#11151a]">
            <div className="text-xs uppercase tracking-wide text-gray-400">
              ASCII
            </div>
            <div className="mt-1 text-3xl sm:text-4xl font-bold text-gray-100">
              {String.fromCharCode(valueUnsigned)}
            </div>
          </div>

          {/* Binary Value */}
          <div className="p-4 rounded-xl border border-gray-700 bg-[#11151a]">
            <div className="text-xs uppercase tracking-wide text-gray-400">
              Binary
            </div>
            <div className="mt-1 font-mono text-2xl sm:text-3xl font-bold text-gray-100">
              {binaryStr}
            </div>
          </div>
        </div>

        {/* Controls & Quiz */}
        <div className="mt-2 flex flex-wrap gap-2 items-center">
          <button
            onClick={clearAll}
            disabled={locked}
            className={`px-4 py-2 rounded-xl border ${locked ? "opacity-50 cursor-not-allowed" : ""
              } border-gray-700 bg-[#12161b] text-gray-200 hover:bg-[#1a1f26]`}
          >
            Clear
          </button>
          <button
            onClick={() => setFromValue(0b10101010)}
            disabled={locked}
            className={`px-4 py-2 rounded-xl border ${locked ? "opacity-50 cursor-not-allowed" : ""
              } border-gray-700 bg-[#12161b] text-gray-200 hover:bg-[#1a1f26]`}
          >
            10101010
          </button>
          <button
            onClick={() => setFromValue(0b01010101)}
            disabled={locked}
            className={`px-4 py-2 rounded-xl border ${locked ? "opacity-50 cursor-not-allowed" : ""
              } border-gray-700 bg-[#12161b] text-gray-200 hover:bg-[#1a1f26]`}
          >
            01010101
          </button>
          <button
            onClick={randomize}
            disabled={locked}
            className={`px-4 py-2 rounded-xl border ${locked ? "opacity-50 cursor-not-allowed" : ""
              } border-gray-700 bg-[#12161b] text-gray-200 hover:bg-[#1a1f26]`}
          >
            Random
          </button>

          <div className="mx-2 h-6 w-px bg-gray-700" />

          {!quizOn && (
            <button className="px-4 py-2 rounded-xl border border-emerald-500 text-emerald-200 bg-[#0f1512] hover:bg-[#131b16]" onClick={startQuiz}>
              Start Quiz
            </button>
          )}
          {quizOn && (
            <>
              <button
                onClick={() => handleCheck(false)}
                disabled={locked}
                className={`px-4 py-2 rounded-xl border ${locked
                  ? "opacity-50 cursor-not-allowed"
                  : "border-blue-400 text-blue-200 bg-[#0f131a] hover:bg-[#101720]"
                  }`}
              >
                Check
              </button>
              <button
                onClick={nextQuestion}
                disabled={!locked}
                className={`px-4 py-2 rounded-xl border ${!locked
                  ? "opacity-50 cursor-not-allowed"
                  : "border-purple-400 text-purple-200 bg-[#120f1a] hover:bg-[#170f22]"
                  }`}
              >
                Next
              </button>
              <button
                onClick={() => {
                  endQuizDisplayScore();
                }}
                className="px-3 py-2 rounded-xl border border-gray-700 bg-[#12161b] text-gray-300 hover:bg-[#1a1f26]"
              >
                End
              </button>
            </>
          )}
        </div>

        {feedback && (
          <div className="mt-4 p-3 rounded-xl border border-gray-700 bg-[#11151a] text-sm flex items-center justify-between">
            <div>{feedback}</div>
            {/* After quiz end, allow logging */}
            {!quizOn && (
              <button
                onClick={openLogForm}
                className="ml-4 px-3 py-2 rounded-lg border border-amber-400 text-amber-200 bg-[#1b1510] hover:bg-[#221a12]"
              >
                Log my result
              </button>
            )}
          </div>
        )}

        {/* Log form (inline) */}
        {showLogForm && (
          <div className="mt-3 p-4 rounded-xl border border-amber-400 bg-[#1b1510]">
            <div className="text-sm mb-2">
              Save to leaderboard on <span className="font-semibold">this device</span>:
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={logName}
                onChange={(e) => setLogName(e.target.value)}
                placeholder="Name (required)"
                className="flex-1 px-3 py-2 rounded-lg bg-[#0f0f12] border border-gray-700 text-gray-100 placeholder-gray-500"
              />
              <input
                value={logEmail}
                onChange={(e) => setLogEmail(e.target.value)}
                placeholder="Email (optional)"
                className="flex-1 px-3 py-2 rounded-lg bg-[#0f0f12] border border-gray-700 text-gray-100 placeholder-gray-500"
              />
              <button
                onClick={confirmLog}
                className="px-4 py-2 rounded-lg border border-emerald-500 text-emerald-200 bg-[#0f1512] hover:bg-[#131b16]"
              >
                Save
              </button>
              <button
                onClick={cancelLog}
                className="px-3 py-2 rounded-lg border border-gray-700 text-gray-300"
              >
                Cancel
              </button>
            </div>
            <div className="text-xs text-gray-400 mt-2">
              Saved locally via your browser (no internet/database). You can export CSV below.
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <section className="mt-8 p-4 rounded-xl border border-gray-700 bg-[#11151a]">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Leaderboard (this device)</h2>
            <div className="flex gap-2">
              <button
                onClick={exportCSV}
                className="px-3 py-2 rounded-lg border border-gray-600 text-gray-200"
              >
                Export CSV
              </button>
              <button
                onClick={clearLeaderboard}
                className="px-3 py-2 rounded-lg border border-red-500 text-red-300"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400">
                  <th className="text-left py-2 pr-3">#</th>
                  <th className="text-left py-2 pr-3">Name</th>
                  <th className="text-left py-2 pr-3">Email</th>
                  <th className="text-left py-2 pr-3">Score</th>
                  <th className="text-left py-2 pr-3">Percent</th>
                  <th className="text-left py-2 pr-3">Time</th>
                  <th className="text-left py-2 pr-3">Duration</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-3 text-gray-500">
                      No entries yet. Finish a quiz and log your result.
                    </td>
                  </tr>
                )}
                {leaderboard.map((e, idx) => (
                  <tr key={e.timestamp + "-" + idx} className="border-t border-gray-800">
                    <td className="py-2 pr-3 text-gray-400">{idx + 1}</td>
                    <td className="py-2 pr-3">{e.name}</td>
                    <td className="py-2 pr-3 text-gray-400">{e.email || "—"}</td>
                    <td className="py-2 pr-3">
                      {e.score}/{e.total}
                    </td>
                    <td className="py-2 pr-3">
                      {Math.round((e.score / e.total) * 100)}%
                    </td>
                    <td className="py-2 pr-3 text-gray-400">
                      {new Date(e.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-gray-400">{e.durationSec}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Note: This leaderboard is stored in the browser's local storage on this device only.
          </div>
        </section>

        {!quizOn && !feedback && (
          <footer className="mt-8 text-xs text-gray-500">
            Tip: Try alternating patterns and discuss MSB/LSB. Works offline as a single web page.
          </footer>
        )}
      </div>
    </div>
  );
}

// ==============================
// Simple in-app “router”
// ==============================
export default function App() {
  const [screen, setScreen] = React.useState<
    "home" | "menu" | "bitwise" | "rgbit" | "bytename"
  >("home");


  if (screen === "home") {
    return (
      <div className="min-h-screen w-full bg-[#0c0f13] text-gray-100 p-6 sm:p-10 flex items-center justify-center">
        <div className="max-w-3xl w-full text-center">
          <img
            src={logoUrl}
            alt="BiteBulbs logo"
            className="h-24 sm:h-32 w-auto object-contain mx-auto mb-6"
          />
          <button
            onClick={() => setScreen("menu")}
            className="px-6 py-3 rounded-2xl border border-emerald-500 text-emerald-200 bg-[#0f1512] hover:bg-[#131b16] text-lg font-semibold"
          >
            Start
          </button>
          <p className="mt-3 text-gray-400 text-sm">BiteBulbs by Barış Çetin</p>
        </div>
      </div>
    );
  }

  if (screen === "menu") {
    return (
      <div className="min-h-screen w-full bg-[#0c0f13] text-gray-100 p-6 sm:p-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <img
              src={logoUrl}
              alt="BiteBulbs logo"
              className="h-16 w-auto object-contain"
            />
            <h2 className="text-2xl font-semibold text-gray-100">
              Choose a module
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* BitWise Trainer (our bulbs module) */}
            <button
              onClick={() => setScreen("bitwise")}
              className="p-6 rounded-2xl border border-emerald-500/60 bg-[#10161b] hover:bg-[#121b22] text-left"
            >
              <div className="text-lg font-semibold">BitWise Trainer</div>
              <div className="mt-1 text-sm text-gray-400">
                8-bit bulbs, quiz & local leaderboard
              </div>
            </button>

            {/* RGBit (placeholder) */}
            <button
              onClick={() => setScreen("rgbit")}
              className="p-6 rounded-2xl border border-gray-700 bg-[#101318] hover:bg-[#12161b] text-left"
            >
              <div className="text-lg font-semibold">RGBit</div>
              <div className="mt-1 text-sm text-gray-400">
                RGB channels (8-bit each) → color mix
              </div>
            </button>

            {/* ByteName (placeholder) */}
            <button
              onClick={() => setScreen("bytename")}
              className="p-6 rounded-2xl border border-gray-700 bg-[#101318] hover:bg-[#12161b] text-left"
            >
              <div className="text-lg font-semibold">ByteName</div>
              <div className="mt-1 text-sm text-gray-400">
                Type a name → ASCII & bytes
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }


  if (screen === "bitwise") {
    return <ByteBulbsScreen onExit={() => setScreen("menu")} />;
  }

  // RGBit placeholder
  if (screen === "rgbit") {
    return <RGBitScreen onExit={() => setScreen("menu")} />;
  }

  // ByteName placeholder
  if (screen === "bytename") {
    return <ByteNameScreen onExit={() => setScreen("menu")} />;

  }


  // coming soon placeholders
  return (
    <div className="min-h-screen w-full bg-[#0c0f13] text-gray-100 p-6 sm:p-10 flex items-center justify-center">
      <div className="max-w-xl text-center">
        <img
          src={logoUrl}
          alt="BiteBulbs logo"
          className="h-20 w-auto object-contain mx-auto mb-6"
        />
        <h2 className="text-2xl font-semibold mb-2">Coming soon</h2>
        <p className="text-gray-400 mb-6">
          We’re building more modules. For now, try Binary Bulbs.
        </p>
        <button
          onClick={() => setScreen("menu")}
          className="px-5 py-2.5 rounded-xl border border-gray-700 text-gray-200 hover:bg-[#1a1f26]"
        >
          Back to menu
        </button>
      </div>
    </div>
  );
}
