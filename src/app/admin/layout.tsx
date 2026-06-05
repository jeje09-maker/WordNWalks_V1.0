
'use client';
import { useUser, useFirestore, useMemoFirebase, useCollection, useAuth } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import type { DayData } from '@/lib/types';
import { collection, query, where, documentId } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { buttonVariants, Button } from '@/components/ui/button';
import {
    Home,
    Users,
    CalendarDays,
    MessageSquare,
    MessageSquareQuote,
    User as UserIcon,
    LogOut,
    FilePenLine,
    Hand,
    ShieldCheck,
    Shapes
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SpiritualWave } from '@/components/ui/spiritual-wave';
import { useTranslation } from '@/hooks/use-translation';
import LanguageSelect from '@/components/language-select';
import { startOfToday, subDays, format } from 'date-fns';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, isUserLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { t } = useTranslation();

  // Root Admin only: jeje09@daum.net is an Org Admin, not a Super Admin
  const isSuperAdmin = user?.email === 'darak303@naver.com' || profile?.isAdmin;

  // Spiritual wave activity calculation
  const todayForQuery = useMemo(() => startOfToday(), []);
  const sevenDaysAgo = useMemo(() => format(subDays(todayForQuery, 6), 'yyyy-MM-dd'), [todayForQuery]);
  const dateString = useMemo(() => format(todayForQuery, 'yyyy-MM-dd'), [todayForQuery]);

  const recentJournalQuery = useMemoFirebase(() =>
      user ? query(
          collection(firestore, 'users', user.uid, 'journal'),
          where(documentId(), '>=', sevenDaysAgo),
          where(documentId(), '<=', dateString)
      ) : null,
      [user, firestore, sevenDaysAgo, dateString]
  );
  const { data: recentJournals } = useCollection<DayData>(recentJournalQuery);

  const waveActivityLevel = useMemo(() => {
      if (!recentJournals) return 0;
      const today = startOfToday();
      let completedDaysCount = 0;

      for (let i = 0; i < 7; i++) {
          const date = subDays(today, i);
          const dateStr = format(date, 'yyyy-MM-dd');
          const dayDataToScore = recentJournals.find(j => j.id === dateStr);

          if (dayDataToScore?.completed && dayDataToScore?.diaryCompleted) {
              completedDaysCount++;
          }
      }
      return completedDaysCount / 7;
  }, [recentJournals]);

  useEffect(() => {
    if (isUserLoading) return;
    
    if (!user) {
      router.push('/login');
      return;
    }

    if (!isSuperAdmin) {
      toast({
        title: "접근 거부",
        description: "이 페이지에 접근할 권한이 없습니다.",
        variant: "destructive",
      });
      router.push('/journal');
    }
  }, [user, isSuperAdmin, isUserLoading, router, toast]);

  const handleSignOut = async () => {
      if (!auth) return;
      await signOut(auth);
      router.push('/');
  };

  if (isUserLoading) {
    return <LoadingSpinner fullScreen={true} />;
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      <header className="relative w-full bg-[#2e2848] backdrop-blur-sm py-2 px-10 shadow-sm flex items-center justify-between gap-3 overflow-hidden shrink-0">
          <SpiritualWave activityLevel={waveActivityLevel} className="opacity-40 z-0" />
          <div className="relative z-10 flex flex-col border-r border-slate-600 pr-4">
              <h1 className="text-xl font-black tracking-tighter flex items-center font-sans">
                  <span className="text-primary">Word</span> <span className="mx-1 text-white">N</span> <span className="text-accent">Walks</span>
              </h1>
              <p className="text-[10px] font-light text-slate-300 -mt-1 tracking-tight">Walk with the Word.</p>
          </div>

          <nav className="relative z-10 flex-1 flex justify-center items-center gap-2">
              <Link href="/journal" className={cn(buttonVariants({ variant: 'ghost' }), pathname === '/journal' ? "text-white bg-white/10" : "text-slate-300 hover:bg-white/10 hover:text-white", "flex flex-col items-center justify-center h-auto p-2 gap-0.5 w-20")}>
                  <Home className="h-7 w-7" />
                  <span className="text-xs font-medium">{t('home')}</span>
              </Link>
              <Link href="/peoples" className={cn(buttonVariants({ variant: 'ghost' }), pathname === '/peoples' ? "text-white bg-white/10" : "text-slate-300 hover:bg-white/10 hover:text-white", "flex flex-col items-center justify-center h-auto p-2 gap-0.5 w-20")}>
                  <Users className="h-7 w-7" />
                  <span className="text-xs font-medium">{t('peoples')}</span>
              </Link>
              <Link href="/calendar" className={cn(buttonVariants({ variant: 'ghost' }), pathname === '/calendar' ? "text-white bg-white/10" : "text-slate-300 hover:bg-white/10 hover:text-white", "flex flex-col items-center justify-center h-auto p-2 gap-0.5 w-20")}>
                  <CalendarDays className="h-7 w-7" />
                  <span className="text-xs font-medium">{t('schedule')}</span>
              </Link>
              <Link href="/stats" className={cn(buttonVariants({ variant: 'ghost' }), pathname === '/stats' ? "text-white bg-white/10" : "text-slate-300 hover:bg-white/10 hover:text-white", "flex flex-col items-center justify-center h-auto p-2 gap-0.5 w-20")}>
                  <FilePenLine className="h-7 w-7" />
                  <span className="text-xs font-medium">{t('reports')}</span>
              </Link>
              <Link href="/prayer-room" className={cn(buttonVariants({ variant: 'ghost' }), pathname === '/prayer-room' ? "text-white bg-white/10" : "text-slate-300 hover:bg-white/10 hover:text-white", "flex flex-col items-center justify-center h-auto p-2 gap-0.5 w-20")}>
                  <Hand className="h-7 w-7" />
                  <span className="text-xs font-medium">{t('prayers')}</span>
              </Link>
              <Link href="/forum" className={cn(buttonVariants({ variant: 'ghost' }), pathname === '/forum' ? "text-white bg-white/10" : "text-slate-300 hover:bg-white/10 hover:text-white", "flex flex-col items-center justify-center h-auto p-2 gap-0.5 w-20")}>
                  <MessageSquare className="h-7 w-7" />
                  <span className="text-xs font-medium">{t('forum')}</span>
              </Link>
              <Link href="/groups" className={cn(buttonVariants({ variant: 'ghost' }), pathname === '/groups' ? "text-white bg-white/10" : "text-slate-300 hover:bg-white/10 hover:text-white", "flex flex-col items-center justify-center h-auto p-2 gap-0.5 w-20")}>
                  <Shapes className="h-7 w-7" />
                  <span className="text-xs font-medium">{t('groups')}</span>
              </Link>
              <Link href="/admin" className={cn(buttonVariants({ variant: 'ghost' }), "text-orange-400 bg-white/10 hover:text-orange-300 flex flex-col items-center justify-center h-auto p-2 gap-0.5 w-20")}>
                  <ShieldCheck className="h-7 w-7" />
                  <span className="text-xs font-medium">관리자</span>
              </Link>
          </nav>

          <div className="relative z-10 flex items-center gap-4">
              <LanguageSelect />
              <Button variant="ghost" className="h-8 px-3 text-slate-300 hover:bg-white/10 hover:text-white" onClick={() => router.push('/feedback')}>
                  <MessageSquareQuote className="h-4 w-4 mr-2" />
                  <span className="text-sm">{t('feedback')}</span>
              </Button>
              {user && (
                  <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-9 w-9 rounded-full p-0 hover:bg-white/10">
                              <Avatar className="h-9 w-9">
                                  <AvatarImage src={profile?.profilePictureUrl} alt={profile?.displayName} />
                                  <AvatarFallback>{profile?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                              </Avatar>
                          </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>{t('myAccount')}</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <div className="px-2 py-1.5 text-sm">
                              <p className="font-semibold truncate">{profile?.displayName || 'User'}</p>
                              <p className="text-muted-foreground truncate">{profile?.email}</p>
                          </div>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => router.push('/profile-setup')}>
                              <UserIcon className="mr-2 h-4 w-4" />
                              <span>{t('profileSettings')}</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleSignOut}>
                              <LogOut className="mr-2 h-4 w-4" />
                              <span>{t('logOut')}</span>
                          </DropdownMenuItem>
                      </DropdownMenuContent>
                  </DropdownMenu>
              )}
          </div>
      </header>

      <div className="flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
