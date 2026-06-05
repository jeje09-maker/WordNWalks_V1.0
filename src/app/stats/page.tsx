
'use client';

import React, { useState, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Home, Users, CalendarDays, MessageSquare, MessageSquareQuote, User as UserIcon, LogOut, FilePenLine, Hand,
  BookOpen, Heart, CheckCircle2, XCircle, Circle, ThumbsUp, BrainCircuit, Droplets, Target, ChevronLeft, ChevronRight, ShieldCheck,
  Shapes
} from 'lucide-react';
import { useUser, useAuth, useDoc, useMemoFirebase, useFirestore, useCollection } from '@/firebase';
import { doc, collection, query, where, documentId } from 'firebase/firestore';
import type { UserProfile, DayData, Person, SmallGroup } from '@/lib/types';
import { signOut } from 'firebase/auth';
import { format, startOfToday, addDays, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, getDaysInMonth, addMonths, subMonths, isSameDay, subDays } from 'date-fns';
import { enUS, ko, es, ja, vi, zhCN, pt, fr, de } from 'date-fns/locale';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
} from 'recharts';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SpiritualWave } from '@/components/ui/spiritual-wave';
import { useTranslation } from '@/hooks/use-translation';
import LanguageSelect from '@/components/language-select';

const dateLocales: Record<string, any> = {
  en: enUS,
  ko: ko,
  es: es,
  ja: ja,
  vi: vi,
  zh: zhCN,
  pt: pt,
  fr: fr,
  de: de,
};

const calculateOverallScore = (dayData: DayData | null | undefined): number => {
    if (!dayData) return 0;

    const hasQtContent = (dayData.qt?.myMeditation?.trim() ?? '').length > 0;
    const hasDiarySummary = (dayData.diary?.reflection?.dailySummary?.trim() ?? '').length > 0;
    const hasPrayers = (dayData.diary?.prayers?.length ?? 0) > 0;
    const hasGratitudes = (dayData.diary?.gratitudes?.length ?? 0) > 0;
    const isEntryStarted = hasQtContent || hasDiarySummary || hasPrayers || hasGratitudes || dayData.completed || dayData.diaryCompleted;
    
    if (!isEntryStarted) {
        return 0;
    }

    let score = 0;

    if (dayData.diary?.dailyCheck) {
        const { closenessToGod, relationships, innerPeace, senseOfPurpose, thankfulness } = dayData.diary.dailyCheck;
        const avgCheck = (closenessToGod + relationships + innerPeace + senseOfPurpose + thankfulness) / 5;
        score += (avgCheck / 10) * 3;
    }

    if (dayData.qt) {
        if (dayData.qt.passage) score += 0.5;
        if (dayData.qt.myMeditation && dayData.qt.myMeditation.length > 20) score += 1.5;
        if (dayData.qt.questionAnswers && dayData.qt.questionAnswers.some(a => a && a.trim() !== '')) score += 0.5;
        if (dayData.qt.evaluation) score += 0.5;
    }
    
    if (dayData.diary) {
        if (dayData.diary.reflection?.dailySummary && dayData.diary.reflection.dailySummary.length > 20) score += 0.5;
        if (dayData.diary.reflection?.godExperience && dayData.diary.reflection.godExperience.length > 10) score += 0.5;
        if (dayData.diary.reflection?.hardestMoment) score += 0.25;
        if (dayData.diary.reflection?.obedienceRepentance) score += 0.5;
        if (dayData.diary.reflection?.gratitudeJournal) score += 0.25;
        if (dayData.diary.prayers && dayData.diary.prayers.length > 0) score += 0.5;
        if (dayData.diary.gratitudes && dayData.diary.gratitudes.length > 0) score += 0.5;
        if (dayData.diary.peopleInteractions && dayData.diary.peopleInteractions.length > 0) score += 0.5;
    }
    
    if (dayData.completed) score += 0.25;
    if (dayData.diaryCompleted) score += 0.25;

    return parseFloat(Math.min(10, score).toFixed(1));
};


const DailyReport = ({ currentLocale }: { currentLocale: any }) => {
  const { user } = useUser();
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  
  const initialDate = searchParams.get('date') ? new Date(searchParams.get('date') as string) : startOfToday();
  const [date, setDate] = useState<Date>(initialDate);

  const dateString = useMemo(() => format(date, 'yyyy-MM-dd'), [date]);

  const dayDataRef = useMemoFirebase(
    () => user ? doc(firestore, 'users', user.uid, 'journal', dateString) : null,
    [user, firestore, dateString]
  );
  const { data: dayData, isLoading } = useDoc<DayData>(dayDataRef);

  const peoplesCollectionRef = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'peoples') : null, [user, firestore]);
  const { data: peoples } = useCollection<Person>(peoplesCollectionRef);

  const dailyCheckData = useMemo(() => {
    if (!dayData?.diary?.dailyCheck) return [];
    const { closenessToGod, relationships, innerPeace, senseOfPurpose, thankfulness } = dayData.diary.dailyCheck;
    return [
      { subject: t('stats_closeness'), value: closenessToGod, fullMark: 10 },
      { subject: t('stats_relationship'), value: relationships, fullMark: 10 },
      { subject: t('stats_peace'), value: innerPeace, fullMark: 10 },
      { subject: t('stats_purpose'), value: senseOfPurpose, fullMark: 10 },
      { subject: t('stats_gratitude'), value: thankfulness, fullMark: 10 },
    ];
  }, [dayData, t]);
  
  const overallScore = useMemo(() => calculateOverallScore(dayData), [dayData]);

  const missionTasks = dayData?.qt?.missionTasks || [];
  const completedMissions = missionTasks.filter(t => t.completed === 'yes').length;
  
  const changeDate = (amount: number) => setDate(prev => addDays(prev, amount));

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!dayData) {
    return (
      <div className="space-y-6">
         <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">{t('stats_dailyReport')}</h1>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => changeDate(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant={'outline'} className={cn("w-auto justify-start text-left font-normal")}>
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {date ? format(date, "yyyy.MM.dd (eee)", { locale: currentLocale }) : <span>{t('peoples_relationshipPlaceholder')}</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(d) => d && setDate(d)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Button variant="outline" size="icon" onClick={() => changeDate(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
          </div>
        <div className="text-center py-20 bg-muted/30 rounded-lg">
            <p className="text-lg font-semibold text-muted-foreground">{t('stats_noRecordTitle').replace('{date}', format(date, 'yyyy.MM.dd', { locale: currentLocale }))}</p>
            <p className="text-sm text-muted-foreground/80 mt-2">{t('stats_noRecordDesc')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('stats_dailyReport')}</h1>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => changeDate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={'outline'} className={cn("w-auto justify-start text-left font-normal")}>
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {date ? format(date, "yyyy.MM.dd (eee)", { locale: currentLocale }) : <span>{t('peoples_relationshipPlaceholder')}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="icon" onClick={() => changeDate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto">
        <Card className="lg:col-span-1 flex flex-col h-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BrainCircuit className="text-primary"/>{t('stats_spiritualStatus')}</CardTitle>
            <CardDescription>{t('stats_spiritualStatusDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center h-auto">
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={dailyCheckData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                <Radar name="DailyCheck" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.6} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
          <CardFooter className="flex-col items-center border-t pt-4 h-auto">
              <p className="text-sm text-muted-foreground">{t('stats_overallScore')}</p>
              <p className="text-4xl font-bold text-primary">{overallScore} <span className="text-lg font-medium text-muted-foreground">/ 10</span></p>
          </CardFooter>
        </Card>

        <Card className="lg:col-span-2 h-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BookOpen className="text-primary" />{t('stats_wordAndMeditation')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 h-auto">
             <div>
                <p className="text-sm font-semibold text-muted-foreground">{t('stats_passage')}</p>
                <p className="font-semibold">{dayData.qt.passage}</p>
             </div>
             {dayData.qt.evaluation && (
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">{t('stats_aiEvaluation')}</p>
                  <p className="text-sm bg-muted/50 p-3 rounded-md h-auto">{dayData.qt.evaluation}</p>
                </div>
             )}
             <div>
                <p className="text-sm font-semibold text-muted-foreground">{t('stats_todaysMission')} ({completedMissions}/{missionTasks.length})</p>
                <div className="space-y-2 mt-2 h-auto">
                    {missionTasks.length > 0 ? missionTasks.map((task, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm h-auto">
                        {task.completed === 'yes' ? <CheckCircle2 className="h-4 w-4 text-green-500"/> : task.completed === 'no' ? <XCircle className="h-4 w-4 text-destructive"/> : <Circle className="h-4 w-4 text-muted-foreground"/>}
                        <span className={cn(task.completed === 'no' && 'line-through text-muted-foreground')}>{task.question}</span>
                      </div>
                    )) : <p className="text-sm text-muted-foreground">{t('stats_noMission')}</p>}
                </div>
             </div>
          </CardContent>
        </Card>
      </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-auto">
            <Card className="h-auto">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Droplets className="text-primary"/>{t('stats_relationshipGod')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm h-auto">
                    {dayData.diary.reflection.godExperience ? (
                        <div className="h-auto">
                            <h4 className="font-semibold mb-1">{t('stats_momentExpGod')}</h4>
                            <p className="text-muted-foreground whitespace-pre-wrap h-auto">{dayData.diary.reflection.godExperience}</p>
                        </div>
                    ) : <p className="text-muted-foreground">{t('stats_noMomentExpGod')}</p>}
                    {dayData.diary.reflection.obedienceRepentance && (
                        <div className="h-auto">
                            <h4 className="font-semibold mb-1">{t('stats_obedienceRepentance')}</h4>
                            <p className="text-muted-foreground whitespace-pre-wrap h-auto">{dayData.diary.reflection.obedienceRepentance}</p>
                        </div>
                    )}
                </CardContent>
            </Card>
            <Card className="h-auto">
                 <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users className="text-primary"/>{t('stats_relationshipPeople')}</CardTitle>
                </CardHeader>
                <CardContent className="h-auto">
                    {dayData.diary.peopleInteractions && dayData.diary.peopleInteractions.length > 0 ? (
                        <ul className="space-y-2 h-auto">
                            {dayData.diary.peopleInteractions.map(interaction => {
                                const person = peoples?.find(p => p.id === interaction.personId);
                                return (
                                    <li key={interaction.id} className="text-sm h-auto">
                                        <span className="font-semibold">{person?.name || 'Unknown'}:</span>
                                        <span className="text-muted-foreground ml-2">{interaction.note}</span>
                                    </li>
                                )
                            })}
                        </ul>
                    ) : (
                        <p className="text-sm text-muted-foreground">{t('stats_noInteraction')}</p>
                    )}
                </CardContent>
            </Card>
       </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-auto">
            <Card className="h-auto">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Hand className="text-primary"/>{t('stats_todaysPrayer')}</CardTitle>
                </CardHeader>
                <CardContent className="h-auto">
                    {dayData.diary.prayers && dayData.diary.prayers.length > 0 ? (
                        <ul className="space-y-2 h-auto">
                            {dayData.diary.prayers?.map(p => (
                                <li key={p.id} className="text-sm text-muted-foreground list-disc list-inside h-auto">{p.title} ({p.status})</li>
                            ))}
                        </ul>
                    ) : <p className="text-sm text-muted-foreground">{t('stats_noPrayer')}</p>}
                </CardContent>
            </Card>
            <Card className="h-auto">
                 <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Heart className="text-primary"/>{t('stats_todaysGratitude')}</CardTitle>
                </CardHeader>
                <CardContent className="h-auto">
                     {dayData.diary.gratitudes && dayData.diary.gratitudes.length > 0 ? (
                        <ul className="space-y-2 h-auto">
                            {dayData.diary.gratitudes?.map(g => (
                                <li key={g.id} className="text-sm text-muted-foreground list-disc list-inside h-auto">{g.title}</li>
                            ))}
                        </ul>
                     ) : <p className="text-sm text-muted-foreground">{t('stats_noGratitude')}</p>}
                </CardContent>
            </Card>
       </div>
       
       {dayData.diary.reflection.dailyAiReflection && (
         <Card className="bg-gradient-to-br from-primary/90 to-primary text-primary-foreground h-auto">
              <CardHeader>
                  <CardTitle className="flex items-center gap-2"><ThumbsUp/>{t('stats_aiDailySummary')}</CardTitle>
              </CardHeader>
              <CardContent className="h-auto">
                  <p className="text-lg leading-relaxed h-auto">{dayData.diary.reflection.dailyAiReflection}</p>
              </CardContent>
          </Card>
       )}

    </div>
  )
}

const WeeklyReport = ({ currentLocale }: { currentLocale: any }) => {
  const { user } = useUser();
  const firestore = useFirestore();
  const { t } = useTranslation();
  const today = startOfToday();
  
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfToday() && startOfWeek(today, { weekStartsOn: 1 })); // Monday start

  const startDate = useMemo(() => format(currentWeekStart, 'yyyy-MM-dd'), [currentWeekStart]);
  const endDate = useMemo(() => format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), 'yyyy-MM-dd'), [currentWeekStart]);

  const weeklyJournalQuery = useMemoFirebase(
    () => user ? query(
        collection(firestore, 'users', user.uid, 'journal'),
        where(documentId(), '>=', startDate),
        where(documentId(), '<=', endDate)
    ) : null,
    [user, firestore, startDate, endDate]
  );
  const { data: weeklyJournals, isLoading } = useCollection<DayData>(weeklyJournalQuery);

  const weeklyStats = useMemo(() => {
    const weekDays = eachDayOfInterval({ start: currentWeekStart, end: new Date(endDate) });
    const journalMap = new Map(weeklyJournals?.map(j => [j.id, j]));

    let totalMissions = 0;
    let completedMissions = 0;
    let meditationDays = 0;
    let prayerCount = 0;
    let gratitudeCount = 0;

    const dailyScores = weekDays.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayData = journalMap.get(dayStr);

        if (dayData) {
            if (dayData.completed) meditationDays++;
            totalMissions += dayData.qt?.missionTasks?.length || 0;
            completedMissions += dayData.qt?.missionTasks?.filter(t => t.completed === 'yes').length || 0;
            prayerCount += dayData.diary?.prayers?.length || 0;
            gratitudeCount += dayData.diary?.gratitudes?.length || 0;
        }

        return {
            name: format(day, 'eee', { locale: currentLocale }),
            score: calculateOverallScore(dayData),
        };
    });

    const dailyCheckSums = { closenessToGod: 0, relationships: 0, innerPeace: 0, senseOfPurpose: 0, thankfulness: 0 };
    let daysWithCheckInData = 0;
    weeklyJournals?.forEach(journal => {
        if (journal.diary?.dailyCheck) {
            daysWithCheckInData++;
            dailyCheckSums.closenessToGod += journal.diary.dailyCheck.closenessToGod;
            dailyCheckSums.relationships += journal.diary.dailyCheck.relationships;
            dailyCheckSums.innerPeace += journal.diary.dailyCheck.innerPeace;
            dailyCheckSums.senseOfPurpose += journal.diary.dailyCheck.senseOfPurpose;
            dailyCheckSums.thankfulness += journal.diary.dailyCheck.thankfulness;
        }
    });

    const avgDailyCheck = daysWithCheckInData > 0 ? [
        { subject: t('stats_closeness'), value: parseFloat((dailyCheckSums.closenessToGod / daysWithCheckInData).toFixed(1)), fullMark: 10 },
        { subject: t('stats_relationship'), value: parseFloat((dailyCheckSums.relationships / daysWithCheckInData).toFixed(1)), fullMark: 10 },
        { subject: t('stats_peace'), value: parseFloat((dailyCheckSums.innerPeace / daysWithCheckInData).toFixed(1)), fullMark: 10 },
        { subject: t('stats_purpose'), value: parseFloat((dailyCheckSums.senseOfPurpose / daysWithCheckInData).toFixed(1)), fullMark: 10 },
        { subject: t('stats_gratitude'), value: parseFloat((dailyCheckSums.thankfulness / daysWithCheckInData).toFixed(1)), fullMark: 10 },
    ] : [];

    const missionSuccessRate = totalMissions > 0 ? Math.round((completedMissions / totalMissions) * 100) : 0;
    const weeklyAverageScore = dailyScores.reduce((acc, cur) => acc + cur.score, 0) / dailyScores.length;

    return { dailyScores, weeklyAverageScore, meditationDays, prayerCount, gratitudeCount, missionSuccessRate, avgDailyCheck, totalMissions };
  }, [weeklyJournals, currentWeekStart, endDate, currentLocale, t]);
  
  const weeklyInsight = useMemo(() => {
    if (!weeklyJournals || weeklyJournals.length < 2) {
      return t('stats_insightPlaceholder');
    }
    return t('stats_insightPlaceholder'); // Structuring dynamic multi-sentence insights requires complex i18n structure, using placeholder for MVP.
  }, [weeklyJournals, t]);


  const changeWeek = (amount: number) => {
    setCurrentWeekStart(prev => addDays(prev, amount * 7));
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">{t('stats_weeklyReport')}</h1>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => changeWeek(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-lg font-semibold w-52 text-center">
                    {format(currentWeekStart, "yyyy.MM.dd", { locale: currentLocale })} - {format(new Date(endDate), "MM.dd", { locale: currentLocale })}
                </div>
                <Button variant="outline" size="icon" onClick={() => changeWeek(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><BrainCircuit className="text-primary"/>{t('stats_weeklyScoreTrend')}</CardTitle>
                <CardDescription>{t('stats_weeklyScoreTrendDesc')} ({t('stats_overallScore')}: {weeklyStats.weeklyAverageScore.toFixed(1)})</CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={weeklyStats.dailyScores}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis domain={[0, 10]} />
                        <RechartsTooltip />
                        <Legend />
                        <Line type="monotone" dataKey="score" name={t('stats_overallScore')} stroke="hsl(var(--primary))" strokeWidth={2} activeDot={{ r: 8 }} />
                    </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-auto">
            <Card className="h-auto">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Target className="text-primary"/>{t('stats_weeklyTrainingSummary')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 h-auto">
                    <div className="h-auto">
                        <div className="flex justify-between items-center mb-1 h-auto">
                            <h4 className="font-semibold">{t('stats_meditationAchievement')}</h4>
                            <p className="text-sm font-bold">{weeklyStats.meditationDays} / 7</p>
                        </div>
                        <Progress value={(weeklyStats.meditationDays / 7) * 100} />
                    </div>
                    <div className="h-auto">
                        <h4 className="font-semibold mb-2">{t('stats_prayerAndGratitude')}</h4>
                        <div className="flex justify-around text-center h-auto">
                            <div className="h-auto">
                                <p className="text-2xl font-bold">{weeklyStats.prayerCount}</p>
                                <p className="text-sm text-muted-foreground">{t('stats_totalPrayer')}</p>
                            </div>
                            <div className="h-auto">
                                <p className="text-2xl font-bold">{weeklyStats.gratitudeCount}</p>
                                <p className="text-sm text-muted-foreground">{t('stats_totalGratitude')}</p>
                            </div>
                        </div>
                    </div>
                     <div className="h-auto">
                        <h4 className="font-semibold mb-2">{t('stats_missionSuccessRate')}</h4>
                         <div className="flex items-center gap-4 h-auto">
                            <div className="relative h-24 w-24">
                                <svg className="h-full w-full" viewBox="0 0 36 36">
                                    <path className="text-muted/20" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                                    <path className="text-primary" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${weeklyStats.missionSuccessRate}, 100`} />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-xl font-bold">{weeklyStats.missionSuccessRate}%</span>
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground h-auto">{t('stats_missionSuccessRateDesc').replace('{rate}', weeklyStats.missionSuccessRate.toString())}</p>
                         </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="h-auto">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Droplets className="text-primary"/>{t('stats_weeklyEmotionAnalysis')}</CardTitle>
                    <CardDescription>{t('stats_weeklyEmotionAnalysisDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="h-auto">
                    <ResponsiveContainer width="100%" height={280}>
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={weeklyStats.avgDailyCheck}>
                            <PolarGrid />
                            <PolarAngleAxis dataKey="subject" />
                            <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                            <Radar name="WeeklyAverage" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.6} />
                        </RadarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>

        <Card className="bg-gradient-to-br from-primary/90 to-primary text-primary-foreground h-auto">
              <CardHeader>
                  <CardTitle className="flex items-center gap-2"><ThumbsUp/>{t('stats_weeklyInsight')}</CardTitle>
              </CardHeader>
              <CardContent className="h-auto">
                  <p className="text-lg leading-relaxed h-auto">{weeklyInsight}</p>
              </CardContent>
          </Card>
    </div>
  );
}

const MonthlyReport = ({ currentLocale }: { currentLocale: any }) => {
    const { user } = useUser();
    const firestore = useFirestore();
    const { t } = useTranslation();
    const today = startOfToday();
    
    const [currentMonth, setCurrentMonth] = useState(startOfMonth(today));

    const startDate = useMemo(() => format(startOfMonth(currentMonth), 'yyyy-MM-dd'), [currentMonth]);
    const endDate = useMemo(() => format(endOfMonth(currentMonth), 'yyyy-MM-dd'), [currentMonth]);

    const monthlyJournalQuery = useMemoFirebase(
        () => user ? query(
            collection(firestore, 'users', user.uid, 'journal'),
            where(documentId(), '>=', startDate),
            where(documentId(), '<=', endDate)
        ) : null,
        [user, firestore, startDate, endDate]
    );
    const { data: monthlyJournals, isLoading } = useCollection<DayData>(monthlyJournalQuery);

    const monthlyStats = useMemo(() => {
        const monthDays = eachDayOfInterval({ start: new Date(startDate), end: new Date(endDate) });
        const journalMap = new Map(monthlyJournals?.map(j => [j.id, j]));

        let totalMissions = 0;
        let completedMissions = 0;
        let meditationDays = 0;
        let diaryDays = 0;
        let prayerCount = 0;
        let gratitudeCount = 0;

        const dailyScores = monthDays.map(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayData = journalMap.get(dayStr);

            if (dayData) {
                if (dayData.completed) meditationDays++;
                if (dayData.diaryCompleted) diaryDays++;
                totalMissions += dayData.qt?.missionTasks?.length || 0;
                completedMissions += dayData.qt?.missionTasks?.filter(t => t.completed === 'yes').length || 0;
                prayerCount += dayData.diary?.prayers?.length || 0;
                gratitudeCount += dayData.diary?.gratitudes?.length || 0;
            }

            return {
                name: format(day, 'd'),
                score: dayData ? calculateOverallScore(dayData) : null,
            };
        });
        
        const habitTrackerData = monthDays.map(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayData = journalMap.get(dayStr);
            return {
                date: day,
                meditation: !!dayData?.completed,
                diary: !!dayData?.diaryCompleted,
            }
        });

        const dailyCheckSums = { closenessToGod: 0, relationships: 0, innerPeace: 0, senseOfPurpose: 0, thankfulness: 0 };
        let daysWithCheckInData = 0;
        monthlyJournals?.forEach(journal => {
            if (journal.diary?.dailyCheck) {
                daysWithCheckInData++;
                dailyCheckSums.closenessToGod += journal.diary.dailyCheck.closenessToGod;
                dailyCheckSums.relationships += journal.diary.dailyCheck.relationships;
                dailyCheckSums.innerPeace += journal.diary.dailyCheck.innerPeace;
                dailyCheckSums.senseOfPurpose += journal.diary.dailyCheck.senseOfPurpose;
                dailyCheckSums.thankfulness += journal.diary.dailyCheck.thankfulness;
            }
        });

        const avgDailyCheck = daysWithCheckInData > 0 ? [
            { subject: t('stats_closeness'), value: parseFloat((dailyCheckSums.closenessToGod / daysWithCheckInData).toFixed(1)), fullMark: 10 },
            { subject: t('stats_relationship'), value: parseFloat((dailyCheckSums.relationships / daysWithCheckInData).toFixed(1)), fullMark: 10 },
            { subject: t('stats_peace'), value: parseFloat((dailyCheckSums.innerPeace / daysWithCheckInData).toFixed(1)), fullMark: 10 },
            { subject: t('stats_purpose'), value: parseFloat((dailyCheckSums.senseOfPurpose / daysWithCheckInData).toFixed(1)), fullMark: 10 },
            { subject: t('stats_gratitude'), value: parseFloat((dailyCheckSums.thankfulness / daysWithCheckInData).toFixed(1)), fullMark: 10 },
        ] : [];

        const missionSuccessRate = totalMissions > 0 ? Math.round((completedMissions / totalMissions) * 100) : 0;
        
        const validScores = dailyScores.filter(d => d.score !== null);
        const monthlyAverageScore = validScores.length > 0 ? validScores.reduce((acc, cur) => acc + (cur.score || 0), 0) / validScores.length : 0;

        return { dailyScores, habitTrackerData, monthlyAverageScore, meditationDays, diaryDays, prayerCount, gratitudeCount, missionSuccessRate, daysInMonth: monthDays.length };
    }, [monthlyJournals, startDate, endDate, t]);

    const changeMonth = (amount: number) => {
        setCurrentMonth(prev => amount > 0 ? addMonths(prev, 1) : subMonths(prev, 1));
    };

    if (isLoading) return <LoadingSpinner />;
    
    return (
         <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">{t('stats_monthlyReport')}</h1>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => changeMonth(-1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="text-lg font-semibold w-40 text-center">
                        {format(currentMonth, "yyyy.MM", { locale: currentLocale })}
                    </div>
                    <Button variant="outline" size="icon" onClick={() => changeMonth(1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><BrainCircuit className="text-primary"/>{t('stats_monthlyScoreTrend')}</CardTitle>
                    <CardDescription>{t('stats_monthlyScoreTrendDesc')} ({t('stats_overallScore')}: {monthlyStats.monthlyAverageScore.toFixed(1)})</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={monthlyStats.dailyScores}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis domain={[0, 10]} />
                            <RechartsTooltip />
                            <Legend />
                            <Line type="monotone" dataKey="score" name={t('stats_overallScore')} stroke="hsl(var(--primary))" strokeWidth={2} activeDot={{ r: 8 }} connectNulls />
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto">
                <Card className="lg:col-span-2 h-auto">
                    <CardHeader>
                        <CardTitle>{t('stats_monthlyCalendar')}</CardTitle>
                    </CardHeader>
                    <CardContent className="h-auto">
                        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground h-auto">
                            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => <div key={day}>{day}</div>)}
                        </div>
                        <div className="grid grid-cols-7 gap-1 mt-2 h-auto">
                            {Array.from({ length: startOfWeek(currentMonth).getDay() }).map((_, i) => <div key={`empty-${i}`} />)}
                            {monthlyStats.habitTrackerData.map(({date, meditation, diary}) => (
                                <TooltipProvider key={date.toString()}>
                                <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="aspect-square flex flex-col items-center justify-center border rounded-md p-1 cursor-help h-auto">
                                        <span className={cn("font-medium", isSameDay(date, new Date()) && "text-primary font-bold")}>{format(date, 'd')}</span>
                                        <div className="flex gap-0.5 mt-1 h-auto">
                                            <div className={cn("h-1.5 w-1.5 rounded-full", meditation ? "bg-green-500" : "bg-muted")}/>
                                            <div className={cn("h-1.5 w-1.5 rounded-full", diary ? "bg-blue-500" : "bg-muted")}/>
                                        </div>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{format(date, 'yyyy.MM.dd', { locale: currentLocale })}</p>
                                    <p>{t('stats_monthlyMeditation')}: {meditation ? t('journal_missionSuccess') : t('journal_missionFail')}</p>
                                    <p>{t('stats_monthlyDiary')}: {diary ? t('journal_missionSuccess') : t('journal_missionFail')}</p>
                                </TooltipContent>
                                </Tooltip>
                                </TooltipProvider>
                            ))}
                        </div>
                    </CardContent>
                </Card>
                <Card className="h-auto">
                    <CardHeader><CardTitle>{t('stats_monthlySummary')}</CardTitle></CardHeader>
                    <CardContent className="space-y-4 h-auto">
                        <div className="h-auto">
                            <p className="text-sm font-medium">{t('stats_monthlyMeditation')}</p>
                            <p className="text-2xl font-bold">{monthlyStats.meditationDays} <span className="text-sm font-normal text-muted-foreground">/ {monthlyStats.daysInMonth}</span></p>
                        </div>
                        <div className="h-auto">
                            <p className="text-sm font-medium">{t('stats_monthlyDiary')}</p>
                            <p className="text-2xl font-bold">{monthlyStats.diaryDays} <span className="text-sm font-normal text-muted-foreground">/ {monthlyStats.daysInMonth}</span></p>
                        </div>
                        <div className="h-auto">
                            <p className="text-sm font-medium">{t('stats_monthlyPrayerGratitude')}</p>
                            <p className="text-2xl font-bold">{monthlyStats.prayerCount} / {monthlyStats.gratitudeCount}</p>
                        </div>
                        <div className="h-auto">
                            <p className="text-sm font-medium">{t('stats_monthlyMissionRate')}</p>
                            <p className="text-2xl font-bold">{monthlyStats.missionSuccessRate}%</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
             <Card className="h-auto">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Droplets className="text-primary"/>{t('stats_weeklyEmotionAnalysis')}</CardTitle>
                    <CardDescription>{t('stats_weeklyEmotionAnalysisDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="h-auto">
                    <ResponsiveContainer width="100%" height={280}>
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={monthlyStats.avgDailyCheck}>
                            <PolarGrid />
                            <PolarAngleAxis dataKey="subject" />
                            <PolarRadiusAxis angle={30} domain={[0, 10]} />
                            <Radar name="MonthlyAverage" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.6} />
                             <RechartsTooltip />
                        </RadarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

             <Card className="bg-gradient-to-br from-primary/90 to-primary text-primary-foreground h-auto">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ThumbsUp/>{t('stats_monthlyInsight')}</CardTitle>
                </CardHeader>
                <CardContent className="h-auto">
                    <p className="text-lg leading-relaxed h-auto">
                        {t('stats_insightPlaceholder')}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}


export default function StatsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const activeReport = searchParams.get('report') || 'daily';
  const { user, profile } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { t, lang } = useTranslation();
  const currentLocale = useMemo(() => dateLocales[lang] || enUS, [lang]);

  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  const reportTypes = useMemo(() => [
    { id: 'daily', name: t('stats_dailyReport') },
    { id: 'weekly', name: t('stats_weeklyReport') },
    { id: 'monthly', name: t('stats_monthlyReport') },
    { id: 'quarterly', name: t('stats_quarterlyReport') },
    { id: 'yearly', name: t('stats_yearlyReport') },
    { id: 'long-term', name: t('stats_longTermReport') },
  ], [t]);

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

  const handleSignOut = async () => {
    if (!auth) return;
    await signOut(auth);
    router.push('/');
  };

  // Standardized isSuperAdmin and isOrgAdmin check
  const isSuperAdmin = useMemo(() => 
    user?.email === 'darak303@naver.com' || 
    user?.uid === '4PYWOqRk1dXhVt5NXe5DZq7Fa4Q2' || 
    user?.uid === 'aRCEGOfj0lgkOES0KLywQwbsjLX2' || 
    profile?.isAdmin === true,
  [user, profile]);

  const isOrgAdmin = useMemo(() => 
    isSuperAdmin || 
    profile?.isGroupAdmin || 
    (profile?.memberships && profile.memberships.some(m => m.role === 'admin')),
  [isSuperAdmin, profile]);

  const renderReportContent = () => {
    switch(activeReport) {
      case 'daily':
        return <DailyReport currentLocale={currentLocale} />;
      case 'weekly':
        return <WeeklyReport currentLocale={currentLocale} />;
      case 'monthly':
        return <MonthlyReport currentLocale={currentLocale} />;
      default:
        const report = reportTypes.find(r => r.id === activeReport);
        return (
          <Card className="h-auto">
            <CardHeader>
              <CardTitle>{report?.name || 'Reports'}</CardTitle>
            </CardHeader>
            <CardContent className="h-auto">
              <p className="text-muted-foreground h-auto">
                {t('stats_insightPlaceholder')}
              </p>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <div className="h-screen w-screen bg-[#2e2848] flex flex-col font-sans">
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
            
            {isSuperAdmin ? (
              <Link href="/admin" className={cn(buttonVariants({ variant: 'ghost' }), "text-orange-400 hover:bg-white/10 hover:text-orange-300 flex flex-col items-center justify-center h-auto p-2 gap-0.5 w-20")}>
                <ShieldCheck className="h-7 w-7" />
                <span className="text-xs font-medium">관리자</span>
              </Link>
            ) : isOrgAdmin ? (
              <Link href="/org-admin" className={cn(buttonVariants({ variant: 'ghost' }), "text-orange-400 hover:bg-white/10 hover:text-orange-300 flex flex-col items-center justify-center h-auto p-2 gap-0.5 w-20")}>
                <ShieldCheck className="h-7 w-7" />
                <span className="text-xs font-medium">{t('groups_adminCenter')}</span>
              </Link>
            ) : null}
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
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[200px_1fr] min-h-0 bg-background overflow-hidden">
        <aside className="border-r bg-muted/20 p-4 shrink-0 overflow-y-auto">
          <nav className="flex flex-col gap-2">
            {reportTypes.map((report) => (
              <Link
                key={report.id}
                href={`/stats?report=${report.id}`}
                className={cn(
                  'px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  activeReport === report.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                )}
              >
                {report.name}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1 min-h-0 overflow-y-auto">
            <div className="p-6">
                {renderReportContent()}
            </div>
        </main>
      </div>
    </div>
  );
}
