import React from "react";
import logoUrl from "./assets/logo.png";

type Row = {
    channel: "R" | "G" | "B";
    target: number;        // 0..255
    bits: number[];        // length 8
    locked: boolean;
    result: "idle" | "correct" | "wrong";
};

function clamp255(n: number) { return Math.max(0, Math.min(255, n | 0)); }
function weightArray(msbLeft: boolean) {
    const base = [128, 64, 32, 16, 8, 4, 2, 1];
    return msbLeft ? base : [...base].reverse();
}
function valueFromBits(bits: number[], msbLeft: boolean) {
    const w = weightArray(msbLeft);
    return bits.reduce((s, b, i) => s + (b ? w[i] : 0), 0);
}
function hex2(n: number) { return clamp255(n).toString(16).toUpperCase().padStart(2, "0"); }
function parseHex(input: string): [number, number, number] | null {
    let s = input.trim().replace(/^#|^0x/i, "");
    if (s.length === 3) s = s.split("").map(c => c + c).join("");
    if (!/^[0-9a-f]{6}$/i.test(s)) return null;
    const r = parseInt(s.slice(0, 2), 16);
    const g = parseInt(s.slice(2, 4), 16);
    const b = parseInt(s.slice(4, 6), 16);
    return [r, g, b];
}
function randomRGB(): [number, number, number] {
    return [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)];
}
function bin8(n: number) { return clamp255(n).toString(2).padStart(8, "0"); }

/** Glass flask slider: drag/touch/keyboard to set 0..255 */
function FlaskSlider({
    channel, value, onChange
}: { channel: "R" | "G" | "B"; value: number; onChange: (v: number) => void }) {
    const ref = React.useRef<HTMLDivElement>(null);
    const pct = Math.round((clamp255(value) / 255) * 100);

    const color =
        channel === "R" ? "rgb(239,68,68)" : // red-500
            channel === "G" ? "rgb(16,185,129)" : // emerald-500
                "rgb(59,130,246)";  // blue-500

    const borderClass =
        channel === "R" ? "border-red-400/60" :
            channel === "G" ? "border-emerald-400/60" :
                "border-sky-400/60";

    const setFromPoint = (clientY: number) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const ratio = 1 - (clientY - rect.top) / rect.height; // top=255, bottom=0
        const v = Math.round(Math.max(0, Math.min(1, ratio)) * 255);
        onChange(v);
    };

    const onPointerDown = (e: React.PointerEvent) => {
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        setFromPoint(e.clientY);
    };
    const onPointerMove = (e: React.PointerEvent) => {
        // e.buttons===1 when dragging with mouse; on touch it's also fine because of capture
        if (e.buttons === 1 || e.pointerType === "touch") {
            setFromPoint(e.clientY);
        }
    };
    const onPointerUp = (e: React.PointerEvent) => {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        let v = value;
        if (e.key === "ArrowUp") v = Math.min(255, v + 1);
        else if (e.key === "ArrowDown") v = Math.max(0, v - 1);
        else if (e.key === "PageUp") v = Math.min(255, v + 10);
        else if (e.key === "PageDown") v = Math.max(0, v - 10);
        else if (e.key === "Home") v = 0;
        else if (e.key === "End") v = 255;
        else return;
        e.preventDefault();
        onChange(v);
    };

    return (
        <div className="flex flex-col items-center w-16 sm:w-20 select-none">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">{channel}</div>

            <div
                ref={ref}
                role="slider"
                aria-label={`${channel} channel`}
                aria-valuemin={0}
                aria-valuemax={255}
                aria-valuenow={value}
                tabIndex={0}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onKeyDown={onKeyDown}
                className={`relative h-40 sm:h-48 w-10 sm:w-12 rounded-b-xl rounded-t-[26px] border ${borderClass}
                    bg-gradient-to-b from-white/15 to-white/5
                    shadow-inner cursor-pointer outline-none focus:ring-2 focus:ring-white/20`}
                style={{
                    // subtle glass effect
                    backdropFilter: "blur(1px)",
                }}
            >
                {/* liquid fill */}
                <div
                    className="absolute bottom-0 left-0 right-0 rounded-b-xl overflow-hidden"
                    style={{ height: `${pct}%` }}
                >
                    <div
                        className="h-full w-full"
                        style={{
                            background: `linear-gradient(180deg, ${color}, ${color})`,
                            opacity: 0.9,
                        }}
                    />
                    {/* meniscus highlight */}
                    <div
                        className="absolute -top-1 left-0 right-0 h-2 rounded-full"
                        style={{
                            background: "rgba(255,255,255,0.5)",
                            filter: "blur(2px)",
                        }}
                    />
                </div>

                {/* inner reflections */}
                <div
                    className="pointer-events-none absolute inset-y-2 left-1 w-1 rounded-full opacity-30"
                    style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0))" }}
                />
                <div
                    className="pointer-events-none absolute inset-y-3 right-1 w-0.5 rounded-full opacity-20"
                    style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.8), rgba(255,255,255,0))" }}
                />
            </div>

            <div className="mt-1 text-xs text-gray-300 font-mono">
                {value} <span className="text-gray-500">/</span> {Math.round((value / 255) * 100)}%
            </div>
        </div>
    );
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
        // Reset learners' bulbs only when changing the target wholesale:
        setRows(prev => prev.map(r => ({ ...r, bits: Array(8).fill(0), locked: false, result: "idle" })));
    }

    function applyHex(s: string) {
        const parsed = parseHex(s);
        if (parsed) newTargetRGB(parsed);
    }

    function toggleBit(rowIdx: number, bitIdx: number) {
        setRows(prev => {
            const copy = [...prev];
            const r: Row = { ...copy[rowIdx] };
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
            const r: Row = { ...copy[rowIdx] };
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
            const r: Row = { ...copy[rowIdx], bits: Array(8).fill(0), locked: false, result: "idle" };
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

    // show target & your color
    const [rY, gY, bY] = yourVals;


    const weights = weightArray(true); // fixed 128..1 labels for teaching clarity

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
                                onChange={(e) => setMsbLeft(e.target.checked)}
                            />
                            MSB on left
                        </label>
                        <button onClick={onExit} className="px-3 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-[#1a1f26]">Menu</button>
                    </div>
                </div>

                {/* Controls: hex + flask sliders */}
                <div className="mb-5 p-4 rounded-xl border border-gray-700 bg-[#11151a]">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {/* Hex setter */}
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

                        {/* Flask sliders (replace old decimal inputs) */}
                        <div className="flex items-center justify-evenly gap-4">
                            <FlaskSlider
                                channel="R"
                                value={rT}
                                onChange={(v) => setTarget(([_, g, b]) => [v, g, b])}
                            />
                            <FlaskSlider
                                channel="G"
                                value={gT}
                                onChange={(v) => setTarget(([r, _, b]) => [r, v, b])}
                            />
                            <FlaskSlider
                                channel="B"
                                value={bT}
                                onChange={(v) => setTarget(([r, g, _]) => [r, g, v])}
                            />
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

                                    <div className="grid grid-cols-8 gap-3 select-none mb-8 sm:mb-10">
                                        {row.bits.map((bit, i) => (
                                            <button
                                                key={i}
                                                onClick={() => toggleBit(rIdx, i)}
                                                disabled={row.locked}
                                                className="group focus:outline-none"
                                                aria-label={`${row.channel} bulb ${i + 1} ${bit ? "on" : "off"}`}
                                            >
                                                <div className="relative h-12 w-12 sm:h-16 sm:w-16">
                                                    {/* halo */}
                                                    <div className={`absolute -inset-3 rounded-full blur-2xl transition-opacity ${bit ? "opacity-30" : "opacity-0"}`}
                                                        style={{ background: "radial-gradient(circle, rgba(255,200,120,0.35) 0%, rgba(255,180,90,0.15) 40%, rgba(0,0,0,0) 70%)" }} />
                                                    {/* glass */}
                                                    <div className="relative h-full w-full rounded-full overflow-visible">
                                                        <div className={`absolute inset-0 rounded-full border ${bit ? "border-amber-300" : "border-gray-600"}`}
                                                            style={{
                                                                background: bit
                                                                    ? "radial-gradient(closest-side, rgba(255,225,150,0.6), rgba(255,210,120,0.15) 60%, rgba(0,0,0,0) 70%)"
                                                                    : "radial-gradient(closest-side, rgba(200,200,200,0.12), rgba(60,60,60,0.08) 60%, rgba(0,0,0,0) 70%)"
                                                            }} />
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
                                                        {/* weight label */}
                                                        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-md bg-[#0c0f13] border border-gray-700 text-[10px] text-gray-300 font-mono pointer-events-none">
                                                            {weights[i]}
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="flex items-center justify-end text-sm">
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
                                    <div>Hex: <span className="font-mono">{`#${hex2(rT)}${hex2(gT)}${hex2(bT)}`}</span></div>
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
                                    <div>Hex: <span className="font-mono">{`#${hex2(rY)}${hex2(gY)}${hex2(bY)}`}</span></div>
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
                                Drag each flask to set the decimal value (0–255) of its color channel. When all three rows are correct, your color matches the target.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
