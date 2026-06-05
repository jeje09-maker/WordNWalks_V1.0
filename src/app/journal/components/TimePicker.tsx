
'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
  const [editingMode, setEditingMode] = useState<'hour' | 'minute' | null>(null);
  const timePickerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);

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

  const togglePeriod = () => {
    setEditingMode(null); 
    const newPeriod = period === '오전' ? '오후' : '오전';
    onChange(`${newPeriod} ${hour}:${minute}`);
  };

  const handleUnitClick = (unit: 'hour' | 'minute') => {
    setEditingMode(unit);
  };
  
  const updateValue = useCallback((direction: number) => {
    if (editingMode === 'hour') {
      const currentIndex = hours.indexOf(hour);
      if (currentIndex === -1) return;
      const newIndex = (currentIndex + direction + hours.length) % hours.length;
      const newHour = hours[newIndex];
      onChange(`${period} ${newHour}:${minute}`);
    } else if (editingMode === 'minute') {
      const currentIndex = minutes.indexOf(minute);
      if (currentIndex === -1) return;
      const newIndex = (currentIndex + direction + minutes.length) % minutes.length;
      const newMinute = minutes[newIndex];
      onChange(`${period} ${hour}:${newMinute}`);
    }
  }, [editingMode, hour, minute, period, onChange]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const direction = e.deltaY > 0 ? 1 : -1;
    updateValue(direction);
  }, [updateValue]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (touchStartY.current === null) return;
    const touchCurrentY = e.touches[0].clientY;
    const deltaY = touchStartY.current - touchCurrentY;

    if (Math.abs(deltaY) > 10) { // Sensitivity
      e.preventDefault();
      const direction = deltaY > 0 ? 1 : -1;
      updateValue(direction);
      touchStartY.current = touchCurrentY;
    }
  }, [updateValue]);

  const handleGlobalClick = useCallback((e: MouseEvent) => {
    if (timePickerRef.current && !timePickerRef.current.contains(e.target as Node)) {
        setEditingMode(null);
    }
  }, []);

  useEffect(() => {
    const el = timePickerRef.current;
    if (el) {
      el.addEventListener('wheel', handleWheel, { passive: false });
      el.addEventListener('touchstart', handleTouchStart, { passive: false });
      el.addEventListener('touchmove', handleTouchMove, { passive: false });
    }
    document.addEventListener('mousedown', handleGlobalClick);
    
    return () => {
      if (el) {
        el.removeEventListener('wheel', handleWheel);
        el.removeEventListener('touchstart', handleTouchStart);
        el.removeEventListener('touchmove', handleTouchMove);
      }
      document.removeEventListener('mousedown', handleGlobalClick);
    };
  }, [handleWheel, handleGlobalClick, handleTouchStart, handleTouchMove]);

  const getSpanClasses = (unit: 'hour' | 'minute') => {
    const isActive = editingMode === unit;
    return cn(
      "cursor-pointer px-1 py-1 rounded-md font-mono text-base transition-colors select-none",
      "hover:bg-muted",
      isActive && "bg-primary/20 text-primary ring-2 ring-primary"
    );
  };

  return (
    <div 
      ref={timePickerRef}
      className="flex items-center justify-center gap-1 rounded-md border border-input bg-background px-2 py-2 text-sm h-10 w-full touch-none"
    >
      <button
        type="button"
        onClick={togglePeriod}
        className={cn(
          "cursor-pointer px-1 py-1 rounded-md transition-colors font-sans font-semibold text-sm select-none",
          "hover:bg-muted",
          period === '오전' ? 'text-blue-600' : 'text-red-600'
        )}
      >
        {period === '오전' ? t('time_am') : t('time_pm')}
      </button>
      
      <span
        onClick={() => handleUnitClick('hour')}
        className={getSpanClasses('hour')}
      >
        {hour}
      </span>

      <span className="font-mono">:</span>

      <span
        onClick={() => handleUnitClick('minute')}
        className={getSpanClasses('minute')}
      >
        {minute}
      </span>
    </div>
  );
}
