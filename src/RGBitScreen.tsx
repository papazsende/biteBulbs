import React from "react";
import logoUrl from "./assets/logo.png";

type Row = {
  channel: "R" | "G" | "B";
  target: number;        // 0..255
  bits: number[];        // length 8
  locked: boolean;
  result: "idle" | "correct" | "wrong";
};

function clamp255(n: number) {
  return Math.max(0, Math.min(255, n | 0));
}
function weightArray(msbLeft: boolean) {
  const base = [128, 64, 32, 16, 8, 4, 2, 1];
  return msbLeft ? base : [...base].reverse();
}
function valueFromBits(bits: number[], msbLeft: boolean) {
  const w = weightArray(msbLeft);
  return bits.reduce((s, b, i) => s + (b ? w[i] : 0), 0);
}
function hex2(n: number) {
  return clamp255(n).toString(16).toUpperCase().padStart(2, "0");
}
function parseHex(input: string): [number, number, number] | null {
  let s = input.trim().replace(/^#|^0x/i, "");
  if (s.length === 3) {
    // #RGB -> #RRGGBB
    s = s.split("").map(c => c + c).join("");
  }
  if (!/^[0-9a-f]{6}$/i.test(s)) return null;
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  return [r, g, b];
}
function randomRGB(): [number, number, number] {
  return [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)];
}
function bin8(n: number) {
  return clamp255(n).toString(2).padStart(8, "0");
}

export default function RGBitScreen({ onExit }: { onExit: () => void }) {
  const [msbLeft, setMsbLeft] = React.useState(true);

  // targets
  const [[rT, gT, bT], setTarget] = React.useState<[number, number, number]>(randomRGB);

  // rows: one per channel
  const [rows, setRows] = React.useState<Row[]>([
    { channel: "R", target: rT, bits: Array(8).fill(0), locked: false, result: "idle" },
    { channel: "G", target: gT, bits: Array(8).fill(0), locked: false, result: "idle" },
    { channel: "B", target: bT, bits: Array(8).fill(0), locked: false, result: "idle" },
  ]);

  // keep rows' targets in sync if target changes
  React.useEffect(() => {
    setRows(prev => prev.map(r => ({ ...r, target: r.channel === "R" ? rT : r.channel === "G" ? gT : bT })));
  }, [rT, gT, bT]);

  // your current values from bits
  const yourVals = React.useMemo(() => {
    const r = valueFromBits(rows[0].bits, msbLeft);
    const g = valueFromBits(rows[1].bits, msbLeft);
    const b = valueFromBits(rows[2].bits, msbLeft);
    return [r, g, b] as [number, number, number];
  }, [rows, msbLeft]);

  const correctCount = rows.filter(r => r.result === "correct").length;

  function newTargetRGB(rgb?: [number, number, number]) {
    const [R, G, B] = rgb ?? randomRGB();
    setTarget([clamp255(R), clamp255(G), clamp255(B)]);
    // reset rows (keep lock=false)
    setRows(prev => prev.map(r => ({ ...r, bits: Array(8).fill(0), locked: false, result: "idle" })));
  }

  function applyHex(s: string) {
    const parsed = parseHex(s);
    if (parsed) newTargetRGB(parsed);
  }

  function applyDec(R: number, G: number, B: number) {
    newTargetRGB([clamp255(R), clamp255(G), clamp255(B)]);
  }

  function toggleBit(rowIdx: number, bitIdx: number) {
    setRows(prev => {
      const copy = [...prev];
      const r = { ...copy[rowIdx] };
      if (r.locked) return prev;
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
      const ok = val === r.target;
      r.result = ok ? "correct" : "wrong";
      r.locked = ok;
      copy[rowIdx] = r;
      return copy;
    });
  }

  function resetRow(rowIdx: number) {
    setRows(prev => {
      const copy = [...prev];
      const r = { ...copy[rowIdx], bits: Array(8).fill(0), locked: false, result: "idle" };
      copy[rowIdx] = r;
      return copy;
    });
  }

  function checkAll() {
    setRows(prev =>
      prev.map(r => {
        const val = valueFromBits(r.bits, msbLeft);
        const ok = val === r.target;
        return { ...r, result: ok ? "correct" : "wrong", locked: ok || r.locked };
      })
    );
  }

  function resetAll() {
    setRows(prev => prev.map(r => ({ ...r, bits: Array(8).fill(0), locked: false, result: "idle" })));
  }

  const [hexInput, setHexInput] = React.useState("");
  const [rIn, setRIn] = React.useState(rT);
  const [gIn, setGIn] = React.useState(gT);
  const [bIn, setBIn] = React.useState(bT);

  // keep decimal inputs synced to target
  React.useEffect(() => {
    setRIn(rT); setGIn(gT); setBIn(bT);
  }, [rT, gT, bT]);

  const weights = weightArray(true); // show labels as 128..1 left→right for teaching stability

  const [rY, gY, bY] = yourVals;
  const hexTarget = `#${hex2(rT)}${hex2(gT)}${hex2(bT)}`;
  const hexYours  = `#${hex2(rY)}${hex2(gY)}${hex2(bY)}`;

  return (
    <div className="min-h-screen w-full bg-[#0c0f13] text-gray-100 p-6 sm:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="BiteBulbs logo" className="h-12 sm:h-16 w-auto object-contain shrink-0" />
            <div className="text-xl sm:text-2xl font-semibold">RGBit</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-300">
              Progress: <span className="font-semibold">{correctCount}</span> / 3
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={msbLeft}
                onChange={(e) => {/* evaluation toggle only */ (void e); setMsbLeft(e.target.checked); }}
              />
              MSB on left
            </label>
            <button onClick={onExit} className="px-3 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-[#1a1f26]">Menu</button>
          </div>
        </div>

        {/* Controls: target setters */}
        <div className="mb-5 p-4 rounded-xl border border-gray-700 bg-[#11151a]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400 w-24">Hex target</label>
              <input
                value={hexInput}
                onChange={(e) => setHexInput(e.target.value)}
                placeholder="#RRGGBB or RRGGBB"
                className="flex-1 px-3 py-2 rounded-lg bg-[#0f0f12] border border-gray-700 text-gray-100 placeholder-gray-500"
              />
              <button onClick={() => applyHex(hexInput)} className="px-3 py-2 rounded-lg border border-emerald-500 text-emerald-200 bg-[#0f1512] hover:bg-[#131b16]">
                Apply
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400 w-24">Dec target</label>
              <input type="number" min={0} max={255} value={rIn} onChange={e => setRIn(clamp255(+e.target.value))} className="w-20 px-2 py-2 rounded-lg bg-[#0f0f12] border border-gray-700 text-gray-100" />
              <input type="number" min={0} max={255} value={gIn} onChange={e => setGIn(clamp255(+e.target.value))} className="w-20 px-2 py-2 rounded-lg bg-[#0f0f12] border border-gray-700 text-gray-100" />
              <input type="number" min={0} max={255} value={bIn} onChange={e => setBIn(clamp255(+e.target.value))} className="w-20 px-2 py-2 rounded-lg bg-[#0f0f12] border border-gray-700 text-gray-100" />
              <button onClick={() => applyDec(rIn, gIn, bIn)} className="px-3 py-2 rounded-lg border border-emerald-500 text-emerald-200 bg-[#0f1512] hover:bg-[#131b16]">
                Apply
              </button>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => newTargetRGB()} className="px-3 py-2 rounded-lg border border-blue-400 text-blue-200 bg-[#0f131a] hover:bg-[#101720]">Random target</button>
            <button onClick={resetAll} className="px-3 py-2 rounded-lg border border-gray-700 text-gray-300">Reset All</button>
            <button onClick={checkAll} className="px-3 py-2 rounded-lg border border-purple-400 text-purple-200 bg-[#120f1a] hover:bg-[#170f22]">Check All</button>
          </div>
        </div>

        {/* Main split: left bulbs (3 rows) | right preview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* LEFT: bulbs */}
          <div className="space-y-4">
            {rows.map((row, rIdx) => {
              const chColor =
                row.channel === "R" ? "text-red-300"
                : row.channel === "G" ? "text-emerald-300"
                : "text-sky-300";
              const borderState =
                row.result === "wrong" ? "border-red-600/60 bg-[#1a0f10]" :
                row.result === "correct" ? "border-emerald-600/60 bg-[#0f1512]" :
                "border-gray-700 bg-[#11151a]";

              return (
                <div key={row.channel} className={`p-3 rounded-xl border ${borderState}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm uppercase tracking-wide text-gray-400">Channel</div>
                    <div className={`text-lg font-semibold ${chColor}`}>{row.channel}</div>
                  </div>

                  <div className="grid grid-cols-8 gap-3 select-none mb-3">
                    {row.bits.map((bit, i) => (
                      <button
                        key={i}
                        onClick={() => toggleBit(rIdx, i)}
                        disabled={row.locked}
                        className="group focus:outline-none"
                        aria-label={`${row.channel} bulb ${i+1} ${bit ? "on" : "off"}`}
                      >
                        <div className="relative h-12 w-12 sm:h-16 sm:w-16">
                          {/* halo */}
                          <div className={`absolute -inset-3 rounded-full blur-2xl transition-opacity ${bit ? "opacity-30" : "opacity-0"}`}
                               style={{ background: "radial-gradient(circle, rgba(255,200,120,0.35) 0%, rgba(255,180,90,0.15) 40%, rgba(0,0,0,0) 70%)" }} />
                          {/* glass */}
                          <div className="relative h-full w-full rounded-full overflow-visible">
                            <div className={`absolute inset-0 rounded-full border ${bit ? "border-amber-300" : "border-gray-600"}`}
                                 style={{ background: bit
                                   ? "radial-gradient(closest-side, rgba(255,225,150,0.6), rgba(255,210,120,0.15) 60%, rgba(0,0,0,0) 70%)"
                                   : "radial-gradient(closest-side, rgba(200,200,200,0.12), rgba(60,60,60,0.08) 60%, rgba(0,0,0,0) 70%)" }} />
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
                                 style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.6), rgba(255,255,255,0))" }} />
                            {/* weight label (fixed 128..1 for clarity) */}
                            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-md bg-[#0c0f13] border border-gray-700 text-[10px] text-gray-300 font-mono pointer-events-none">
                              {weights[i]}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="text-gray-300">
                      Your: <span className="font-mono">{valueFromBits(row.bits, msbLeft)}</span>
                      <span className="mx-2 text-gray-500">/</span>
                      Target: <span className="font-mono">{row.target}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => checkRow(rIdx)} className="px-3 py-1.5 rounded-lg border border-blue-400 text-blue-200 bg-[#0f131a] hover:bg-[#101720]">Check</button>
                      <button onClick={() => resetRow(rIdx)} className="px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300">Reset</button>
                    </div>
                  </div>

                  {row.result === "wrong" && (
                    <div className="mt-2 text-sm text-red-300">
                      Correct binary: <span className="font-mono">{bin8(row.target)}</span>
                    </div>
                  )}
                  {row.result === "correct" && (
                    <div className="mt-2 text-sm text-emerald-300">✅ Correct</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* RIGHT: preview & numbers */}
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-gray-700 bg-[#11151a]">
              <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Target color</div>
              <div className="flex items-center gap-4">
                <div className="h-16 w-28 rounded-lg border border-gray-600" style={{ backgroundColor: `rgb(${rT}, ${gT}, ${bT})` }} />
                <div className="text-sm">
                  <div>Hex: <span className="font-mono">{hexTarget}</span></div>
                  <div>Dec: <span className="font-mono">({rT}, {gT}, {bT})</span></div>
                  <div>Bin R/G/B:
                    <span className="font-mono ml-2">{bin8(rT)}</span>
                    <span className="font-mono ml-2">{bin8(gT)}</span>
                    <span className="font-mono ml-2">{bin8(bT)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-gray-700 bg-[#11151a]">
              <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Your color</div>
              <div className="flex items-center gap-4">
                <div className="h-16 w-28 rounded-lg border border-gray-600" style={{ backgroundColor: `rgb(${rY}, ${gY}, ${bY})` }} />
                <div className="text-sm">
                  <div>Hex: <span className="font-mono">{hexYours}</span></div>
                  <div>Dec: <span className="font-mono">({rY}, {gY}, {bY})</span></div>
                </div>
              </div>
              <div className="mt-3">
                <button onClick={checkAll} className="px-3 py-2 rounded-lg border border-purple-400 text-purple-200 bg-[#120f1a] hover:bg-[#170f22]">Check All</button>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-gray-700 bg-[#11151a]">
              <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Hint</div>
              <div className="text-sm text-gray-300">
                Match each channel’s decimal value by lighting the correct bulbs (8-bit). When all three are correct, your color equals the target.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
