'use client';

import { LoaderCircle, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  fullScreen?: boolean;
}

export default function LoadingSpinner({ fullScreen = false }: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center bg-[#2e2848] text-white transition-all duration-500',
        fullScreen ? 'h-screen w-screen fixed inset-0 z-[200]' : 'h-full w-full min-h-[400px]'
      )}
    >
      <div className="relative mb-8 animate-in fade-in zoom-in duration-700">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          <MessageCircle className="h-20 w-20 text-primary relative z-10" />
      </div>
      
      <div className="text-center space-y-3 animate-in slide-in-from-bottom-4 duration-1000">
          <h1 className="text-3xl font-black tracking-tighter">Word N Walks</h1>
          <div className="h-1 w-12 bg-primary/50 mx-auto rounded-full" />
          <p className="text-slate-300 font-light tracking-wide px-6">
              기록할수록 깊어지는 나만의 말씀행전
          </p>
      </div>

      <div className="mt-12 flex flex-col items-center gap-4">
          <LoaderCircle className="h-8 w-8 animate-spin text-primary opacity-80" />
          <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400 font-bold">Loading Grace...</span>
      </div>
    </div>
  );
}
