'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/use-translation';

const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

export default function TimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();

  const [period, hour, minute] = useMemo(() => {
    try {
      const parts = value.split(' ');
      if (parts.length < 2) throw new Error("Invalid format");
      const time = parts[1];
      const timeParts = time.split(':');
      if (timeParts.length < 2) throw new Error("Invalid time format");
      return [parts[0], timeParts[0], timeParts[1]];
    } catch (e) {
      return ['오전', '09', '00'];
    }
  }, [value]);

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(`${e.target.value} ${hour}:${minute}`);
  };

  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(`${period} ${e.target.value}:${minute}`);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(`${period} ${hour}:${e.target.value}`);
  };

  return (
    <div className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1 shadow-sm text-sm h-10 w-full select-none">
      {/* Period Selection (AM/PM) */}
      <select
        value={period}
        onChange={handlePeriodChange}
        className={cn(
          "appearance-none bg-transparent cursor-pointer rounded-md px-1.5 py-0.5 font-sans font-bold text-sm transition-colors border-none outline-none focus:bg-slate-100 hover:bg-slate-50 text-center w-[54px]",
          period === '오전' ? 'text-blue-600' : 'text-red-600'
        )}
      >
        <option value="오전">{t('time_am')}</option>
        <option value="오후">{t('time_pm')}</option>
      </select>
      
      {/* Hour Selection */}
      <select
        value={hour}
        onChange={handleHourChange}
        className="appearance-none bg-transparent cursor-pointer rounded-md px-1 py-0.5 font-mono text-base font-semibold hover:bg-slate-50 transition-colors border-none outline-none focus:bg-slate-100 text-slate-800 text-center w-8"
      >
        {hours.map(h => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>

      <span className="font-mono text-slate-400 font-semibold select-none">:</span>

      {/* Minute Selection */}
      <select
        value={minute}
        onChange={handleMinuteChange}
        className="appearance-none bg-transparent cursor-pointer rounded-md px-1 py-0.5 font-mono text-base font-semibold hover:bg-slate-50 transition-colors border-none outline-none focus:bg-slate-100 text-slate-800 text-center w-8"
      >
        {minutes.map(m => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
    </div>
  );
}
