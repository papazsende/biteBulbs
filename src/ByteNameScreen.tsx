import React from "react";
import logoUrl from "./assets/logo.png";

type NameRow = {
  char: string;
  target: number;        // decimal (8-bit)
  bits: number[];        // length 8
  locked: boolean;
  result: "idle" | "correct" | "wrong";
};

function weightArray(msbLeft: boolean) {
  const base = [128, 64, 32, 16, 8, 4, 2, 1];
  return msbLeft ? base : [...base].reverse();
}
function valueFromBits(bits: number[], msbLeft: boolean) {
  const w = weightArray(msbLeft);
  return bits.reduce((s, b, i) => s + (b ? w[i] : 0), 0);
}
function byteOfChar(ch: string) {
  // Clamp to 8-bit for teaching; non-ASCII becomes code & 255
  return (ch.charCodeAt(0) & 0xff) >>> 0;
}
function bin8(n: number) {
  return n.toString(2).padStart(8, "0");
}

export function ByteNameScreen({ onExit }: { onExit: () => void }) {
  const [msbLeft, setMsbLeft] = React.useState(true);
  const [text, setText] = React.useState("");
  const [rows, setRows] = React.useState<NameRow[]>([]);

  const correctCount = React.useMemo(
    () => rows.filter(r => r.result === "correct").length,
    [rows]
  );

  function buildRows(input: string) {
    const arr: NameRow[] = input.split("").map(ch => ({
      char: ch,
      target: byteOfChar(ch),
      bits: Array(8).fill(0),
      locked: false,
      result: "idle",
    }));
    setRows(arr);
  }

  function toggleBit(rowIdx: number, bitIdx: number) {
    setRows(prev => {
      const copy = [...prev];
      if (copy[rowIdx]?.locked) return prev;
      const r = { ...copy[rowIdx] };
      const nb = [...r.bits];
      nb[bitIdx] = nb[bitIdx] ? 0 : 1;
      r.bits = nb;
      copy[rowIdx] = r;
      return copy;
    });
  }

  function checkRow(rowIdx: number) {
    setRows(prev => {
      const copy = [...prev];
      const r = { ...copy[rowIdx] };
      const val = valueFromBits(r.bits, msbLeft);
      r.result = val === r.target ? "correct" : "wrong";
      r.locked = val === r.target;
      copy[rowIdx] = r;
      return copy;
    });
  }

  function checkAll() {
    setRows(prev =>
      prev.map(r => {
        const val = valueFromBits(r.bits, msbLeft);
        const good = val === r.target;
        return { ...r, result: good ? "correct" : "wrong", locked: good || r.locked };
      })
    );
  }

  function resetAll() {
    setRows(prev => prev.map(r => ({ ...r, bits: Array(8).fill(0), locked: false, result: "idle" })));
  }

  const weights = weightArray(msbLeft);

  return (
    <div className="min-h-screen w-full bg-[#0c0f13] text-gray-100 p-6 sm:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="BiteBulbs logo" className="h-12 sm:h-16 w-auto object-contain shrink-0" />
            <div className="text-xl sm:text-2xl font-semibold">ByteName</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-300">Progress: <span className="font-semibold">{correctCount}</span> / {rows.length || 0}</div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={msbLeft}
                onChange={(e) => setMsbLeft(e.target.checked)}
              />
              MSB on left
            </label>
            <button onClick={onExit} className="px-3 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-[#1a1f26]">Menu</button>
          </div>
        </div>

        {/* Input bar */}
        <div className="mb-5 p-4 rounded-xl border border-gray-700 bg-[#11151a]">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a name or sentence (ASCII recommended)"
              className="flex-1 px-3 py-2 rounded-lg bg-[#0f0f12] border border-gray-700 text-gray-100 placeholder-gray-500"
            />
            <div className="flex gap-2">
              <button onClick={() => buildRows(text || "Hi!")} className="px-4 py-2 rounded-lg border border-emerald-500 text-emerald-200 bg-[#0f1512] hover:bg-[#131b16]">Create</button>
              <button onClick={() => { setText(""); setRows([]); }} className="px-4 py-2 rounded-lg border border-gray-700 text-gray-300">Clear</button>
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Note: Non-ASCII characters are masked to 8-bit (code & 255) for teaching purposes.
          </div>
        </div>

        {/* Rows */}
        {rows.length === 0 ? (
          <div className="text-gray-400 text-sm">Enter text above and press <span className="text-gray-200">Create</span> to start.</div>
        ) : (
          <>
            <div className="space-y-4">
              {rows.map((row, rIdx) => (
                <div key={rIdx} className={`grid grid-cols-1 md:grid-cols-2 gap-4 p-3 rounded-xl border ${row.result === "wrong" ? "border-red-600/60 bg-[#1a0f10]" : "border-gray-700 bg-[#11151a]"}`}>
                  {/* Left: 8 bulbs */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="grid grid-cols-8 gap-3 select-none">
                      {row.bits.map((bit, i) => (
                        <button
                          key={i}
                          onClick={() => toggleBit(rIdx, i)}
                          disabled={row.locked}
                          className="group focus:outline-none"
                          aria-label={`Row ${rIdx + 1}, Bulb ${i + 1} ${bit ? "on" : "off"}`}
                        >
                          <div className="relative h-12 w-12 sm:h-16 sm:w-16">
                            {/* halo */}
                            <div
                              className={`absolute -inset-3 rounded-full blur-2xl transition-opacity ${
                                bit ? "opacity-30" : "opacity-0"
                              }`}
                              style={{
                                background:
                                  "radial-gradient(circle, rgba(255,200,120,0.35) 0%, rgba(255,180,90,0.15) 40%, rgba(0,0,0,0) 70%)",
                              }}
                            />
                            {/* glass */}
                            <div className="relative h-full w-full rounded-full overflow-visible">
                              <div
                                className={`absolute inset-0 rounded-full border ${
                                  bit ? "border-amber-300" : "border-gray-600"
                                }`}
                                style={{
                                  background: bit
                                    ? "radial-gradient(closest-side, rgba(255,225,150,0.6), rgba(255,210,120,0.15) 60%, rgba(0,0,0,0) 70%)"
                                    : "radial-gradient(closest-side, rgba(200,200,200,0.12), rgba(60,60,60,0.08) 60%, rgba(0,0,0,0) 70%)",
                                }}
                              />
                              {/* filament */}
                              <svg viewBox="0 0 100 100" className="absolute inset-0">
                                <line x1="35" y1="65" x2="35" y2="45" stroke={bit ? "#f5b45a" : "#555"} strokeWidth="3" />
                                <line x1="65" y1="65" x2="65" y2="45" stroke={bit ? "#f5b45a" : "#555"} strokeWidth="3" />
                                <polyline points="35,45 40,50 45,45 50,50 55,45 60,50 65,45" fill="none" stroke={bit ? "#ffd27a" : "#333"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                {bit && (
                                  <polyline points="35,45 40,50 45,45 50,50 55,45 60,50 65,45" fill="none" stroke="#ffdd9c" strokeOpacity="0.6" strokeWidth="8" />
                                )}
                                <rect x="48" y="60" width="4" height="10" fill={bit ? "#f1c27a" : "#666"} />
                              </svg>
                              {/* sheen */}
                              <div className="absolute -top-1 left-2 right-2 h-5 rounded-full opacity-30"
                                   style={{ background:"linear-gradient(180deg, rgba(255,255,255,0.6), rgba(255,255,255,0))" }} />
                              {/* weight tag */}
                              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-md bg-[#0c0f13] border border-gray-700 text-[10px] text-gray-300 font-mono pointer-events-none">
                                {weightArray(true)[i] /* always display 128..1 left->right label */}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Right: character info + check */}
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-gray-400">Character</div>
                      <div className="mt-0.5 text-3xl font-semibold">
                        {row.char === " " ? <span className="text-gray-300">␠ Space</span> : row.char}
                      </div>
                      <div className="mt-2 text-xs uppercase tracking-wide text-gray-400">Target (DEC)</div>
                      <div className="text-xl font-mono">{row.target}</div>
                      <div className="mt-2 text-xs uppercase tracking-wide text-gray-400">Your binary</div>
                      <div className="font-mono text-lg">{bin8(valueFromBits(row.bits, true)) /* display as MSB-left */}</div>
                      {row.result === "wrong" && (
                        <div className="mt-2 text-sm text-red-300">
                          Correct: <span className="font-mono">{bin8(row.target)}</span> ({row.target})
                        </div>
                      )}
                      {row.result === "correct" && (
                        <div className="mt-2 text-sm text-emerald-300">✅ Correct</div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => checkRow(rIdx)}
                        className="px-4 py-2 rounded-lg border border-blue-400 text-blue-200 bg-[#0f131a] hover:bg-[#101720]"
                      >
                        Check
                      </button>
                      <button
                        onClick={() =>
                          setRows(prev => {
                            const copy = [...prev];
                            copy[rIdx] = { ...copy[rIdx], bits: Array(8).fill(0), result: "idle", locked: false };
                            return copy;
                          })
                        }
                        className="px-4 py-2 rounded-lg border border-gray-700 text-gray-300"
                      >
                        Reset Row
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bulk actions */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={checkAll} className="px-4 py-2 rounded-xl border border-purple-400 text-purple-200 bg-[#120f1a] hover:bg-[#170f22]">Check All</button>
              <button onClick={resetAll} className="px-4 py-2 rounded-xl border border-gray-700 text-gray-300">Reset All</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
