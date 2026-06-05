
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase, useAuth } from '@/firebase';
import { doc, collection, query, where, getDoc, setDoc, updateDoc, serverTimestamp, documentId, onSnapshot } from 'firebase/firestore';
import { startOfToday, subDays, format, isValid, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday, isSameDay, getDay, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { signOut } from 'firebase/auth';
import type { DayData, ScheduleItem, UserProfile, Person, TimeStewardSegment, QTEntry, DiaryData } from '@/lib/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import TimePicker from '@/app/journal/components/TimePicker';
import LoadingSpinner from '@/components/LoadingSpinner';
import TimeStewardDialog from './components/TimeStewardDialog';
import TimeStewardChart from './components/TimeStewardChart';
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
    Plus,
    Trash2,
    ChevronLeft,
    ChevronRight,
    BookOpen,
    NotebookText,
    PartyPopper,
    Moon,
    Edit,
    Save,
    X,
    Hourglass,
    ShieldCheck,
    Shapes,
    Pencil,
    ExternalLink
} from 'lucide-react';
import { enUS, ko, es, ja, vi, zhCN, pt, fr, de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import lunisolar from 'lunisolar';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SpiritualWave } from '@/components/ui/spiritual-wave';
import { useTranslation } from '@/hooks/use-translation';
import LanguageSelect from '@/components/language-select';

const dateLocales: Record<string, any> = {
  en: enUS, ko, es, ja, vi, zh: zhCN, pt, fr, de,
};

const sortScheduleItems = (items: ScheduleItem[]): ScheduleItem[] => {
    const parseTime = (timeStr: string): number => {
        try {
            const parts = timeStr.split(' ');
            if (parts.length < 2) return 9999;
            const [period, time] = parts;
            let [hours, minutes] = time.split(':').map(Number);
            if (isNaN(hours) || isNaN(minutes)) return 9999;
            if (period === '오후' && hours !== 12) hours += 12;
            if (period === '오전' && hours === 12) hours = 0;
            return hours * 60 + minutes;
        } catch (e) { return 9999; }
    };
    return [...items].sort((a, b) => parseTime(a.time) - parseTime(b.time));
};

const INITIAL_QT: QTEntry = {
  title: '', passage: '', analyzedPassage: '', myMeditation: '', meditationGuide: '',
  verses: '', analysis: '', paragraphs: [], questions: [], questionAnswers: [],
  keyVerses: [], evaluation: '', missionTasks: [],
};

const INITIAL_DIARY: DiaryData = {
  dailyCheck: { closenessToGod: 5, relationships: 5, innerPeace: 5, senseOfPurpose: 5, thankfulness: 5 },
  reflection: {
    dailySummary: '', godExperience: '', hardestMoment: '',
    obedienceRepentance: '', missionAlignment: '', missionAlignmentChoice: '',
    gratitudeJournal: '', gratitudeJournalAudioUrl: '', dailyAiReflection: '',
  },
  prayers: [], todaysSchedule: [], gratitudes: [], timeSteward: [],
};

const getInitialDay = (date: string): DayData => ({
    date,
    qt: { ...INITIAL_QT },
    diary: {
        ...INITIAL_DIARY,
        dailyCheck: { ...INITIAL_DIARY.dailyCheck },
        reflection: { ...INITIAL_DIARY.reflection },
        prayers: [], todaysSchedule: [], gratitudes: [], timeSteward: [],
    },
    completed: false,
    diaryCompleted: false,
});

export default function CalendarPage() {
    const router      = useRouter();
    const searchParams = useSearchParams();
    const pathname    = usePathname();
    const { user, profile } = useUser();
    const auth        = useAuth();
    const firestore   = useFirestore();
    const { toast }   = useToast();
    const { t, lang } = useTranslation();
    const currentLocale = useMemo(() => dateLocales[lang] || enUS, [lang]);

    const initialDateISO = searchParams.get('date');
    const initialDate = initialDateISO && isValid(new Date(initialDateISO))
        ? new Date(initialDateISO) : new Date();

    const [view,              setView]              = useState<'month' | 'week' | 'day'>('month');
    const [selectedDate,      setSelectedDate]      = useState<Date>(initialDate);
    const [displayMonth,      setDisplayMonth]      = useState<Date>(startOfMonth(initialDate));
    const [dayDataMap,        setDayDataMap]        = useState<Map<string, { schedules: ScheduleItem[], completed: boolean, diaryCompleted: boolean }>>(new Map());
    const [isLoading,         setIsLoading]         = useState(true);
    const [newScheduleContent,setNewScheduleContent]= useState('');
    const [newScheduleTime,   setNewScheduleTime]   = useState('오전 09:00');
    const [showLunarCalendar, setShowLunarCalendar] = useState(false);
    const [showTimeStewardDialog, setShowTimeStewardDialog] = useState(false);
    const [editingSchedule,   setEditingSchedule]   = useState<ScheduleItem | null>(null);

    const userDocRef = useMemoFirebase(
        () => user ? doc(firestore, 'users', user.uid) : null,
        [firestore, user],
    );
    const { data: userProfile } = useDoc<UserProfile>(userDocRef);

    const peoplesCollectionRef = useMemoFirebase(
        () => user ? collection(firestore, 'users', user.uid, 'peoples') : null,
        [user, firestore],
    );
    const peoplesWithBirthdayQuery = useMemoFirebase(
        () => peoplesCollectionRef
            ? query(peoplesCollectionRef, where('birthDate', '!=', ''), where('showBirthdayOnCalendar', '==', true))
            : null,
        [peoplesCollectionRef],
    );
    const { data: peoples } = useCollection<Person>(peoplesWithBirthdayQuery);

    const selectedDayJournalRef = useMemoFirebase(
        () => user ? doc(firestore, 'users', user.uid, 'journal', format(selectedDate, 'yyyy-MM-dd')) : null,
        [user, firestore, selectedDate],
    );
    const { data: selectedDayData } = useDoc<DayData>(selectedDayJournalRef);

    const dayDataForDialog = useMemo(() => {
        const dateStr    = format(selectedDate, 'yyyy-MM-dd');
        const defaultDay = getInitialDay(dateStr);
        if (!selectedDayData) return defaultDay;
        return {
            ...defaultDay, ...selectedDayData,
            qt: { ...defaultDay.qt, ...(selectedDayData.qt || {}) },
            diary: {
                ...defaultDay.diary,
                ...(selectedDayData.diary || {}),
                dailyCheck:      { ...defaultDay.diary.dailyCheck,  ...(selectedDayData.diary?.dailyCheck  || {}) },
                reflection:      { ...defaultDay.diary.reflection,   ...(selectedDayData.diary?.reflection  || {}) },
                prayers:         selectedDayData.diary?.prayers         || [],
                todaysSchedule:  selectedDayData.diary?.todaysSchedule  || [],
                gratitudes:      selectedDayData.diary?.gratitudes       || [],
                timeSteward:     selectedDayData.diary?.timeSteward      || [],
            },
        };
    }, [selectedDate, selectedDayData]);

    const selectedDateSchedules = useMemo(() => {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        return dayDataMap.get(dateStr)?.schedules || [];
    }, [selectedDate, dayDataMap]);

    const todayForQuery   = useMemo(() => startOfToday(), []);
    const sevenDaysAgo    = useMemo(() => format(subDays(todayForQuery, 6), 'yyyy-MM-dd'), [todayForQuery]);
    const dateString      = useMemo(() => format(todayForQuery, 'yyyy-MM-dd'), [todayForQuery]);

    const recentJournalQuery = useMemoFirebase(
        () => user ? query(
            collection(firestore, 'users', user.uid, 'journal'),
            where(documentId(), '>=', sevenDaysAgo),
            where(documentId(), '<=', dateString),
        ) : null,
        [user, firestore, sevenDaysAgo, dateString],
    );
    const { data: recentJournals } = useCollection<DayData>(recentJournalQuery);

    const waveActivityLevel = useMemo(() => {
        if (!recentJournals) return 0;
        const today = startOfToday();
        let count = 0;
        for (let i = 0; i < 7; i++) {
            const dateStr = format(subDays(today, i), 'yyyy-MM-dd');
            const d = recentJournals.find(j => j.id === dateStr);
            if (d?.completed && d?.diaryCompleted) count++;
        }
        return count / 7;
    }, [recentJournals]);

    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(displayMonth);
        const startDate  = startOfWeek(monthStart, { locale: currentLocale });
        const endDate    = endOfWeek(endOfMonth(displayMonth), { locale: currentLocale });
        return eachDayOfInterval({ start: startDate, end: endDate });
    }, [displayMonth, currentLocale]);

    const weekDays = useMemo(() => {
        const start = startOfWeek(selectedDate, { locale: currentLocale });
        return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
    }, [selectedDate, currentLocale]);

    const allEventsMap = useMemo(() => {
        const merged = new Map<string, ({ title: string; type: 'anniversary' } | { title: string; type: 'birthday' })[]>();
        if (userProfile?.anniversaries) {
            userProfile.anniversaries.forEach(anniv => {
                const s = anniv.date;
                if (!merged.has(s)) merged.set(s, []);
                merged.get(s)!.push({ title: anniv.title, type: 'anniversary' });
            });
        }
        if (peoples) {
            peoples.forEach(p => {
                if (p.birthDate) {
                    if (!merged.has(p.birthDate)) merged.set(p.birthDate, []);
                    merged.get(p.birthDate)!.push({ title: `${p.name} 생일`, type: 'birthday' });
                }
            });
        }
        return merged;
    }, [userProfile?.anniversaries, peoples]);

    useEffect(() => {
        if (!user || !firestore) { setIsLoading(false); return; }
        setIsLoading(true);
        const journalRef = collection(firestore, 'users', user.uid, 'journal');
        let startDate: Date, endDate: Date;
        if (view === 'month') {
            startDate = startOfWeek(startOfMonth(displayMonth), { locale: currentLocale });
            endDate   = endOfWeek(endOfMonth(displayMonth),   { locale: currentLocale });
        } else {
            startDate = startOfWeek(selectedDate, { locale: currentLocale });
            endDate   = endOfWeek(selectedDate,   { locale: currentLocale });
        }
        const q = query(journalRef,
            where(documentId(), '>=', format(startDate, 'yyyy-MM-dd')),
            where(documentId(), '<=', format(endDate,   'yyyy-MM-dd')),
        );
        const unsub = onSnapshot(q, snapshot => {
            const newDayMap = new Map<string, { schedules: ScheduleItem[], completed: boolean, diaryCompleted: boolean }>();
            snapshot.forEach(doc => {
                const data = doc.data() as DayData;
                newDayMap.set(doc.id, {
                    schedules: sortScheduleItems(data.diary?.todaysSchedule || []),
                    completed: !!data.completed,
                    diaryCompleted: !!data.diaryCompleted
                });
            });
            setDayDataMap(newDayMap);
            setIsLoading(false);
        }, () => setIsLoading(false));
        return () => unsub();
    }, [user, firestore, displayMonth, selectedDate, view, currentLocale]);

    const handleScheduleUpdate = async (date: Date, newSegs: ScheduleItem[]) => {
        if (!user || !firestore) return;
        const dateStr = format(date, 'yyyy-MM-dd');
        const ref = doc(firestore, 'users', user.uid, 'journal', dateStr);
        try {
            const snap = await getDoc(ref);
            if (snap.exists()) await updateDoc(ref, { 'diary.todaysSchedule': newSegs, updatedAt: serverTimestamp() });
            else { const nd = getInitialDay(dateStr); nd.diary.todaysSchedule = newSegs; await setDoc(ref, { ...nd, updatedAt: serverTimestamp() }); }
        } catch { toast({ variant: 'destructive', title: 'Error' }); }
    };

    const handleTimeStewardUpdate = async (newSegs: TimeStewardSegment[]) => {
        if (!user || !firestore) return;
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const ref = doc(firestore, 'users', user.uid, 'journal', dateStr);
        try {
            const snap = await getDoc(ref);
            if (snap.exists()) await updateDoc(ref, { 'diary.timeSteward': newSegs, updatedAt: serverTimestamp() });
            else { const nd = getInitialDay(dateStr); nd.diary.timeSteward = newSegs; await setDoc(ref, { ...nd, updatedAt: serverTimestamp() }); }
            toast({ title: t('save') });
        } catch { toast({ variant: 'destructive', title: 'Error' }); }
    };

    const addSchedule = async () => {
        if (!newScheduleContent.trim()) return;
        const item: ScheduleItem = { id: Date.now().toString(), time: newScheduleTime, content: newScheduleContent.trim() };
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const currentData = dayDataMap.get(dateStr);
        await handleScheduleUpdate(selectedDate, sortScheduleItems([...(currentData?.schedules || []), item]));
        setNewScheduleContent('');
        toast({ title: t('peoples_addSuccess') });
    };

    const deleteSchedule = async (id: string) => {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const currentData = dayDataMap.get(dateStr);
        await handleScheduleUpdate(selectedDate, (currentData?.schedules || []).filter(i => i.id !== id));
        toast({ title: t('peoples_deleteSuccess'), variant: "destructive" });
    };

    const handleSaveEdit = async () => {
        if (!editingSchedule) return;
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const currentData = dayDataMap.get(dateStr);
        await handleScheduleUpdate(selectedDate, sortScheduleItems((currentData?.schedules || []).map(s => s.id === editingSchedule.id ? editingSchedule : s)));
        setEditingSchedule(null);
        toast({ title: t('peoples_updateSuccess') });
    };

    const handleDateChange = (amount: number) => {
        if (view === 'month') setDisplayMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + amount, 1));
        else setSelectedDate(prev => addDays(prev, amount * (view === 'week' ? 7 : 1)));
    };

    const handleSignOut = async () => {
        if (!auth) return;
        await signOut(auth);
        router.push('/');
    };

    const todaysEvents = allEventsMap.get(format(selectedDate, 'yyyy-MM-dd')) || [];

    const isSuperAdmin = useMemo(() =>
        user?.email === 'darak303@naver.com' ||
        user?.uid === '4PYWOqRk1dXhVt5NXe5DZq7Fa4Q2' ||
        user?.uid === 'aRCEGOfj0lgkOES0KLywQwbsjLX2' ||
        profile?.isAdmin === true,
    [user, profile]);

    const isOrgAdmin = useMemo(() =>
        isSuperAdmin || profile?.isGroupAdmin ||
        (profile?.memberships && profile.memberships.some(m => m.role === 'admin')),
    [isSuperAdmin, profile]);

    const timeStewardSegs = dayDataForDialog.diary?.timeSteward || [];
    const hasTimeSteward  = timeStewardSegs.length > 0;

    return (
        <div className="h-screen w-screen bg-[#2e2848] flex flex-col font-sans">
            <header className="relative w-full bg-[#2e2848] backdrop-blur-sm py-2 px-10 shadow-sm flex items-center justify-between gap-3 overflow-hidden shrink-0">
                <SpiritualWave activityLevel={waveActivityLevel} className="opacity-40 z-0" />
                <div className="relative z-10 flex flex-col border-r border-slate-600 pr-4">
                    <h1 className="text-xl font-black tracking-tighter flex items-center font-sans">
                        <span className="text-primary">Word</span><span className="mx-1 text-white">N</span><span className="text-accent">Walks</span>
                    </h1>
                    <p className="text-[10px] font-light text-slate-300 -mt-1 tracking-tight">Walk with the Word.</p>
                </div>
                <nav className="relative z-10 flex-1 flex justify-center items-center gap-2">
                    {[
                        { href: '/journal',     icon: <Home className="h-7 w-7" />,        label: t('home') },
                        { href: '/peoples',     icon: <Users className="h-7 w-7" />,       label: t('peoples') },
                        { href: '/calendar',    icon: <CalendarDays className="h-7 w-7" />,label: t('schedule') },
                        { href: '/stats',       icon: <FilePenLine className="h-7 w-7" />, label: t('reports') },
                        { href: '/prayer-room', icon: <Hand className="h-7 w-7" />,        label: t('prayers') },
                        { href: '/forum',       icon: <MessageSquare className="h-7 w-7" />,label: t('forum') },
                        { href: '/groups',      icon: <Shapes className="h-7 w-7" />,      label: t('groups') },
                    ].map(({ href, icon, label }) => (
                        <Link key={href} href={href} className={cn(
                            buttonVariants({ variant: 'ghost' }),
                            pathname === href ? 'text-white bg-white/10' : 'text-slate-300 hover:bg-white/10 hover:text-white',
                            'flex flex-col items-center justify-center h-auto p-2 gap-0.5 w-20',
                        )}>
                            {icon}<span className="text-xs font-medium">{label}</span>
                        </Link>
                    ))}
                    {isSuperAdmin ? (
                        <Link href="/admin" className={cn(buttonVariants({ variant: 'ghost' }), 'text-orange-400 hover:bg-white/10 hover:text-orange-300 flex flex-col items-center justify-center h-auto p-2 gap-0.5 w-20')}>
                            <ShieldCheck className="h-7 w-7" /><span className="text-xs font-medium">관리자</span>
                        </Link>
                    ) : isOrgAdmin ? (
                        <Link href="/org-admin" className={cn(buttonVariants({ variant: 'ghost' }), 'text-orange-400 hover:bg-white/10 hover:text-orange-300 flex flex-col items-center justify-center h-auto p-2 gap-0.5 w-20')}>
                            <ShieldCheck className="h-7 w-7" /><span className="text-xs font-medium">{t('groups_adminCenter')}</span>
                        </Link>
                    ) : null}
                </nav>
                <div className="relative z-10 flex items-center gap-4">
                    <LanguageSelect />
                    <Button variant="ghost" className="h-8 px-3 text-slate-300 hover:bg-white/10 hover:text-white" onClick={() => router.push('/feedback')}>
                        <MessageSquareQuote className="h-4 w-4 mr-2" /><span className="text-sm">{t('feedback')}</span>
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
                                    <UserIcon className="mr-2 h-4 w-4" /><span>{t('profileSettings')}</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleSignOut}>
                                    <LogOut className="mr-2 h-4 w-4" /><span>{t('logOut')}</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </header>

            <main className="flex-1 bg-background p-6 min-h-0 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                        <Button variant="ghost" size="icon" onClick={() => handleDateChange(-1)}><ChevronLeft /></Button>
                        <h1 className="text-2xl font-bold">
                            {view === 'month'
                                ? format(displayMonth, 'yyyy. MM', { locale: currentLocale })
                                : view === 'week'
                                ? `${format(startOfWeek(selectedDate, { locale: currentLocale }), 'M. d', { locale: currentLocale })} - ${format(endOfWeek(selectedDate, { locale: currentLocale }), 'M. d', { locale: currentLocale })}`
                                : format(selectedDate, 'yyyy. MM. dd (eee)', { locale: currentLocale })}
                        </h1>
                        <Button variant="ghost" size="icon" onClick={() => handleDateChange(1)}><ChevronRight /></Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant={showLunarCalendar ? 'secondary' : 'ghost'} size="icon" onClick={() => setShowLunarCalendar(p => !p)}><Moon /></Button>
                        <Button variant="ghost" size="icon" onClick={() => router.push('/anniversary')}><PartyPopper /></Button>
                        <Tabs value={view} onValueChange={v => setView(v as 'month' | 'week' | 'day')}>
                            <TabsList>
                                <TabsTrigger value="month">{t('stats_monthlyReport').split(' ')[0]}</TabsTrigger>
                                <TabsTrigger value="week">{t('stats_weeklyReport').split(' ')[0]}</TabsTrigger>
                                <TabsTrigger value="day">{t('stats_dailyReport').split(' ')[0]}</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_340px] gap-4 min-h-0">
                    <div className="flex flex-col gap-4">
                    {view === 'month' && (
                            <Card className="flex-1 flex flex-col bg-card">
                                <div className="p-4 flex flex-col h-full">
                                    <div className="grid grid-cols-7 text-center font-semibold text-sm text-muted-foreground pb-2">
                                        {['SUN','MON','TUE','WED','THU','FRI','SAT'].map((d, i) => (
                                            <div key={d} className={cn('py-1', i === 0 && 'text-red-600', i === 6 && 'text-blue-600')}>{d}</div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-7 auto-rows-fr gap-1 flex-1 min-h-0">
                                        {calendarDays.map(day => {
                                            const dow       = getDay(day);
                                            const dayKey    = format(day, 'yyyy-MM-dd');
                                            const dayMeta   = dayDataMap.get(dayKey);
                                            const daySegs   = dayMeta?.schedules || [];
                                            const dayEvents = allEventsMap.get(dayKey) || [];
                                            
                                            return (
                                                <div 
                                                    key={day.toString()} 
                                                    onClick={() => setSelectedDate(day)}
                                                    className={cn(
                                                        'p-1.5 rounded-md text-left transition-colors shadow-sm border bg-background cursor-pointer flex flex-col overflow-hidden min-h-0', 
                                                        !isSameMonth(day, displayMonth) && 'bg-muted/40 text-muted-foreground',
                                                        isToday(day)                    && 'bg-accent/30',
                                                        isSameDay(day, selectedDate)    && 'ring-2 ring-primary ring-offset-1',
                                                        'hover:bg-accent/50',
                                                    )}
                                                >
                                                    <div className="flex justify-between items-start mb-0.5">
                                                        <div className="flex flex-col gap-0.5">
                                                            <div 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    router.push(`/journal?date=${dayKey}`);
                                                                }}
                                                                className={cn(
                                                                    'text-sm font-black h-7 w-7 flex items-center justify-center rounded-full hover:bg-primary/10 transition-colors',
                                                                    dow === 0 && 'text-red-600', 
                                                                    dow === 6 && 'text-blue-600', 
                                                                    !isSameMonth(day, displayMonth) && 'opacity-50',
                                                                    isToday(day) && 'bg-primary text-white hover:bg-primary/90'
                                                                )}
                                                            >
                                                                {format(day, 'd')}
                                                            </div>
                                                            {showLunarCalendar && (
                                                                <span className="text-[9px] text-muted-foreground opacity-70 pl-1">
                                                                    {lunisolar(day).lunar.month}.{lunisolar(day).lunar.day}
                                                                </span>
                                                            )}
                                                        </div>
                                                        
                                                        <div className="flex gap-1 pt-1.5">
                                                            {dayMeta?.completed && (
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <div className="h-2 w-2 rounded-full bg-orange-600 shadow-sm animate-in fade-in" title="말씀 묵상 완료" />
                                                                        </TooltipTrigger>
                                                                        <TooltipContent><p>말씀 묵상 완료</p></TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            )}
                                                            {dayMeta?.diaryCompleted && (
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <div className="h-2 w-2 rounded-full bg-purple-700 shadow-sm animate-in fade-in" title="삶의 기록 완료" />
                                                                        </TooltipTrigger>
                                                                        <TooltipContent><p>삶의 기록 완료</p></TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex-1 space-y-0.5 overflow-y-auto no-scrollbar min-h-0">
                                                        {dayEvents.map((ev, idx) => (
                                                            <div key={`ev-${idx}`} className={cn(
                                                                'text-[9px] rounded-sm px-1 truncate flex items-center gap-0.5',
                                                                ev.type === 'anniversary' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800',
                                                            )}>
                                                                {ev.type === 'anniversary' ? <PartyPopper className="h-2 w-2 shrink-0" /> : '🎂'}
                                                                <span className="flex-1 truncate font-medium">{ev.title}</span>
                                                            </div>
                                                        ))}
                                                        {daySegs.slice(0, 3 - dayEvents.length).map(s => (
                                                            <div key={s.id} className="text-[9px] bg-primary/10 rounded-sm px-1 truncate flex items-center gap-0.5">
                                                                <span className="font-bold text-[8px]">{s.time.split(' ')[0]}</span>
                                                                <span className="opacity-80 text-[8px]">{s.time.split(' ')[1]}</span>
                                                                <span className="flex-1 truncate">{s.content}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </Card>
                        )}

                        {view === 'week' && (
                            <Card className="flex-1 flex flex-col bg-card overflow-hidden">
                                <div className="grid grid-cols-7 text-center font-semibold text-sm text-muted-foreground sticky top-0 bg-card z-10 border-b">
                                    {weekDays.map(day => (
                                        <div key={day.toISOString()} onClick={() => setSelectedDate(day)}
                                            className={cn('py-2 cursor-pointer border-r last:border-r-0',
                                                getDay(day) === 0 && 'text-red-600',
                                                getDay(day) === 6 && 'text-blue-600',
                                                isSameDay(day, selectedDate) && 'bg-accent text-accent-foreground rounded-t-md',
                                            )}>
                                            <span className="text-lg font-bold">{format(day, 'd')}</span>
                                            <span className="text-xs ml-1">{format(day, 'eee', { locale: currentLocale })}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex-1 relative">
                                    <div className="absolute inset-0 grid grid-cols-7 pointer-events-none">
                                        {Array.from({ length: 7 }).map((_, i) => (
                                            <div key={i} className={i < 6 ? 'border-r' : ''} />
                                        ))}
                                    </div>
                                    <ScrollArea className="absolute inset-0">
                                        <div className="grid grid-cols-7">
                                            {weekDays.map(day => {
                                                const dayKey    = format(day, 'yyyy-MM-dd');
                                                const dayMeta   = dayDataMap.get(dayKey);
                                                const daySegs   = dayMeta?.schedules || [];
                                                const dayEvents = allEventsMap.get(dayKey) || [];
                                                return (
                                                    <div key={day.toISOString()} className="p-2 space-y-2">
                                                        {dayEvents.map((ev, idx) => (
                                                            <div key={idx} className={cn('p-2 rounded-lg text-left',
                                                                ev.type === 'anniversary' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800',
                                                            )}>
                                                                <p className="font-semibold text-xs text-black/70">{ev.title}</p>
                                                            </div>
                                                        ))}
                                                        {daySegs.map(s => (
                                                            <div key={s.id} className="bg-primary/10 p-2 rounded-lg text-left">
                                                                <p className="font-semibold text-xs text-primary">{s.time}</p>
                                                                <p className="text-sm break-words">{s.content}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </ScrollArea>
                                </div>
                            </Card>
                        )}

                        {view === 'day' && (
                            <Card className="flex-1 bg-card overflow-hidden border-none shadow-none">
                                <ScrollArea className="h-full">
                                    <div className="p-6 space-y-6">
                                        <div className="grid md:grid-cols-2 gap-6">
                                            <div className="space-y-6">
                                                <Card
                                                    className="cursor-pointer hover:shadow-md transition-all hover:border-primary/40 group"
                                                    onClick={() => setShowTimeStewardDialog(true)}
                                                >
                                                    <CardHeader className="pb-2">
                                                        <div className="flex items-center justify-between">
                                                            <CardTitle className="flex items-center gap-2 text-base">
                                                                <Hourglass className="h-5 w-5" />
                                                                일정 기록
                                                            </CardTitle>
                                                            <span className="flex items-center gap-1 text-xs text-muted-foreground border rounded-full px-2 py-0.5 group-hover:bg-primary/10 group-hover:text-primary group-hover:border-primary/30 transition-colors">
                                                                <Pencil className="h-3 w-3" />편집
                                                            </span>
                                                        </div>
                                                        <CardDescription className="text-xs">
                                                            하루의 시간을 어떻게 사용했는지 기록하고 분석해보세요.
                                                        </CardDescription>
                                                    </CardHeader>
                                                    <CardContent
                                                        className="flex justify-center pb-4 pt-0"
                                                        onClick={e => e.stopPropagation()}
                                                    >
                                                        {hasTimeSteward ? (
                                                            <div
                                                                className="pointer-events-none"
                                                                style={{
                                                                    transform: 'scale(0.68)',
                                                                    transformOrigin: 'top center',
                                                                    height: 400,
                                                                    width: '100%',
                                                                    display: 'flex',
                                                                    justifyContent: 'center',
                                                                }}
                                                            >
                                                                <TimeStewardChart
                                                                    value={timeStewardSegs}
                                                                    onChange={() => {}}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2 w-full cursor-pointer h-[400px]"
                                                                onClick={() => setShowTimeStewardDialog(true)}
                                                            >
                                                                <Hourglass className="h-12 w-12 opacity-15" />
                                                                <p className="text-sm font-medium">일정 기록</p>
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            </div>

                                            <div className="space-y-6">
                                                <Card>
                                                    <CardHeader><CardTitle>{t('stats_spiritualStatus')}</CardTitle></CardHeader>
                                                    <CardContent className="flex justify-around items-center">
                                                        <div className="flex flex-col items-center gap-2">
                                                            <BookOpen className={cn('h-8 w-8', dayDataMap.get(format(selectedDate, 'yyyy-MM-dd'))?.completed ? 'text-green-500' : 'text-muted-foreground/50')} />
                                                            <span className={cn('text-xs font-semibold', dayDataMap.get(format(selectedDate, 'yyyy-MM-dd'))?.completed ? 'text-green-500' : 'text-muted-foreground')}>{t('meditation')}</span>
                                                        </div>
                                                        <div className="flex flex-col items-center gap-2">
                                                            <NotebookText className={cn('h-8 w-8', dayDataMap.get(format(selectedDate, 'yyyy-MM-dd'))?.diaryCompleted ? 'text-blue-500' : 'text-muted-foreground/50')} />
                                                            <span className={cn('text-xs font-semibold', dayDataMap.get(format(selectedDate, 'yyyy-MM-dd'))?.diaryCompleted ? 'text-blue-500' : 'text-muted-foreground')}>{t('dailyWalk')}</span>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                                <Card>
                                                    <CardHeader><CardTitle>{t('stats_wordAndMeditation')}</CardTitle></CardHeader>
                                                    <CardContent className="space-y-4 text-sm">
                                                        {selectedDayData?.qt?.passage ? (
                                                            <>
                                                                <div>
                                                                    <h4 className="font-semibold text-primary">{t('stats_passage')}</h4>
                                                                    <p className="text-muted-foreground">{selectedDayData.qt.passage}</p>
                                                                </div>
                                                                <div>
                                                                    <h4 className="font-semibold text-primary">{t('journal_meditationTitle')}</h4>
                                                                    <p className="text-muted-foreground">{selectedDayData.qt.title || '...'}</p>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <p className="text-muted-foreground text-xs italic">오늘 기록된 묵상이 없습니다.</p>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                                <Card>
                                                    <CardHeader><CardTitle>{t('stats_todaysPrayer')}</CardTitle></CardHeader>
                                                    <CardContent className="text-sm">
                                                        {(selectedDayData?.diary?.prayers || []).length > 0 ? (
                                                            <ul className="list-disc list-inside text-muted-foreground space-y-1">
                                                                {(selectedDayData!.diary!.prayers || []).map(p => <li key={p.id}>{p.title || '...'}</li>)}
                                                            </ul>
                                                        ) : (
                                                            <p className="text-muted-foreground text-xs italic">오늘 기록된 기도가 없습니다.</p>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                                <Card>
                                                    <CardHeader><CardTitle>{t('stats_todaysGratitude')}</CardTitle></CardHeader>
                                                    <CardContent className="text-sm">
                                                        {(selectedDayData?.diary?.gratitudes || []).length > 0 ? (
                                                            <ul className="list-disc list-inside text-muted-foreground space-y-1">
                                                                {(selectedDayData!.diary!.gratitudes || []).map(g => <li key={g.id}>{g.title || '...'}</li>)}
                                                            </ul>
                                                        ) : (
                                                            <p className="text-muted-foreground text-xs italic">오늘 기록된 감사가 없습니다.</p>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        </div>
                                    </div>
                                </ScrollArea>
                            </Card>
                        )}
                    </div>

                    <Card className="w-full flex flex-col">
                        <CardHeader className="shrink-0">
                            <CardTitle className="flex items-center justify-between">
                                <span>{format(selectedDate, 'yyyy. MM. dd (eee)', { locale: currentLocale })}</span>
                                <Button variant="ghost" size="icon" onClick={() => router.push(`/journal?date=${format(selectedDate, 'yyyy-MM-dd')}`)}>
                                    <ExternalLink className="h-4 w-4" />
                                </Button>
                            </CardTitle>
                            <CardDescription>{t('schedule')}</CardDescription>
                        </CardHeader>

                        <div className="px-4 py-3 border-y shrink-0">
                            <h4 className="text-sm font-semibold mb-2">일정 기록</h4>
                            <div className="flex items-center gap-2">
                                <div className="shrink-0 w-32">
                                    <TimePicker value={newScheduleTime} onChange={setNewScheduleTime} />
                                </div>
                                <Input value={newScheduleContent} onChange={e => setNewScheduleContent(e.target.value)} placeholder={t('journal_schedulePlaceholder')} className="flex-1" />
                                <Button onClick={addSchedule} size="icon" className="shrink-0" disabled={!newScheduleContent.trim()}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {todaysEvents.length > 0 && (
                            <div className="px-4 py-3 border-b shrink-0 space-y-2">
                                {todaysEvents.map((ev, idx) => (
                                    <div key={idx} className={cn(
                                        'flex items-center gap-3 p-3 rounded-lg border',
                                        ev.type === 'anniversary' ? 'bg-amber-100/70 border-amber-200' : 'bg-sky-100/70 border-sky-200',
                                    )}>
                                        {ev.type === 'anniversary'
                                            ? <PartyPopper className="h-5 w-5 text-amber-600 shrink-0" />
                                            : <span className="text-lg">🎂</span>}
                                        <span className={cn('font-semibold', ev.type === 'anniversary' ? 'text-amber-900' : 'text-sky-900')}>
                                            {ev.title}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex-1 flex flex-col min-h-0">
                            {isLoading && dayDataMap.size === 0 ? (
                                <div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>
                            ) : (
                                <ScrollArea className="flex-1">
                                    <div className="p-4 space-y-1">
                                        {selectedDateSchedules.length > 0 ? selectedDateSchedules.map(item => {
                                            const isEditing = editingSchedule?.id === item.id;
                                            return isEditing ? (
                                                <div key={item.id} className="py-1 px-2 rounded-md bg-primary/10 space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="shrink-0">
                                                            <TimePicker value={editingSchedule.time} onChange={time => setEditingSchedule(s => s ? { ...s, time } : null)} />
                                                        </div>
                                                        <Input value={editingSchedule.content} onChange={e => setEditingSchedule(s => s ? { ...s, content: e.target.value } : null)} autoFocus className="flex-1" />
                                                    </div>
                                                    <div className="flex justify-end gap-2">
                                                        <Button size="sm" variant="ghost" onClick={() => setEditingSchedule(null)}><X className="h-4 w-4 mr-1" />{t('cancel')}</Button>
                                                        <Button size="sm" onClick={handleSaveEdit}><Save className="h-4 w-4 mr-1" />{t('save')}</Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div key={item.id} className="flex items-center group bg-muted/50 rounded-md">
                                                    <span className="font-sans text-sm font-semibold w-24 text-right px-2">{item.time}</span>
                                                    <p className="flex-1 text-sm font-sans truncate py-2 pr-2">{item.content}</p>
                                                    <div className="flex items-center">
                                                        <Button onClick={() => setEditingSchedule(item)} size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0"><Edit className="h-4 w-4" /></Button>
                                                        <Button onClick={() => deleteSchedule(item.id)} size="icon" variant="ghost" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 shrink-0"><Trash2 className="h-4 w-4" /></Button>
                                                    </div>
                                                </div>
                                            );
                                        }) : (
                                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-40">
                                                <CalendarDays className="h-10 w-10 mb-2" />
                                                <p className="text-sm font-medium">등록된 일정이 없습니다.</p>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            )}
                        </div>
                    </Card>
                </div>

                {showTimeStewardDialog && (
                    <TimeStewardDialog
                        dayData={dayDataForDialog}
                        onClose={() => setShowTimeStewardDialog(false)}
                        onSave={handleTimeStewardUpdate}
                    />
                )}
            </main>
        </div>
    );
}
