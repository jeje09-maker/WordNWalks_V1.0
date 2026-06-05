'use client';

import React, { useState, useRef, useCallback } from 'react';
import { X, Check, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TimeStewardSegment } from '@/lib/types';
import { Input } from '@/components/ui/input';

// ── Categories ────────────────────────────────────────────────────────────────
export const TIME_CATEGORIES: Record<string, { icon: string; label: string; color: string }> = {
  sleep:    { icon: '😴', label: '수면',          color: '#4a6fa5' },
  withGod:  { icon: '🙏', label: '묵상/기도',     color: '#7c3aed' },
  work:     { icon: '💼', label: '일/공부',        color: '#f97316' },
  people:   { icon: '❤️', label: '관계/만남',      color: '#e11d48' },
  growth:   { icon: '🧠', label: '독서/자기계발',  color: '#0d9488' },
  rest:     { icon: '🧘', label: '휴식',           color: '#16a34a' },
  transport: { icon: '🚗', label: '이동',          color: '#0ea5e9' },
  play:      { icon: '⚽', label: '놀이/운동',     color: '#f43f5e' },
  mindless: { icon: '📱', label: '의미없는 시간',  color: '#94a3b8' },
  custom:   { icon: '✏️', label: '직접 입력',      color: '#6366f1' },
};

// ── SVG layout ────────────────────────────────────────────────────────────────
const VB       = 420;
const CX       = VB / 2;
const CY       = VB / 2;
const R_OUTER  = 150;
const R_INNER  = 88;
const R_HANDLE = R_OUTER + 30;   // handle dot radius from center
const R_LABEL  = R_OUTER + 16;   // hour number radius

// ── Math ──────────────────────────────────────────────────────────────────────
const d2r    = (deg: number) => ((deg - 90) * Math.PI) / 180;
const ptAt   = (deg: number, r: number) => ({
  x: CX + r * Math.cos(d2r(deg)),
  y: CY + r * Math.sin(d2r(deg)),
});
const xyDeg  = (x: number, y: number) => {
  let d = (Math.atan2(x - CX, -(y - CY)) * 180) / Math.PI;
  return ((d % 360) + 360) % 360;
};
const snap   = (d: number) => Math.round(d / 3.75) * 3.75;   // 15-min
const h2d    = (h: number) => h * 15;
const d2h    = (d: number) => d / 15;
const sweep  = (s: number, e: number) => ((e - s) % 360 + 360) % 360;
const s4     = (n: number) => Math.round(n * 4) / 4;

const arcPath = (sd: number, ed: number): string => {
  const sw = sweep(sd, ed);
  if (sw < 0.1) return '';
  const lg = sw > 180 ? 1 : 0;
  const os = ptAt(sd, R_OUTER), oe = ptAt(ed, R_OUTER);
  const is = ptAt(sd, R_INNER), ie = ptAt(ed, R_INNER);
  return `M${os.x} ${os.y} A${R_OUTER} ${R_OUTER} 0 ${lg} 1 ${oe.x} ${oe.y}
          L${ie.x} ${ie.y} A${R_INNER} ${R_INNER} 0 ${lg} 0 ${is.x} ${is.y}Z`;
};

const cut = (segs: TimeStewardSegment[], ns: TimeStewardSegment) => {
  const out: TimeStewardSegment[] = [];
  segs.forEach(s => {
    if (s.endHour <= ns.startHour || s.startHour >= ns.endHour) { out.push(s); return; }
    if (s.startHour < ns.startHour) out.push({ ...s, endHour: ns.startHour });
    if (s.endHour   > ns.endHour)   out.push({ ...s, startHour: ns.endHour });
  });
  out.push(ns);
  return out.sort((a, b) => a.startHour - b.startHour);
};

const fmtDur = (hrs: number) => {
  const h = Math.floor(hrs), m = Math.round((hrs - h) * 60);
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  value: TimeStewardSegment[];
  onChange: (v: TimeStewardSegment[] | ((p: TimeStewardSegment[]) => TimeStewardSegment[])) => void;
}

type DragTarget = 'start' | 'end' | null;

// ── Component ─────────────────────────────────────────────────────────────────
export default function TimeStewardChart({ value: segments, onChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  // active category
  const [armed,   setArmed]   = useState<string | null>(null);
  // custom content / memo
  const [inputText, setInputText] = useState('');
  // pending arc (degrees, 0 = 12-o'clock, CW)
  const [sDeg,    setSDeg]    = useState(0);
  const [eDeg,    setEDeg]    = useState(0);
  // which handle is being dragged
  const [dragging, setDragging] = useState<DragTarget>(null);

  const cat = armed ? TIME_CATEGORIES[armed] : null;

  // ── SVG coords ───────────────────────────────────────────────────────────
  const toSvg = useCallback((cx: number, cy: number) => {
    const el = svgRef.current;
    if (!el) return { x: CX, y: CY };
    const r = el.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * VB, y: ((cy - r.top) / r.height) * VB };
  }, []);

  // ── Select category: place handles at last endpoint (or 0) ───────────────
  const armCategory = useCallback((key: string) => {
    const last  = segments.length
      ? segments.reduce((a, b) => a.endHour > b.endHour ? a : b)
      : null;
    const initD = last ? h2d(last.endHour % 24) : 0;
    setSDeg(initD);
    setEDeg(initD);
    setArmed(key);
    setInputText('');
    setDragging(null);
  }, [segments]);

  const disarm = useCallback(() => {
    setArmed(null); setDragging(null); setInputText('');
  }, []);

  // ── Pointer handlers on handle circles ───────────────────────────────────
  const onDown = (target: DragTarget) => (e: React.PointerEvent<SVGCircleElement>) => {
    e.preventDefault(); e.stopPropagation();
    (e.currentTarget as SVGCircleElement).setPointerCapture(e.pointerId);
    setDragging(target);
  };

  const onMove = (e: React.PointerEvent<SVGCircleElement>) => {
    if (!dragging) return;
    const { x, y } = toSvg(e.clientX, e.clientY);
    const d = snap(xyDeg(x, y));
    if (dragging === 'start') setSDeg(d);
    else                      setEDeg(d);
  };

  const onUp = (e: React.PointerEvent<SVGCircleElement>) => {
    if (!dragging) return;
    const { x, y } = toSvg(e.clientX, e.clientY);
    const d = snap(xyDeg(x, y));
    if (dragging === 'start') setSDeg(d);
    else                      setEDeg(d);
    setDragging(null);
  };

  // ── Confirm: click the preview arc ───────────────────────────────────────
  const confirmArc = useCallback(() => {
    if (!armed || !cat) return;
    const sw = sweep(sDeg, eDeg);
    if (sw < 3.75) return;   // too small

    const sh    = d2h(sDeg);
    const rawEh = sh + sw / 15;

    const newSegment: TimeStewardSegment = {
      id: Date.now().toString(), 
      category: armed,
      content: inputText.trim(),
      startHour: s4(sh), 
      endHour: s4(rawEh),
    };

    if (rawEh <= 24) {
      onChange(p => cut(p, newSegment));
    } else {
      const id = Date.now();
      onChange(p =>
        cut(cut(p,
          { ...newSegment, id: `${id}-1`, endHour: 24 }),
          { ...newSegment, id: `${id}-2`, startHour: 0, endHour: s4(rawEh - 24) },
        ),
      );
    }
    // move both handles to the new end position
    const newDeg = h2d(s4(rawEh % 24));
    setSDeg(newDeg);
    setEDeg(newDeg);
    setArmed(null);   // deselect so user picks next category
    setInputText('');
  }, [armed, cat, sDeg, eDeg, inputText, onChange]);

  // ── Derived geometry ──────────────────────────────────────────────────────
  const sHandlePt  = ptAt(sDeg, R_HANDLE);
  const eHandlePt  = ptAt(eDeg, R_HANDLE);
  const sSpokePt   = ptAt(sDeg, R_OUTER + 5);
  const eSpokePt   = ptAt(eDeg, R_OUTER + 5);
  const previewArc = armed ? arcPath(sDeg, eDeg) : null;
  const sw         = sweep(sDeg, eDeg);
  const durLabel   = armed && sw >= 3.75 ? fmtDur(sw / 15) : '';

  const midDeg = sDeg + sw / 2;
  const durLabelPt = ptAt(midDeg, R_OUTER + 48);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-3 select-none">

      {/* ── Category pills ── */}
      <div className="flex flex-wrap justify-center gap-2 max-w-[430px]">
        {Object.entries(TIME_CATEGORIES).map(([key, c]) => {
          const sel = armed === key;
          return (
            <button key={key}
              onClick={() => sel ? disarm() : armCategory(key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all duration-150',
                sel
                  ? 'text-white scale-105 shadow-md'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:shadow-sm',
              )}
              style={sel ? { backgroundColor: c.color, borderColor: c.color } : {}}
            >
              <span>{c.icon}</span><span>{c.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Custom Content Input ── */}
      {armed && (
        <div className="w-full max-w-[300px] animate-in fade-in slide-in-from-top-1">
          <Input 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={armed === 'custom' ? "어떤 활동인가요?" : "상세 내용 입력 (선택)"}
            className="h-8 text-xs text-center border-primary/20 focus-visible:ring-primary"
            autoFocus
          />
        </div>
      )}

      {/* ── Status hint ── */}
      <div className="h-5 flex items-center justify-center">
        {armed && sw >= 3.75 ? (
          <button onClick={confirmArc}
            className="flex items-center gap-1.5 px-4 py-1 rounded-full text-xs font-bold text-white shadow transition-all hover:opacity-90 active:scale-95"
            style={{ backgroundColor: cat!.color }}>
            <Check className="w-3.5 h-3.5" />
            {cat!.icon} {inputText || cat!.label} {durLabel} 기록 확정
          </button>
        ) : armed ? (
          <span className="text-xs text-slate-400">핸들을 드래그해서 시간 범위를 설정하세요</span>
        ) : (
          <span className="text-xs text-slate-400">카테고리를 선택하세요</span>
        )}
      </div>

      {/* ── SVG clock ── */}
      <svg ref={svgRef} viewBox={`0 0 ${VB} ${VB}`} width={VB} height={VB}
        className="overflow-visible" style={{ touchAction: 'none' }}>

        {/* Background donut */}
        <circle cx={CX} cy={CY} r={R_OUTER} fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
        <circle cx={CX} cy={CY} r={R_INNER} fill="white"   stroke="#e2e8f0" strokeWidth="1" />

        {/* Ticks */}
        {Array.from({ length: 96 }).map((_, i) => {
          const d    = i * 3.75;
          const is3h = i % 12 === 0;
          const isH  = i % 4  === 0;
          const len  = is3h ? 13 : isH ? 7 : 3;
          const sw2  = is3h ? 2  : isH ? 1.2 : 0.5;
          const p1   = ptAt(d, R_INNER);
          const p2   = ptAt(d, R_INNER - len);
          return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
            stroke="#94a3b8" strokeWidth={sw2}
            opacity={is3h ? 0.9 : isH ? 0.5 : 0.2} />;
        })}

        {/* Hour labels 0,3,6,9,12,15,18,21 */}
        {[0, 3, 6, 9, 12, 15, 18, 21].map(h => {
          const p = ptAt(h2d(h), R_LABEL);
          return (
            <text key={h} x={p.x} y={p.y}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="11" fontWeight="700" fill="#64748b">
              {h}
            </text>
          );
        })}

        {/* Saved segments */}
        {segments.map(seg => {
          const sc   = TIME_CATEGORIES[seg.category];
          const sd2  = h2d(seg.startHour);
          const ed2  = h2d(seg.endHour);
          const sw3  = sweep(sd2, ed2);
          const mid  = sd2 + sw3 / 2;
          const ip   = ptAt(mid, (R_INNER + R_OUTER) / 2);
          return (
            <g key={seg.id} className="group" style={{ cursor: 'pointer' }}
              onClick={() => onChange(p => p.filter(s => s.id !== seg.id))}>
              <path d={arcPath(sd2, ed2)} fill={sc?.color ?? '#ccc'} opacity="0.88"
                className="group-hover:opacity-50 transition-opacity" />
              <text x={ip.x} y={ip.y - 1} textAnchor="middle" dominantBaseline="middle"
                fontSize="14" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                {sc?.icon}
              </text>
              {/* delete hint */}
              <text x={ip.x} y={ip.y} textAnchor="middle" dominantBaseline="middle"
                fontSize="13" fill="white" fontWeight="bold"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ pointerEvents: 'none', userSelect: 'none' }}>✕</text>
            </g>
          );
        })}

        {/* Preview arc (pending, not yet confirmed) */}
        {previewArc && cat && sw >= 3.75 && (
          <path d={previewArc} fill={cat.color} opacity="0.30"
            style={{ pointerEvents: 'none' }} />
        )}

        {/* Duration label near arc midpoint */}
        {armed && cat && sw >= 3.75 && (
          <text x={durLabelPt.x} y={durLabelPt.y}
            textAnchor="middle" dominantBaseline="middle"
            fontSize="11" fontWeight="800" fill={cat.color}
            stroke="white" strokeWidth="3" paintOrder="stroke"
            style={{ pointerEvents: 'none', userSelect: 'none' }}>
            {durLabel}
          </text>
        )}

        {/* ── Handles (only when armed) ── */}
        {armed && cat && (() => {
          const hp = { fill: cat.color, stroke: 'white', strokeWidth: 3 };
          return (
            <>
              {/* Start spoke (dashed) */}
              <line x1={CX} y1={CY} x2={sSpokePt.x} y2={sSpokePt.y}
                stroke={cat.color} strokeWidth="2" strokeDasharray="5 3" opacity="0.5"
                style={{ pointerEvents: 'none' }} />

              {/* End spoke (solid) */}
              <line x1={CX} y1={CY} x2={eSpokePt.x} y2={eSpokePt.y}
                stroke={cat.color} strokeWidth="2.5" opacity="0.85"
                style={{ pointerEvents: 'none' }} />

              {/* ── Start handle ── */}
              <g style={{ cursor: dragging === 'start' ? 'grabbing' : 'grab' }}>
                <circle cx={sHandlePt.x} cy={sHandlePt.y} r={15} {...hp}
                  onPointerDown={onDown('start')}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                />
                {/* hour label inside handle */}
                <text x={sHandlePt.x} y={sHandlePt.y}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize="10" fontWeight="700" fill="white"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  {d2h(sDeg) % 1 === 0 ? d2h(sDeg) : d2h(sDeg).toFixed(1)}
                </text>
              </g>

              {/* ── End handle (larger, primary) ── */}
              <g style={{ cursor: dragging === 'end' ? 'grabbing' : 'grab' }}>
                <circle cx={eHandlePt.x} cy={eHandlePt.y} r={18} {...hp}
                  onPointerDown={onDown('end')}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                />
                <text x={eHandlePt.x} y={eHandlePt.y}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize="10" fontWeight="700" fill="white"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  {d2h(eDeg) % 1 === 0 ? d2h(eDeg) : d2h(eDeg).toFixed(1)}
                </text>
              </g>
            </>
          );
        })()}

        {/* Center circle */}
        <circle cx={CX} cy={CY} r={R_INNER - 6}
          fill={armed ? cat!.color + '18' : 'white'}
          stroke={armed ? cat!.color : '#e2e8f0'}
          strokeWidth={armed ? 2 : 1}
          style={{ pointerEvents: 'none', transition: 'all .2s' }} />
        {armed && cat ? (
          <>
            <text x={CX} y={CY - 9} textAnchor="middle" dominantBaseline="middle"
              fontSize={inputText ? "18" : "26"} style={{ pointerEvents: 'none', userSelect: 'none' }}>
              {cat.icon}
            </text>
            <text x={CX} y={CY + 16} textAnchor="middle" dominantBaseline="middle"
              fontSize="10" fontWeight="700" fill={cat.color}
              style={{ pointerEvents: 'none', userSelect: 'none' }}>
              {inputText || cat.label}
            </text>
          </>
        ) : (
          <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle"
            fontSize="11" fill="#94a3b8" fontWeight="600"
            style={{ pointerEvents: 'none', userSelect: 'none' }}>
            선택 대기
          </text>
        )}
      </svg>

      {/* Cancel button */}
      {armed && (
        <button onClick={disarm}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-400 transition-colors mt-0">
          <X className="w-3 h-3" /> 취소
        </button>
      )}
    </div>
  );
}
