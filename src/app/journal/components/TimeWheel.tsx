'use client';

import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';

export const TimeWheel = ({
  values,
  onSelect,
  selectedValue,
}: {
  values: string[];
  onSelect: (value: string) => void;
  selectedValue: string;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemHeight = 32; // h-8
  const repetitionCount = 5;
  
  const repeatedValues = useMemo(() => Array(repetitionCount).fill(values).flat(), [values]);
  const isJumpScheduled = useRef(false);

  // Set initial position to the middle block
  useEffect(() => {
    if (scrollRef.current) {
        const originalIndex = values.indexOf(selectedValue);
        if (originalIndex === -1) return;
        const middleBlockIndex = Math.floor(repetitionCount / 2);
        const targetIndex = originalIndex + (values.length * middleBlockIndex);
        scrollRef.current.scrollTop = targetIndex * itemHeight;
    }
  }, [selectedValue, values, itemHeight, repetitionCount]);

  const handleScroll = useCallback(() => {
    if (isJumpScheduled.current || !scrollRef.current) {
        return;
    }
    isJumpScheduled.current = true;
    
    requestAnimationFrame(() => {
        if (!scrollRef.current) {
            isJumpScheduled.current = false;
            return;
        }

        const { scrollTop, scrollHeight } = scrollRef.current;
        const oneCycleHeight = values.length * itemHeight;

        // If scrolled near the top edge (into the first full set)
        if (scrollTop < oneCycleHeight) {
            scrollRef.current.scrollTop += oneCycleHeight * (repetitionCount - 2);
        } 
        // If scrolled near the bottom edge (into the last full set)
        else if (scrollTop > scrollHeight - oneCycleHeight * 2) {
            scrollRef.current.scrollTop -= oneCycleHeight * (repetitionCount - 2);
        }
        isJumpScheduled.current = false;
    });
  }, [values.length, itemHeight, repetitionCount]);

  return (
    <div 
        ref={scrollRef} 
        onScroll={handleScroll}
        className="h-40 w-16 overflow-y-scroll snap-y snap-mandatory no-scrollbar time-wheel-mask"
    >
      <div className="h-[64px] shrink-0" aria-hidden="true"></div>
      {repeatedValues.map((value, index) => (
        <button
          key={`${value}-${index}`}
          onClick={() => onSelect(value)}
          className={cn(
            "flex items-center justify-center h-8 w-full text-base snap-center shrink-0 transition-colors duration-100",
            selectedValue === value ? 'font-bold text-primary text-lg' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {value}
        </button>
      ))}
      <div className="h-[64px] shrink-0" aria-hidden="true"></div>
    </div>
  );
};
