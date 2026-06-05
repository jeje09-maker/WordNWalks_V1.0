
'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import TimeStewardChart, { TIME_CATEGORIES } from './TimeStewardChart';
import type { DayData, TimeStewardSegment } from '@/lib/types';
import { Save, Trash2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const fmtHour = (h: number) => {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm > 0 ? `${hh}h ${mm}m` : `${hh}h`;
};

const getSummary = (segments: TimeStewardSegment[]): Record<string, number> => {
  const s: Record<string, number> = {};
  Object.keys(TIME_CATEGORIES).forEach(k => (s[k] = 0));
  segments.forEach(seg => {
    if (s[seg.category] !== undefined)
      s[seg.category] += seg.endHour - seg.startHour;
  });
  return s;
};

interface Props {
  dayData: DayData;
  onClose: () => void;
  onSave: (segments: TimeStewardSegment[]) => void;
}

export default function TimeStewardDialog({ dayData, onClose, onSave }: Props) {
  const [segments, setSegments] = useState<TimeStewardSegment[]>([]);

  useEffect(() => {
    setSegments(dayData.diary?.timeSteward || []);
  }, [dayData]);

  const summary     = useMemo(() => getSummary(segments), [segments]);
  const totalLogged = useMemo(
    () => Object.values(summary).reduce((a, b) => a + b, 0),
    [summary],
  );
  const summaryRows = useMemo(
    () =>
      Object.entries(summary)
        .filter(([, h]) => h > 0)
        .sort(([, a], [, b]) => b - a),
    [summary],
  );

  return (
    <Dialog open={true} onOpenChange={onClose}>
      {/* Wide enough: chart is 360px + category pills above it + right panel */}
      <DialogContent className="max-w-[900px] w-full p-0 overflow-hidden rounded-2xl gap-0">
        <div className="flex flex-col md:flex-row">

          {/* ── Left: chart + category buttons ── */}
          <div className="shrink-0 flex flex-col items-center justify-start bg-slate-50 p-6 border-r gap-2">
            <TimeStewardChart value={segments} onChange={setSegments} />
          </div>

          {/* ── Right: stats ── */}
          <div className="flex flex-col flex-1 min-w-[280px] p-7">
            <DialogHeader className="mb-5 shrink-0">
              <DialogTitle className="text-xl font-bold">시간의 청지기</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                위에서 카테고리를 선택한 뒤, 핸들을 드래그해 시간을 기록하세요.
                <br />
                기록된 색상 영역을 클릭하면 삭제됩니다.
              </DialogDescription>
            </DialogHeader>

            {/* Total progress bar */}
            <div className="shrink-0 mb-5">
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="text-sm font-semibold text-muted-foreground">총 기록</span>
                <span className="text-sm">
                  <span className="text-2xl font-black text-foreground">{fmtHour(totalLogged)}</span>
                  <span className="text-muted-foreground ml-1">/ 24h</span>
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border">
                <div
                  className="h-full rounded-full transition-all duration-300 bg-indigo-500"
                  style={{ width: `${Math.min((totalLogged / 24) * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* Summary */}
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 shrink-0">
              사용량 분석
            </p>
            <ScrollArea className="flex-1 -mx-1">
              <div className="space-y-3 px-1 pb-2">
                {summaryRows.length > 0 ? (
                  summaryRows.map(([key, hours]) => {
                    const cat = TIME_CATEGORIES[key];
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <span className="text-xl w-7 text-center shrink-0">{cat.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-1">
                            <span className="text-sm font-medium">{cat.label}</span>
                            <span className="text-sm font-bold tabular-nums ml-2 shrink-0">
                              {fmtHour(hours)}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div className="h-2 rounded-full transition-all duration-300"
                              style={{ width: `${(hours / 24) * 100}%`, backgroundColor: cat.color }} />
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-10 text-muted-foreground">
                    <p className="text-4xl mb-2">🕐</p>
                    <p className="text-sm font-medium">아직 기록이 없습니다</p>
                    <p className="text-xs mt-1 opacity-60">왼쪽에서 카테고리를 선택하고<br />핸들을 드래그해보세요</p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Segment list */}
            {segments.length > 0 && (
              <>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mt-4 mb-2 shrink-0">
                  기록 목록
                </p>
                <ScrollArea className="max-h-40 -mx-1 shrink-0">
                  <div className="space-y-0.5 px-1">
                    {segments.map(seg => {
                      const cat = TIME_CATEGORIES[seg.category];
                      return (
                        <div key={seg.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/60 group text-sm">
                          <span>{cat?.icon}</span>
                          <div className="flex-1 min-w-0 flex flex-col">
                            <span className="font-bold text-[11px] text-slate-700">{seg.content || cat?.label}</span>
                            {seg.content && <span className="text-[10px] text-muted-foreground">{cat?.label}</span>}
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {seg.startHour}h → {seg.endHour}h
                          </span>
                          <span className="text-xs font-bold tabular-nums ml-2"
                            style={{ color: cat?.color }}>
                            {fmtHour(seg.endHour - seg.startHour)}
                          </span>
                          <button
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive ml-1"
                            onClick={() => setSegments(p => p.filter(s => s.id !== seg.id))}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </>
            )}

            <DialogFooter className="mt-5 pt-4 border-t shrink-0">
              <Button variant="outline" onClick={onClose}>취소</Button>
              <Button onClick={() => { onSave(segments); onClose(); }}>
                <Save className="mr-2 h-4 w-4" />저장
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
