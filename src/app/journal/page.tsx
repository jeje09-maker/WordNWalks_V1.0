'use client';

import React, { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import Link from 'next/link';
import { useUser, useFirestore, useMemoFirebase, useDoc, useAuth, useCollection, setDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { doc, serverTimestamp, arrayUnion, collection, query, where, documentId, getDoc, updateDoc, increment, getDocs, writeBatch, orderBy, limit } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { signOut as firebaseSignOut } from 'firebase/auth';
import type { UserProfile, QTEntry, DiaryData, PrayerItem, DailyCheck, ReflectionData, ScheduleItem, GratitudeItem, ForumPost, Person, DayData, GlobalBibleSegment, ExpenditureItem, SmallGroup, PrayerPost, OrgDailyContent, OrgEvent, PhotoItem } from '@/lib/types';
import { PrayerStatus } from '@/lib/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardFooter, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import LoadingSpinner from '@/components/LoadingSpinner';
import { 
    ChevronLeft, ChevronRight, BookOpen, Plus, X, User as UserIcon, LogOut, 
    LoaderCircle, Trash2, Mic, Heart, MessageSquare, CalendarDays, 
    Home, Users, Share2, RefreshCw, UserPlus, Send, Hand, ArrowLeft, 
    ShieldCheck, Megaphone, FilePenLine, Coins, Sparkles, Target, Droplets, Building,
    MessageSquareQuote, Check, Calendar as CalendarIcon, Clock, Info, Image as ImageIcon,
    Shapes, Camera
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, startOfToday, isValid, subDays, addDays, isAfter, isBefore, parseISO, startOfDay, isSameDay } from 'date-fns';
import { enUS, ko } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipProvider,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from '@/components/ui/separator';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import PrayerFeedbackDialog from './components/PrayerFeedbackDialog';
import GratitudeFeedbackDialog from './components/GratitudeFeedbackDialog';
import TimePicker from './components/TimePicker';
import { transcribeAudioAction, evaluateMeditationAction, generateBibleSegmentContentAction, recommendPassageAction } from './actions';
import { reflectOnDay as reflectOnDayFlow } from '@/ai/flows/daily-reflection-flow';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { OLD_TESTAMENT_BOOKS, NEW_TESTAMENT_BOOKS } from '@/lib/bible-books';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslation } from '@/hooks/use-translation';
import { languages } from '@/lib/i18n';
import { SpiritualWave } from '@/components/ui/spiritual-wave';
import LanguageSelect from '@/components/language-select';
import { getDailyRecommendation } from '@/lib/daily-recommendation';

const dateLocales: Record<string, any> = {
  en: enUS, ko: ko,
};

const statusMap: Record<string, string> = {
  '기도중': 'inProgress',
  '응답됨': 'answered',
  '거절': 'declined',
  '기다림': 'waiting',
};

const sortScheduleItems = (items: ScheduleItem[]): ScheduleItem[] => {
    const parseTime = (timeStr: string): number => {
      try {
        const parts = timeStr.split(' ');
        if (parts.length < 2) throw new Error("Invalid format");
        const time = parts[1];
        const timeParts = time.split(':');
        if (timeParts.length < 2) throw new Error("Invalid time format");
        let [hours, minutes] = timeParts.map(Number);
        if (parts[0] === '오후' && hours !== 12) hours += 12;
        if (parts[0] === '오전' && hours === 12) hours = 0;
        return hours * 60 + minutes;
      } catch (e) { return 9999; }
    };
  return [...items].sort((a, b) => parseTime(a.time) - parseTime(b.time));
};

const INITIAL_QT: QTEntry = {
  title: '', passage: '', segmentId: '', analyzedPassage: '', myMeditation: '', meditationGuide: '', verses: '', analysis: '', paragraphs: [], questions: [], questionAnswers: [], keyVerses: [], evaluation: '', missionTasks: [],
};

const INITIAL_DIARY: DiaryData = {
  dailyCheck: { closenessToGod: 5, relationships: 5, innerPeace: 5, senseOfPurpose: 5, thankfulness: 5 },
  reflection: { dailySummary: '', godExperience: '', hardestMoment: '', obedienceRepentance: '', missionAlignment: '', missionAlignmentChoice: '', gratitudeJournal: '', gratitudeJournalAudioUrl: '', dailyAiReflection: '', photos: [] },
  prayers: [], todaysSchedule: [], gratitudes: [], expenditures: [], timeSteward: [], peopleInteractions: [],
};

const getInitialDay = (date: string): DayData => ({
  date: date,
  qt: { ...INITIAL_QT },
  diary: {
    ...INITIAL_DIARY,
    dailyCheck: { ...INITIAL_DIARY.dailyCheck },
    reflection: { ...INITIAL_DIARY.reflection },
    prayers: [],
    todaysSchedule: [],
    gratitudes: [],
    expenditures: [],
    timeSteward: [],
    peopleInteractions: [],
  },
  completed: false,
  diaryCompleted: false,
});

const VersesWithHighlighting = ({ verses, keyVerses }: { verses?: string; keyVerses?: string[] }) => {
    if (!verses) return null;
    const keyVerseSet = new Set((keyVerses || []).map(v => v.trim()));
    const verseParts = verses.split(/(?=\[\d+\])/).filter(p => p.trim() !== '');
    return (
        <div className="font-serif text-xl leading-relaxed text-slate-800">
            {verseParts.map((part, i) => {
                const match = part.match(/^\[(\d+)\]\s*(.*)$/);
                if (!match) return <span key={`text-${i}`}>{part}</span>;
                const number = match[1]; 
                const text = match[2].trim(); 
                const isKeyVerse = keyVerseSet.has(text);
                return (
                    <Fragment key={`verse-${number}-${i}`}>
                        <sup className="text-muted-foreground font-sans font-medium text-sm mr-1 -top-1 relative">{number}</sup>
                        <span className={cn(isKeyVerse && 'text-orange-600 font-bold bg-orange-50/80 rounded px-1')}>
                            {text}
                        </span>{' '}
                    </Fragment>
                );
            })}
        </div>
    );
};

const DailyCheckSlider = ({ labelTitle, labelDesc, value, onValueChange }: { labelTitle: string, labelDesc: string, value: number, onValueChange: (value: number) => void }) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-baseline">
        <p className="text-sm font-medium text-slate-700">{labelTitle}</p>
        <span className="text-xs font-semibold text-primary">{Math.round(localValue)} / 10</span>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">{labelDesc}</p>
      <Slider 
        value={[localValue]} 
        onValueChange={(val) => setLocalValue(val[0])} 
        onValueCommit={(val) => {
          const snapped = Math.round(val[0]);
          setLocalValue(snapped);
          onValueChange(snapped);
        }}
        min={0} 
        max={10} 
        step={0.01} 
      />
    </div>
  );
};

const BibleContent = ({ qt, onCloseBible }: { qt: QTEntry, onCloseBible: () => void }) => {
    if (!qt.verses) return null;
    return (
        <div className="h-full bg-background z-30 flex flex-col overflow-hidden border-l shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-7 md:p-10 max-w-full mx-auto space-y-10 h-auto">
                    <div className="flex justify-between items-center sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-4 border-b">
                        <h1 className="text-xl font-bold text-slate-900">{qt.passage}</h1>
                        <Button onClick={onCloseBible} variant="ghost" size="icon" className="rounded-full hover:bg-muted"><X className="h-6 w-6" /></Button>
                    </div>
                    <div className="space-y-4 h-auto">
                        <h2 className="text-sm font-bold text-accent uppercase tracking-widest border-b pb-2">본문</h2>
                        <VersesWithHighlighting verses={qt.verses} keyVerses={qt.keyVerses} />
                    </div>
                    {qt.paragraphs && qt.paragraphs.length > 0 && (
                        <div className="space-y-4 h-auto">
                            <h2 className="text-sm font-bold text-accent uppercase tracking-widest border-b pb-2">문단 나누기</h2>
                            <div className="space-y-4 h-auto">
                                {qt.paragraphs?.map((p, index) => (
                                    <div key={`paragraph-${index}`}><h3 className="font-semibold text-slate-800 text-base">{p.range}: <span className="font-medium text-slate-600">{p.title}</span></h3></div>
                                ))}
                            </div>
                        </div>
                    )}
                    {qt.analysis && (
                        <div className="space-y-4 h-auto">
                            <h2 className="text-sm font-bold text-accent uppercase tracking-widest border-b pb-2">성경해설</h2>
                            <p className="whitespace-pre-wrap text-lg leading-relaxed text-slate-700 h-auto">{qt.analysis}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const CommunityContent = ({ orgContent, orgEvents, orgName, onClose, t }: { orgContent?: OrgDailyContent, orgEvents?: OrgEvent[], orgName: string, onClose: () => void, t: any }) => {
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const activeEvent = useMemo(() => orgEvents?.find(e => e.id === selectedEventId), [orgEvents, selectedEventId]);

    const BlockRenderer = ({ blocks }: { blocks: ContentBlock[] }) => {
        return (
            <div className="space-y-8">
                {blocks.map((block) => (
                    <div key={block.id} className="space-y-4">
                        {block.type === 'text' && (
                            <p style={{ 
                                fontSize: block.config?.fontSize, 
                                color: block.config?.color, 
                                fontFamily: block.config?.fontFamily, 
                                textAlign: block.config?.textAlign as any,
                                fontWeight: block.config?.fontWeight as any,
                                lineHeight: 1.6
                            }} className="whitespace-pre-wrap">
                                {block.content}
                            </p>
                        )}
                        {block.type === 'image' && block.content && (
                            <div className="flex justify-center">
                                <img src={block.content} alt="Content" className="w-[80%] rounded-sm shadow-sm border-[0.5px] border-slate-200/60" />
                            </div>
                        )}
                        {block.type === 'video' && block.content && getYouTubeId(block.content) && (
                            <div className="aspect-video rounded-sm overflow-hidden shadow-sm">
                                <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${getYouTubeId(block.content)}`} frameBorder="0" allowFullScreen />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="h-full bg-background z-30 flex flex-col overflow-hidden border-l shadow-2xl animate-in slide-in-from-right duration-300">
            <header className="p-6 border-b flex items-center justify-between bg-background/95 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary"><Building className="h-5 v-5"/></div>
                    <div>
                        <h2 className="text-xl font-bold">{orgName}</h2>
                        <p className="text-xs text-muted-foreground">우리 공동체의 소식을 전해드립니다.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {selectedEventId && <Button variant="ghost" onClick={() => setSelectedEventId(null)}><ArrowLeft className="mr-2 h-4 w-4"/> 목록으로</Button>}
                    <Button onClick={onClose} variant="ghost" size="icon" className="rounded-full"><X className="h-5 v-5"/></Button>
                </div>
            </header>
            <ScrollArea className="flex-1">
                <div className="p-8 space-y-10">
                    {selectedEventId && activeEvent ? (
                        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-200">
                            <div className="space-y-2">
                                <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 mb-2">특별 행사</Badge>
                                <h1 className="text-3xl font-black text-slate-900 tracking-tight">{activeEvent.title}</h1>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1"><CalendarIcon className="h-4 w-4"/> {activeEvent.date}</span>
                                    <span className="flex items-center gap-1"><Clock className="h-4 w-4"/> {activeEvent.time}</span>
                                </div>
                            </div>
                            <Separator />
                            <BlockRenderer blocks={activeEvent.materialBlocks || []} />
                        </div>
                    ) : (
                        <>
                            {(orgEvents?.length || 0) > 0 && (
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                                        <Sparkles className="h-4 w-4"/> 주요 행사 및 홍보
                                    </h3>
                                    <div className="grid gap-4">
                                        {orgEvents?.map(event => (
                                            <Card key={event.id} className="group cursor-pointer hover:border-primary transition-all border-l-4 border-indigo-500 shadow-sm" onClick={() => setSelectedEventId(event.id)}>
                                                <CardHeader className="p-4 pb-2">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <CardTitle className="text-lg group-hover:text-primary transition-colors">{event.title}</CardTitle>
                                                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                                                <span className="flex items-center gap-1"><CalendarIcon className="h-4 w-4"/> {event.date}</span>
                                                                <span className="flex items-center gap-1"><Clock className="h-4 w-4 ml-1"/> {event.time}</span>
                                                            </div>
                                                        </div>
                                                        <Button variant="ghost" size="icon" className="rounded-full group-hover:bg-primary/10 group-hover:text-primary"><ChevronRight className="h-5 v-5"/></Button>
                                                    </div>
                                                </CardHeader>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-primary uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                                    <CalendarDays className="h-4 w-4"/> {t('groups_officialSchedule')}
                                </h3>
                                {orgContent?.schedules && orgContent.schedules.length > 0 ? (
                                    <div className="grid gap-3">
                                        {orgContent.schedules.map((s, i) => (
                                            <div key={i} className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl border">
                                                <Badge className="bg-primary/10 text-primary hover:bg-primary/10 font-mono h-7">{s.time}</Badge>
                                                <span className="font-semibold text-slate-800">{s.content}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-xl">{t('groups_noEvents')}</p>}
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-sm font-bold text-primary uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                                    <Megaphone className="h-4 w-4"/> {t('groups_announcement')}
                                </h3>
                                {orgContent?.materialBlocks && orgContent.materialBlocks.length > 0 ? (
                                    <BlockRenderer blocks={orgContent.materialBlocks} />
                                ) : <p className="text-sm text-muted-foreground text-center py-10">등록된 안내 사항이 없습니다.</p>}
                            </div>
                        </>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};

const JournalPage: React.FC = () => {
  const { user, isUserLoading, profile } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { t, lang } = useTranslation();
  const { toast } = useToast();
  const currentLocale = useMemo(() => dateLocales[lang] || ko, [lang]);
  
  const dateFromURL = searchParams.get('date');
  const [currentDate, setCurrentDate] = useState(dateFromURL && isValid(new Date(dateFromURL)) ? new Date(dateFromURL) : startOfToday());
  const dateString = useMemo(() => format(currentDate, 'yyyy-MM-dd'), [currentDate]);

  const journalDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid, 'journal', dateString) : null, [firestore, user, dateString]);
  const { data: dayData, isLoading: isDocLoading } = useDoc<DayData>(journalDocRef);
  
  const peoplesRef = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'peoples') : null, [user, firestore]);
  const { data: peoples } = useCollection<Person>(peoplesRef);

  const mySmallGroupsQuery = useMemoFirebase(() => user && profile?.memberships?.[0]?.organizationId ? query(collection(firestore, 'organizations', profile.memberships[0].organizationId, 'smallGroups'), where('memberIds', 'array-contains', user.uid)) : null, [user, profile, firestore]);
  const { data: mySmallGroups } = useCollection<SmallGroup>(mySmallGroupsQuery);

  const sharedPrayersQuery = useMemoFirebase(() => user ? query(collection(firestore, 'prayerPosts'), where('userId', '==', user.uid), where('sharedFromDate', '==', dateString)) : null, [user, firestore, dateString]);
  const { data: sharedPrayers } = useCollection<PrayerPost>(sharedPrayersQuery);

  const myOrgDailyContentRef = useMemoFirebase(() => 
    (profile?.memberships?.[0]?.organizationId) ? doc(firestore, 'organizations', profile.memberships[0].organizationId, 'dailyContent', dateString) : null,
    [profile, firestore, dateString]
  );
  const { data: orgDailyContent } = useDoc<OrgDailyContent>(myOrgDailyContentRef);

  const myOrgEventsQuery = useMemoFirebase(() => {
    if (!profile?.memberships?.[0]?.organizationId || !firestore) return null;
    return query(
        collection(firestore, 'organizations', profile.memberships[0].organizationId, 'events'),
        where('date', '>=', dateString), 
        orderBy('date', 'asc'),
        limit(10)
    );
  }, [profile, firestore, dateString]);
  const { data: orgEventsRaw } = useCollection<OrgEvent>(myOrgEventsQuery);

  const [currentDay, setCurrentDay] = useState<DayData>(getInitialDay(dateString));
  const isSyncing = useRef(false);
  const isLocalDirty = useRef(false);
  const lastAutoOpenedKey = useRef<string | null>(null);

  const [isRecommending, setIsRecommending] = useState(false);
  const [isReadingBible, setIsReadingBible] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [overlayMode, setOverlayMode] = useState<'none' | 'bible' | 'community'>('none');
  const [selectedPrayerId, setSelectedPrayerId] = useState<string | null>(null);
  const [selectedGratitudeId, setSelectedGratitudeId] = useState<string | null>(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isFinishingDay, setIsFinishingDay] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prayerPeoplePopoverOpen, setPrayerPeoplePopoverOpen] = useState(false);
  const [gratitudePeoplePopoverOpen, setGratitudePeoplePopoverOpen] = useState(false);
  const [expenditurePeoplePopoverOpen, setExpenditurePeoplePopoverOpen] = useState(false);
  const [peoplePopoverOpen, setPeoplePopoverOpen] = useState(false);
  
  const [peopleSearch, setPeopleSearch] = useState('');
  const [prayerPeopleSearch, setPrayerPeopleSearch] = useState('');
  const [gratitudePeopleSearch, setGratitudePeopleSearch] = useState('');
  const [expenditurePeopleSearch, setExpenditurePeopleSearch] = useState('');

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

  const todayForQueryForWave = startOfToday();
  const sevenDaysAgoStr = format(subDays(todayForQueryForWave, 6), 'yyyy-MM-dd');
  const todayStrWave = format(todayForQueryForWave, 'yyyy-MM-dd');
  const recentJournalQueryForWave = useMemoFirebase(() => user ? query(collection(firestore, 'users', user.uid, 'journal'), where(documentId(), '>=', sevenDaysAgoStr), where(documentId(), '<=', todayStrWave)) : null, [user, firestore, sevenDaysAgoStr, todayStrWave]);
  const { data: recentJournalsForWave } = useCollection<DayData>(recentJournalQueryForWave);

  const waveActivityLevel = useMemo(() => {
    if (!recentJournalsForWave) return 0;
    let count = 0;
    for (let i = 0; i < 7; i++) {
        const dateStr = format(subDays(todayForQueryForWave, i), 'yyyy-MM-dd');
        const day = dateStr === dateString ? currentDay : recentJournalsForWave.find(j => j.id === dateStr);
        if (day?.completed && day?.diaryCompleted) count++;
    }
    return count / 7;
  }, [recentJournalsForWave, currentDay, dateString]);

  const activePromotedEvents = useMemo(() => {
    if (!orgEventsRaw) return [];
    const today = startOfDay(currentDate);
    return orgEventsRaw.filter(event => {
        if (event.promotionStartType === 'none') return false;
        let promoStartDate: Date;
        const eventDate = parseISO(event.date);
        if (event.promotionStartType === '1week') promoStartDate = subDays(eventDate, 7);
        else if (event.promotionStartType === '2weeks') promoStartDate = subDays(eventDate, 14);
        else if (event.promotionStartType === 'custom' && event.customPromotionStartDate) promoStartDate = parseISO(event.customPromotionStartDate);
        else return false;
        return (isAfter(today, promoStartDate) || isSameDay(today, promoStartDate)) && (isBefore(today, eventDate) || isSameDay(today, eventDate));
    });
  }, [orgEventsRaw, currentDate]);

  const filteredPeoples = useMemo(() => peoples?.filter(p => !peopleSearch || p.name.toLowerCase().includes(peopleSearch.toLowerCase())) || [], [peoples, peopleSearch]);
  const filteredPrayerPeoples = useMemo(() => peoples?.filter(p => !prayerPeopleSearch || p.name.toLowerCase().includes(prayerPeopleSearch.toLowerCase())) || [], [peoples, prayerPeopleSearch]);
  const filteredGratitudePeoples = useMemo(() => peoples?.filter(p => !gratitudePeopleSearch || p.name.toLowerCase().includes(gratitudePeopleSearch.toLowerCase())) || [], [peoples, gratitudePeopleSearch]);
  const filteredExpenditurePeoples = useMemo(() => peoples?.filter(p => !expenditurePeopleSearch || p.name.toLowerCase().includes(expenditurePeopleSearch.toLowerCase())) || [], [peoples, expenditurePeopleSearch]);

  const selectedPrayer = useMemo(() => {
    if (!selectedPrayerId) return null;
    return (currentDay.diary?.prayers || []).find(p => p.id === selectedPrayerId) || null;
  }, [selectedPrayerId, currentDay.diary?.prayers]);

  const selectedGratitude = useMemo(() => {
    if (!selectedGratitudeId) return null;
    return (currentDay.diary?.gratitudes || []).find(g => g.id === selectedGratitudeId) || null;
  }, [selectedGratitudeId, currentDay.diary?.gratitudes]);

  const activeSelectedPhoto = useMemo(() => {
      if (!selectedPhotoId) return null;
      return (currentDay.diary?.reflection?.photos || []).find(p => p.id === selectedPhotoId) || null;
  }, [selectedPhotoId, currentDay.diary?.reflection?.photos]);

  const anyAiLoading = isRecommending || isReadingBible || isEvaluating || isFinishingDay;

  useEffect(() => {
    if (dateFromURL && isValid(new Date(dateFromURL))) {
        setCurrentDate(new Date(dateFromURL));
    }
  }, [dateFromURL]);

  useEffect(() => {
    if (isDocLoading) return;
    if (isLocalDirty.current) return;

    const serverDiary = dayData?.diary || {};
    let initialData = dayData ? {
      ...getInitialDay(dateString), 
      ...dayData, 
      qt: { ...INITIAL_QT, ...(dayData.qt || {}) },
      diary: { 
        ...INITIAL_DIARY, 
        ...serverDiary, 
        dailyCheck: { ...INITIAL_DIARY.dailyCheck, ...(serverDiary.dailyCheck || {}) }, 
        reflection: { ...INITIAL_DIARY.reflection, ...(serverDiary.reflection || {}) }, 
        prayers: serverDiary.prayers || [], 
        todaysSchedule: serverDiary.todaysSchedule ? sortScheduleItems(serverDiary.todaysSchedule) : [], 
        gratitudes: serverDiary.gratitudes || [], 
        expenditures: serverDiary.expenditures || [], 
        peopleInteractions: serverDiary.peopleInteractions || [],
        timeSteward: serverDiary.timeSteward || [],
      }
    } : getInitialDay(dateString);

    if (orgDailyContent) {
        const churchQt = {
            passage: orgDailyContent.passage || '',
            title: orgDailyContent.title || '',
            verses: orgDailyContent.verses || '',
            analysis: orgDailyContent.analysis || '',
            meditationGuide: orgDailyContent.meditationGuide || '',
            questions: orgDailyContent.questions || [],
            paragraphs: orgDailyContent.paragraphs || [],
            keyVerses: orgDailyContent.keyVerses || [],
        };
        initialData.qt = {
            ...initialData.qt,
            passage: initialData.qt.passage || churchQt.passage,
            title: initialData.qt.title || churchQt.title,
            verses: initialData.qt.verses || churchQt.verses,
            analysis: initialData.qt.analysis || churchQt.analysis,
            meditationGuide: initialData.qt.meditationGuide || churchQt.meditationGuide,
            questions: (initialData.qt.questions && initialData.qt.questions.length > 0) ? initialData.qt.questions : churchQt.questions,
            paragraphs: (initialData.qt.paragraphs && initialData.qt.paragraphs.length > 0) ? initialData.qt.paragraphs : churchQt.paragraphs,
            keyVerses: (initialData.qt.keyVerses && initialData.qt.keyVerses.length > 0) ? initialData.qt.keyVerses : churchQt.keyVerses,
        };
    }
  
    const passageFromURL = searchParams.get('passage');
    const segmentIdFromURL = searchParams.get('segmentId');

    const checkAndAutoOpen = async () => {
        if (!firestore) return;
        let finalQt = initialData.qt;
        const currentKey = `${dateString}_${passageFromURL || 'none'}`;
        
        if (passageFromURL) {
            const decodedPassage = decodeURIComponent(passageFromURL);
            const passageId = segmentIdFromURL || decodedPassage.replace(/\s+/g, '_').toLowerCase();
            const globalId = `${lang}_${passageId}`;
            const globalSnap = await getDoc(doc(firestore, 'bibleSegments', globalId));
            if (globalSnap.exists()) {
                const globalData = globalSnap.data() as GlobalBibleSegment;
                finalQt = { ...finalQt, passage: decodedPassage, segmentId: segmentIdFromURL || '', analyzedPassage: decodedPassage, ...globalData };
                if (lastAutoOpenedKey.current !== currentKey && globalData.verses) { 
                    setOverlayMode('bible'); 
                    lastAutoOpenedKey.current = currentKey; 
                }
            } else {
                finalQt = { ...finalQt, passage: decodedPassage, segmentId: segmentIdFromURL || '', completed: false };
                lastAutoOpenedKey.current = currentKey; 
            }
        } else if (!dayData && !orgDailyContent?.passage) {
            const rec = getDailyRecommendation(dateString);
            finalQt.passage = rec.passage;
            finalQt.segmentId = rec.segmentId;
        }

        if (!isSyncing.current) { 
            setCurrentDay({ ...initialData, qt: finalQt }); 
        }
    };
    checkAndAutoOpen();
  }, [dayData, dateString, isDocLoading, searchParams, firestore, lang, orgDailyContent]);

  useEffect(() => {
    if (isDocLoading || !user || !firestore || !isLocalDirty.current) return;
    const filteredInteractions = (currentDay.diary?.peopleInteractions || []).filter(i => (i.personId && i.personId !== '') || i.note.trim() !== '');
    const dataToSave = { 
      ...currentDay, 
      diary: { 
        ...currentDay.diary, 
        prayers: (currentDay.diary?.prayers || []).filter(p => p.title.trim() !== ''), 
        gratitudes: (currentDay.diary?.gratitudes || []).filter(g => g.title.trim() !== ''), 
        expenditures: (currentDay.diary?.expenditures || []).filter(e => e.title.trim() !== ''),
        peopleInteractions: filteredInteractions,
        todaysSchedule: currentDay.diary?.todaysSchedule || [],
        timeSteward: currentDay.diary?.timeSteward || [],
      }, 
      updatedAt: serverTimestamp() 
    };
    const timer = setTimeout(() => {
        isSyncing.current = true;
        setDocumentNonBlocking(doc(firestore, 'users', user.uid, 'journal', dateString), dataToSave, { merge: true });
        setTimeout(() => { isSyncing.current = false; isLocalDirty.current = false; }, 1000);
    }, 2000); 
    return () => clearTimeout(timer);
  }, [currentDay, user, firestore, dateString, isDocLoading]);

  useEffect(() => {
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach(ta => {
        ta.style.height = 'auto';
        ta.style.height = `${ta.scrollHeight}px`;
    });
  }, [currentDay, overlayMode, selectedPrayerId, selectedGratitudeId]);

  const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    target.style.height = 'auto';
    target.style.height = `${target.scrollHeight}px`;
  };

  const changeDate = (amount: number) => { 
    const nd = addDays(currentDate, amount);
    const newDateStr = format(nd, 'yyyy-MM-dd');
    isLocalDirty.current = false;
    router.push(`${pathname}?date=${newDateStr}`);
    setOverlayMode('none'); 
  };

  const updateDayState = (updater: (prev: DayData) => DayData) => {
    isLocalDirty.current = true;
    setCurrentDay(updater);
  };

  const updateQTField = (field: keyof QTEntry, value: any) => { updateDayState(prev => ({ ...prev, qt: { ...prev.qt, [field]: value } })); };
  const updateQuestionAnswer = (i: number, val: string) => { updateDayState(prev => { const na = [...(prev.qt.questionAnswers || [])]; na[i] = val; return { ...prev, qt: { ...prev.qt, questionAnswers: na } }; }); };
  const updateDailyCheck = (f: keyof DailyCheck, v: number) => updateDayState(prev => ({ ...prev, diary: { ...prev.diary, dailyCheck: { ...(prev.diary.dailyCheck || INITIAL_DIARY.dailyCheck), [f]: v } } }));
  const updateReflection = (f: keyof ReflectionData, v: string | any) => updateDayState(prev => ({ ...prev, diary: { ...prev.diary, reflection: { ...(prev.diary.reflection || INITIAL_DIARY.reflection), [f]: v } } }));

  const handleUpdateMission = (index: number, status: 'yes' | 'no') => {
    updateDayState(prev => { const newTasks = [...(prev.qt.missionTasks || [])]; if (newTasks[index]) { newTasks[index] = { ...newTasks[index], completed: status }; } return { ...prev, qt: { ...prev.qt, missionTasks: newTasks } }; });
  };

  const handleFetchAIQT = async () => {
    if (!profile || !firestore) return;
    setIsRecommending(true);
    try {
      const result = await recommendPassageAction({ passageList: profile.recommendedPassages || [] });
      if (result.error) throw new Error(result.error);
      const newQtData: QTEntry = { ...INITIAL_QT, passage: result.passage || '시편 23:1-6' };
      updateDayState(prev => ({ ...prev, qt: newQtData }));
      await updateDoc(doc(firestore, 'users', user!.uid), { recommendedPassages: arrayUnion(result.passage) });
    } catch (e) { toast({ title: "오류", description: "말씀 추천 중 오류가 발생했습니다.", variant: "destructive" }); } finally { setIsRecommending(false); }
  };

  const handleReadBible = async () => {
    if (!currentDay.qt?.passage || !firestore) return;
    if (currentDay.qt.verses) { setOverlayMode('bible'); return; }
    const passageId = currentDay.qt.segmentId || currentDay.qt.passage.replace(/\s+/g, '_').toLowerCase();
    const globalId = `${lang}_${passageId}`;
    const globalRef = doc(firestore, 'bibleSegments', globalId);
    setIsReadingBible(true);
    try {
        const globalSnap = await getDoc(globalRef);
        if (globalSnap.exists()) {
            const data = globalSnap.data() as GlobalBibleSegment;
            updateDayState(prev => ({ ...prev, qt: { ...prev.qt, analyzedPassage: data.passage, ...data } }));
            updateDoc(globalRef, { usageCount: increment(1) });
            setOverlayMode('bible');
            setIsReadingBible(false);
            return;
        }
        const languageName = languages.find(l => l.code === lang)?.name || 'Korean';
        const result = await generateBibleSegmentContentAction({ passage: currentDay.qt.passage, language: languageName });
        if (result.error) throw new Error(result.error);
        const bibleContent: Partial<GlobalBibleSegment> = { id: globalId, passage: currentDay.qt.passage, language: lang, title: result.title, verses: result.verses, paragraphs: result.paragraphs, analysis: result.analysis, questions: result.questions, keyVerses: result.keyVerses, meditationGuide: result.meditationGuide, usageCount: 1, lastGeneratedAt: serverTimestamp() };
        updateDoc(globalRef, bibleContent).catch(() => setDocumentNonBlocking(globalRef, { ...bibleContent, createdAt: serverTimestamp() }, { merge: true }));
        updateDayState(prev => ({ ...prev, qt: { ...prev.qt, analyzedPassage: currentDay.qt.passage, ...bibleContent } }));
        setOverlayMode('bible');
    } catch (e: any) { toast({ variant: "destructive", title: "오류", description: e.message || "본문 내용을 생성하는 중 오류가 발생했습니다." }); } finally { setIsReadingBible(false); }
  };

  const handleFinishDay = async () => {
    if(!currentDay.diary.reflection?.dailySummary?.trim()) return;
    setIsFinishingDay(true);
    const journalContent = `하루 요약: ${currentDay.diary.reflection.dailySummary}\n하나님 경험: ${currentDay.diary.reflection.godExperience}`;
    try {
      const result = await reflectOnDayFlow({ journalContent });
      if (result.reflectionMessage) {
        updateDayState(prev => ({ ...prev, diaryCompleted: true, diary: { ...prev.diary, reflection: { ...prev.diary.reflection, dailyAiReflection: result.reflectionMessage } } }));
        toast({ title: t('journal_dayFinished') });
      }
    } catch (e: any) { toast({ variant: "destructive", title: "오류", description: "하루 마감 중 오류가 발생했습니다." }); } finally { setIsFinishingDay(false); }
  };

  const handleFinishMeditation = async () => {
    if (!currentDay.qt?.myMeditation?.trim()) return;
    setIsEvaluating(true);
    const journalContent = `성경 묵상: ${currentDay.qt.myMeditation}\n질문 답변: ${(currentDay.qt.questionAnswers || []).join(', ')}`;
    try {
      const result = await evaluateMeditationAction({ passage: currentDay.qt.passage, journalContent });
      if (result.error) throw new Error(result.error);
      if (result.evaluation && result.missions) {
        updateDayState(prev => ({ ...prev, completed: true, qt: { ...prev.qt, evaluation: result.evaluation, missionTasks: result.missions!.map(q => ({ question: q, completed: 'pending' })) } }));
        toast({ title: t('journal_finishMeditation') });
      }
    } catch (e: any) { toast({ variant: "destructive", title: "오류", description: e.message || "묵상 분석 중 오류가 발생했습니다." }); } finally { setIsEvaluating(false); }
  };

  const handleShareToForum = async () => {
    if (!user || !profile || !currentDay.qt?.passage || !currentDay.qt?.myMeditation || !firestore) return;
    const parts = currentDay.qt.passage.split(' ');
    const bibleBook = [...OLD_TESTAMENT_BOOKS, ...NEW_TESTAMENT_BOOKS].find(b => b.koreanName === parts[0]);
    if (!bibleBook) return;
    const newPost: Omit<ForumPost, 'id'> = { userId: user.uid, userDisplayName: profile.displayName, userProfilePictureUrl: profile.profilePictureUrl, passage: currentDay.qt.passage, bookKey: bibleBook.key, chapter: parseInt(parts[1]?.split(':')[0] || '1'), meditation: currentDay.qt.myMeditation, createdAt: serverTimestamp(), reactions: {}, sharedFromDate: dateString };
    addDocumentNonBlocking(collection(firestore, 'forumPosts'), newPost);
    toast({ title: t('journal_shareToForum') });
  };

  const handleSharePrayer = async (prayer: PrayerItem, targetId: string, type: 'church' | 'group') => {
      if (!user || !profile || !firestore) return;
      const isChurch = type === 'church';
      const targetOrg = profile.memberships?.find(m => m.organizationId === targetId);
      const targetGroup = mySmallGroups?.find(g => g.id === targetId);
      const postData: any = { userId: user.uid, userDisplayName: profile.displayName, userProfilePictureUrl: profile.profilePictureUrl || '', title: prayer.title, category: isChurch ? 'church' : 'small_group', organizationId: isChurch ? targetId : (profile.memberships?.[0]?.organizationId || ''), organizationName: isChurch ? (targetOrg?.organizationName || '교회') : (profile.memberships?.[0]?.organizationName || '교회'), createdAt: serverTimestamp(), amens: [], sharedFromDate: dateString, originalPrayerId: prayer.id, visibility: 'public' };
      if (!isChurch) { postData.groupId = targetId; postData.groupName = targetGroup?.name || '소그룹'; }
      addDocumentNonBlocking(collection(firestore, 'prayerPosts'), postData);
      toast({ title: `${isChurch ? postData.organizationName : postData.groupName} 기도실에 공유되었습니다.` });
  };

  const handleUnsharePrayer = async (prayerId: string, targetId: string) => {
      if (!user || !firestore) return;
      try {
          const q = query(collection(firestore, 'prayerPosts'), where('userId', '==', user.uid), where('originalPrayerId', '==', prayerId));
          const snap = await getDocs(q);
          const batch = writeBatch(firestore);
          let deleted = false;
          snap.forEach(d => {
              const data = d.data();
              if (data.organizationId === targetId || data.groupId === targetId) {
                  batch.delete(d.ref);
                  deleted = true;
              }
          });
          if (deleted) { await batch.commit(); toast({ title: "공유가 취소되었습니다." }); }
      } catch (e) { toast({ title: "처리 실패", variant: "destructive" }); }
  };

  const handleSignOutAction = async () => {
    if (!auth) return;
    try {
      await firebaseSignOut(auth);
      router.push('/');
    } catch (e) { console.error('Sign out error:', e); }
  };

  const addPrayerItem = () => updateDayState(prev => ({ ...prev, diary: { ...prev.diary, prayers: [...(prev.diary.prayers || []), { id: Date.now().toString(), title: '', status: PrayerStatus.InProgress, feedbacks: [], createdAt: new Date() }] } }));
  const handleAddPersonPrayer = (p: Person) => { updateDayState(prev => ({ ...prev, diary: { ...prev.diary, prayers: [...(prev.diary.prayers || []), { id: Date.now().toString(), title: `${p.name}님을 위한 기도`, status: PrayerStatus.InProgress, feedbacks: [], createdAt: new Date(), personId: p.id }] } })); setPrayerPeoplePopoverOpen(false); };
  const updatePrayerItem = (id: string, updates: Partial<PrayerItem>) => updateDayState(prev => ({ ...prev, diary: { ...prev.diary, prayers: (prev.diary.prayers || []).map(p => p.id === id ? { ...p, ...updates } : p) } }));
  const removePrayerItem = (id: string) => updateDayState(prev => ({ ...prev, diary: { ...prev.diary, prayers: (prev.diary.prayers || []).filter(p => p.id !== id) } }));
  const addGratitudeItem = () => updateDayState(prev => ({ ...prev, diary: { ...prev.diary, gratitudes: [...(prev.diary.gratitudes || []), { id: Date.now().toString(), title: '', feedbacks: [], createdAt: new Date() }] } }));
  const handleAddPersonGratitude = (p: Person) => { updateDayState(prev => ({ ...prev, diary: { ...prev.diary, gratitudes: [...(prev.diary.gratitudes || []), { id: Date.now().toString(), title: `${p.name}님을 향한 감사`, feedbacks: [], createdAt: new Date(), personId: p.id }] } })); setGratitudePeoplePopoverOpen(false); };
  const updateGratitudeItem = (id: string, updates: Partial<GratitudeItem>) => updateDayState(prev => ({ ...prev, diary: { ...prev.diary, gratitudes: (prev.diary.gratitudes || []).map(g => g.id === id ? { ...g, ...updates } : g) } }));
  const removeGratitudeItem = (id: string) => updateDayState(prev => ({ ...prev, diary: { ...prev.diary, gratitudes: (prev.diary.gratitudes || []).filter(g => g.id !== id) } }));
  const addExpenditureItem = () => updateDayState(prev => ({ ...prev, diary: { ...prev.diary, expenditures: [...(prev.diary.expenditures || []), { id: Date.now().toString(), title: '', amount: 0, createdAt: new Date() }] } }));
  const handleAddPersonExpenditure = (p: Person) => { updateDayState(prev => ({ ...prev, diary: { ...prev.diary, expenditures: [...(prev.diary.expenditures || []), { id: Date.now().toString(), title: `${p.name}님을 위한 지출`, amount: 0, createdAt: new Date(), personId: p.id }] } })); setExpenditurePeoplePopoverOpen(false); };
  const updateExpenditureItem = (id: string, updates: Partial<ExpenditureItem>) => updateDayState(prev => ({ ...prev, diary: { ...prev.diary, expenditures: (prev.diary.expenditures || []).map(e => e.id === id ? { ...e, ...updates } : e) } }));
  const removeExpenditureItem = (id: string) => updateDayState(prev => ({ ...prev, diary: { ...prev.diary, expenditures: (prev.diary.expenditures || []).filter(e => e.id !== id) } }));
  const addScheduleItem = () => updateDayState(prev => ({ ...prev, diary: { ...prev.diary, todaysSchedule: sortScheduleItems([...(prev.diary.todaysSchedule || []), { id: Date.now().toString(), time: '오전 09:00', content: '' }]) } }));
  const updateScheduleItem = (id: string, updates: Partial<ScheduleItem>) => updateDayState(prev => ({ ...prev, diary: { ...prev.diary, todaysSchedule: sortScheduleItems((prev.diary.todaysSchedule || []).map(item => id === item.id ? { ...item, ...updates } : item)) } }));
  const removeScheduleItem = (id: string) => updateDayState(prev => ({ ...prev, diary: { ...prev.diary, todaysSchedule: (prev.diary.todaysSchedule || []).filter(item => id === item.id ? false : true) } }));
  const handleAddInteraction = (p: Person) => { updateDayState(prev => ({ ...prev, diary: { ...prev.diary, peopleInteractions: [...(prev.diary.peopleInteractions || []), { id: Date.now().toString(), personId: p.id, note: '' }] } })); setPeoplePopoverOpen(false); };
  const addInteractionEmpty = () => updateDayState(prev => ({ ...prev, diary: { ...prev.diary, peopleInteractions: [...(prev.diary.peopleInteractions || []), { id: Date.now().toString(), personId: '', note: '' }] } }));
  const updateInteractionNote = (id: string, note: string) => updateDayState(prev => ({ ...prev, diary: { ...prev.diary, peopleInteractions: (prev.diary.peopleInteractions || []).map(i => i.id === id ? { ...i, note } : i) } }));
  const removeInteraction = (id: string) => updateDayState(prev => ({ ...prev, diary: { ...prev.diary, peopleInteractions: (prev.diary.peopleInteractions || []).filter(i => i.id !== id) } }));

  const handleToggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        mediaRecorder.ondataavailable = (event) => audioChunksRef.current.push(event.data);
        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            setIsTranscribing(true);
            try {
              const storage = getStorage();
              const audioFileName = `prayer_audio_${Date.now()}.wav`;
              const storageRefPath = ref(storage, `users/${user!.uid}/journal/${dateString}/${audioFileName}`);
              await uploadBytes(storageRefPath, audioBlob);
              const downloadUrl = await getDownloadURL(storageRefPath);
              updateReflection('gratitudeJournalAudioUrl', downloadUrl);
              const result = await transcribeAudioAction({ audioDataUri: base64Audio });
              if (result.transcript) {
                const currentText = currentDay.diary.reflection?.gratitudeJournal || '';
                updateReflection('gratitudeJournal', currentText + (currentText ? ' ' : '') + result.transcript);
              }
            } catch (e) { 
              console.error(e);
              toast({ variant: "destructive", title: "오류", description: "음성 처리 중 오류가 발생했습니다." }); 
            } finally { 
              setIsTranscribing(false); 
            }
          };
        };
        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) { toast({ variant: "destructive", title: "오류", description: "마이크 접근 권한이 필요합니다." }); }
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !user) return;
      const currentPhotos = currentDay.diary?.reflection?.photos || [];
      if (currentPhotos.length >= 5) {
          toast({ variant: 'destructive', title: '사진 제한', description: '최대 5장까지 업로드 가능합니다.' });
          return;
      }
      setIsUploadingPhoto(true);
      try {
          const storage = getStorage();
          const storageRefPath = ref(storage, `users/${user.uid}/journal/${dateString}/${Date.now()}_${file.name}`);
          await uploadBytes(storageRefPath, file);
          const downloadUrl = await getDownloadURL(storageRefPath);
          const newPhoto: PhotoItem = { id: Date.now().toString(), url: downloadUrl, caption: '' };
          updateReflection('photos', [...currentPhotos, newPhoto]);
          toast({ title: '사진이 안전하게 보관되었습니다.' });
      } catch (err) { 
          console.error(err);
          toast({ variant: 'destructive', title: '오류', description: '이미지 업로드에 실패했습니다.' }); 
      } finally {
          setIsUploadingPhoto(false);
      }
      if (e.target) e.target.value = '';
  };

  const updatePhotoCaption = (photoId: string, caption: string) => {
      updateDayState(prev => {
          const photos = (prev.diary.reflection?.photos || []).map(p => p.id === photoId ? { ...p, caption } : p);
          return { ...prev, diary: { ...prev.diary, reflection: { ...(prev.diary.reflection || INITIAL_DIARY.reflection), photos } } };
      });
  };

  const deletePhoto = (photoId: string) => {
      updateDayState(prev => {
          const photos = (prev.diary.reflection?.photos || []).filter(p => p.id !== photoId);
          return { ...prev, diary: { ...prev.diary, reflection: { ...(prev.diary.reflection || INITIAL_DIARY.reflection), photos } } };
      });
      setSelectedPhotoId(null);
  };

  const PeoplePicker = ({ open, onOpenChange, search, setSearch, filteredList, onSelect }: any) => (
    <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 text-accent hover:bg-accent hover:text-white transition-colors">
                {t('journal_addPerson')}
            </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0 overflow-hidden z-[110]" side="bottom" align="end">
            <div className="flex items-center justify-between p-3 bg-primary text-white">
                <h4 className="font-bold text-sm">{t('peoples_search')}</h4>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-white/20" onClick={() => onOpenChange(false)}>
                    <X className="h-4 w-4" />
                </Button>
            </div>
            <div className="p-4 space-y-4">
                <Input placeholder={t('journal_searchPersonPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} className="placeholder:text-[13px] placeholder:text-muted-foreground/60" />
                <ScrollArea className="h-48">
                    <div className="grid grid-cols-4 gap-2">
                        {filteredList.map((p: Person) => (
                            <button key={p.id} onClick={() => onSelect(p)} className="flex flex-col items-center text-xs p-1 hover:bg-accent/10 rounded-md transition-colors">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={p.avatarUrl} />
                                    <AvatarFallback><span>{p.name?.charAt(0) || 'U'}</span></AvatarFallback>
                                </Avatar>
                                <span className="mt-1 truncate w-full text-center">{p.name}</span>
                            </button>
                        ))}
                        {filteredList.length === 0 && <p className="col-span-full text-center py-10 text-xs text-muted-foreground">등록된 사람이 없습니다.</p>}
                    </div>
                </ScrollArea>
                <div className="pt-2 border-t"><Button variant="outline" size="sm" className="w-full gap-2 text-primary font-bold" onClick={() => router.push('/peoples')}> <Plus className="h-4 w-4" /> {t('journal_addNewPerson')} </Button></div>
            </div>
        </PopoverContent>
    </Popover>
  );

  const qtSection = (
    <div className="p-5 md:p-7 pt-5 space-y-5 pb-28 h-auto">
        <Card className="h-auto border-orange-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <h3 className="text-lg font-light text-accent">{t('journal_biblePassage')}</h3>
                <div className="flex items-center gap-2">
                    <Button onClick={() => router.push(`/series?date=${currentDate.toISOString()}`)} variant="outline" className="bg-emerald-100/80 text-emerald-800 border-emerald-200 h-7 rounded-full text-xs px-4">{t('journal_series')}</Button>
                    <Button onClick={handleFetchAIQT} disabled={anyAiLoading} variant="outline" className="bg-orange-100/80 text-orange-800 border-orange-200 h-7 rounded-full text-xs px-4">
                        {isRecommending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                        {t('journal_recommendPassage')}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
                <Input value={currentDay.qt?.passage || ''} onChange={(e) => updateQTField('passage', e.target.value)} placeholder={t('journal_biblePassagePlaceholder')} className="flex-1 bg-white/50 placeholder:text-[13px] placeholder:text-muted-foreground/60" />
                <Button onClick={handleReadBible} variant="outline" disabled={anyAiLoading || !currentDay.qt?.passage}> 
                    {isReadingBible ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <BookOpen className="mr-2 h-4 w-4" />} 
                    {isReadingBible ? t('journal_readingBible') : (currentDay.qt.verses ? t('journal_openBible') : t('journal_readBible'))} 
                </Button>
            </CardContent>
        </Card>

        {currentDay.qt.meditationGuide && (
            <Card className="h-auto border-orange-100">
                <CardHeader className="pb-2">
                    <h3 className="text-lg font-light text-accent flex items-center gap-2">
                        <span className="text-lg">✨</span>{t('journal_meditationGuide')}
                    </h3>
                </CardHeader>
                <CardContent className="text-lg leading-relaxed text-slate-700 whitespace-pre-wrap h-auto">
                    {currentDay.qt.meditationGuide}
                </CardContent>
            </Card>
        )}

        {currentDay.qt.questions && currentDay.qt.questions.length > 0 && (
            <Card className="h-auto border-orange-100">
                <CardHeader className="pb-2"><h3 className="text-lg font-light text-accent">{t('journal_reflectionQuestions')}</h3></CardHeader>
                <CardContent className="space-y-4 h-auto"> 
                    {currentDay.qt.questions.slice(0, 1).map((q, i) => ( 
                        <div key={`question-${i}`} className="h-auto"> 
                            <p className="text-lg leading-relaxed text-slate-700 mb-2 whitespace-pre-wrap font-normal">{q}</p> 
                            <Textarea 
                                value={currentDay.qt.questionAnswers?.[0] || ''} 
                                onChange={(e) => updateQuestionAnswer(0, e.target.value)} 
                                onInput={handleTextareaInput}
                                placeholder={t('journal_answerPlaceholder')} 
                                className="w-full bg-white/40 placeholder:text-[13px] placeholder:text-muted-foreground/60 h-auto resize-none overflow-hidden" 
                                rows={1}
                            /> 
                        </div> 
                    ))} 
                </CardContent>
            </Card>
        )}
        
        <Card className="h-auto border-orange-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <h3 className="text-lg font-light text-accent">{t('journal_myMeditation')}</h3>
                <div className="flex items-center gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={handleShareToForum} disabled={!currentDay.qt?.myMeditation?.trim() || !currentDay.qt?.passage?.trim()}><Share2 className="h-4 w-4 text-accent" /></Button>
                            </TooltipTrigger>
                            <TooltipContent><p>{t('journal_shareToForum')}</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </CardHeader>
            <CardContent className="h-auto">
                <Input value={currentDay.qt?.title || ''} onChange={(e) => updateQTField('title', e.target.value)} placeholder={t('journal_meditationTitlePlaceholder')} className="bg-white/50 placeholder:text-[13px] placeholder:text-muted-foreground/60 mb-3" />
                <Textarea 
                    value={currentDay.qt?.myMeditation || ''} 
                    onChange={(e) => updateQTField('myMeditation', e.target.value)} 
                    onInput={handleTextareaInput}
                    placeholder={t('journal_myMeditationPlaceholder')} 
                    className="w-full min-h-[120px] bg-white/40 placeholder:text-[13px] placeholder:text-muted-foreground/60 h-auto resize-none overflow-hidden" 
                />
            </CardContent>
        </Card>

        <Card className="h-auto border-orange-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <h3 className="text-lg font-light text-accent flex items-center gap-2"><Hand className="h-5 w-5" /> {t('journal_todaysPrayer')}</h3>
                <div className="flex items-center gap-2">
                    <PeoplePicker 
                        open={prayerPeoplePopoverOpen} 
                        onOpenChange={setPrayerPeoplePopoverOpen} 
                        search={prayerPeopleSearch} 
                        setSearch={setPrayerPeopleSearch} 
                        filteredList={filteredPrayerPeoples} 
                        onSelect={handleAddPersonPrayer} 
                    />
                    <Button variant="ghost" size="sm" onClick={addPrayerItem} className="gap-1 text-accent hover:bg-accent hover:text-white transition-colors">{t('journal_addPrayer')}</Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-3 h-auto">
                    {(currentDay.diary?.prayers || []).length > 0 ? ( 
                        currentDay.diary.prayers!.map((prayer) => (
                            <div key={prayer.id} className="flex flex-col gap-2 p-3 bg-white/60 rounded-lg border border-orange-50 group h-auto">
                                <div className="flex items-center gap-2">
                                    {prayer.personId && (
                                        <Avatar className="h-9 w-9">
                                            <AvatarImage src={peoples?.find(p => p.id === prayer.personId)?.avatarUrl} />
                                            <AvatarFallback>
                                                <span>{peoples?.find(p => p.id === prayer.personId)?.name?.charAt(0) || 'U'}</span>
                                            </AvatarFallback>
                                        </Avatar>
                                    )}
                                    <Input value={prayer.title} onChange={(e) => updatePrayerItem(prayer.id, { title: e.target.value })} placeholder={t('journal_prayerPlaceholder')} className="flex-1 border-none shadow-none placeholder:text-[13px] placeholder:text-muted-foreground/60 bg-transparent" />
                                    <Select value={prayer.status} onValueChange={(v) => updatePrayerItem(prayer.id, { status: v as PrayerStatus })}>
                                        <SelectTrigger className={cn("w-[100px] h-9 text-[10px]", prayer.status === '응답됨' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700')}><SelectValue /></SelectTrigger>
                                        <SelectContent> {Object.values(PrayerStatus).map(s => ( <SelectItem key={s} value={s}>{t(`prayerStatus_${statusMap[s] || 'inProgress'}`)}</SelectItem> ))} </SelectContent>
                                    </Select>
                                    <Button onClick={() => setSelectedPrayerId(prayer.id)} size="sm" variant="outline">{t('journal_prayerRecord')}</Button>
                                    <Button onClick={() => removePrayerItem(prayer.id)} size="icon" variant="ghost" className="text-destructive"><X className="h-4 w-4" /></Button>
                                </div>
                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1">
                                                <Share2 className="h-3 w-3" />공유
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-56">
                                            <DropdownMenuLabel>공유 대상 선택</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            {profile?.memberships?.map(m => {
                                                const isShared = sharedPrayers?.some(sp => sp.originalPrayerId === prayer.id && sp.organizationId === m.organizationId && sp.category === 'church');
                                                return (
                                                    <DropdownMenuItem key={m.organizationId} onClick={() => isShared ? handleUnsharePrayer(prayer.id, m.organizationId) : handleSharePrayer(prayer, m.organizationId, 'church')}>
                                                        <div className="flex items-center justify-between w-full">
                                                            <span className="flex items-center gap-2"><Building className="h-3 w-3" />{m.organizationName}</span>
                                                            {isShared ? <Badge variant="destructive" className="text-[8px] h-4">공유 취소</Badge> : <Badge variant="outline" className="text-[8px] h-4">공유</Badge>}
                                                        </div>
                                                    </DropdownMenuItem>
                                                )
                                            })}
                                            {mySmallGroups?.map(sg => {
                                                const isShared = sharedPrayers?.some(sp => sp.originalPrayerId === prayer.id && sp.groupId === sg.id);
                                                return (
                                                    <DropdownMenuItem key={sg.id} onClick={() => isShared ? handleUnsharePrayer(prayer.id, sg.id) : handleSharePrayer(prayer, sg.id, 'group')}>
                                                        <div className="flex items-center justify-between w-full">
                                                            <span className="flex items-center gap-2"><Users className="h-3 w-3" />{sg.name}</span>
                                                            {isShared ? <Badge variant="destructive" className="text-[8px] h-4">공유 취소</Badge> : <Badge variant="outline" className="text-[8px] h-4">공유</Badge>}
                                                        </div>
                                                    </DropdownMenuItem>
                                                )
                                            })}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 bg-muted/20 rounded-xl border border-dashed gap-3">
                            <Hand className="h-8 w-8 text-accent opacity-20" />
                            <p className="text-xs text-muted-foreground">{t('journal_addPrayerPrompt')}</p>
                            <Button variant="outline" size="sm" onClick={addPrayerItem} className="h-8 rounded-full border-accent text-accent hover:bg-accent hover:text-white transition-colors">
                                <Plus className="h-3.5 w-3.5 mr-1" /> {t('journal_addPrayer')}
                            </Button>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>

        {currentDay.qt?.myMeditation?.trim() && !currentDay.qt.evaluation && (
            <div className="pt-4 h-auto">
                <Button onClick={handleFinishMeditation} disabled={anyAiLoading} variant="outline" size="sm" className="w-full bg-orange-100/50 text-accent h-8 rounded-full font-semibold border-orange-200 hover:bg-accent hover:text-white transition-colors">
                    {isEvaluating ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : '📖'}
                    {isEvaluating ? t('journal_analyzingMeditation') : t('journal_finishMeditation')}
                </Button>
            </div>
        )}
        {currentDay.qt.evaluation && (
            <Card className="h-auto border-orange-100">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <label className="text-sm font-semibold text-accent">{t('journal_toLiveTheWord')}</label>
                    <Button variant="ghost" size="icon" onClick={handleFinishMeditation} disabled={isEvaluating}>
                        <RefreshCw className={cn("h-4 w-4 text-accent", isEvaluating && "animate-spin")} />
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4 h-auto">
                    <p className="text-lg text-slate-600 bg-orange-50/50 p-4 rounded-md h-auto">{currentDay.qt.evaluation}</p>
                    <div className="space-y-3 h-auto">
                        <h4 className="font-semibold text-accent">{t('journal_todaysMission')}</h4>
                        {(currentDay.qt.missionTasks || []).map((task, index) => (
                            <div key={`mission-${index}`} className="flex items-center justify-between p-3 bg-white/60 rounded-lg border border-orange-50 h-auto">
                                <p className="text-base font-medium flex-1 h-auto">{index + 1}. {task.question}</p>
                                <div className="flex gap-2 h-auto">
                                    <Button variant={task.completed === 'yes' ? 'default' : 'outline'} size="sm" onClick={() => handleUpdateMission(index, 'yes')}>{t('journal_missionSuccess')}</Button>
                                    <Button variant={task.completed === 'no' ? 'destructive' : 'outline'} size="sm" onClick={() => handleUpdateMission(index, 'no')}>{t('journal_missionFail')}</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        )}
    </div>
  );

  const diarySection = (
    <div className="p-5 md:p-7 pt-5 space-y-5 pb-28 h-auto">
        <Card className="h-auto border-indigo-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Link href={{ pathname: '/calendar', query: { date: currentDate.toISOString() } }}> 
                    <h3 className="text-lg font-light text-primary hover:text-primary/80 transition-colors">🗓️ {t('journal_todaysSchedule')}</h3> 
                </Link>
                <Button variant="ghost" size="sm" onClick={addScheduleItem} className="gap-1 text-primary hover:bg-primary hover:text-white transition-colors">{t('journal_addSchedule')}</Button>
            </CardHeader>
            <CardContent className="h-auto">
                <div className="space-y-3 h-auto">
                    {(currentDay.diary?.todaysSchedule || []).map((item) => (
                        <div key={item.id} className="flex items-start gap-2 group h-auto">
                            <div className="w-40"><TimePicker value={item.time} onChange={(nt) => updateScheduleItem(item.id, { time: nt })} /></div>
                            <Input value={item.content} onChange={(e) => updateScheduleItem(item.id, { content: e.target.value })} placeholder="..." className="flex-1 bg-white/50 placeholder:text-[13px] placeholder:text-muted-foreground/60 bg-transparent" />
                            <Button onClick={() => removeScheduleItem(item.id)} size="icon" variant="ghost" className="text-destructive"><X className="h-4 w-4" /></Button>
                        </div>
                    ))}
                    {(!currentDay.diary?.todaysSchedule?.length) && (<div className="flex items-center justify-center h-24 text-sm text-muted-foreground"><p>{t('journal_addSchedulePrompt')}</p></div>)}
                </div>
            </CardContent>
        </Card>
        
        <Card className="h-auto border-indigo-100">
            <CardHeader className="pb-4 border-b">
                <h3 className="text-lg font-black text-primary flex items-center gap-2">
                    <FilePenLine className="h-5 w-5" />
                    {t('journal_dailyLifeSummary')}
                </h3>
            </CardHeader>
            <CardContent className="h-auto space-y-6 pt-6">
                <div className="space-y-2 h-auto">
                    <Textarea 
                        value={currentDay.diary.reflection?.dailySummary || ''} 
                        onChange={(e) => updateReflection('dailySummary', e.target.value)} 
                        onInput={handleTextareaInput}
                        placeholder={t('journal_dailyLifeSummaryPlaceholder')} 
                        className="min-h-[150px] bg-white/40 placeholder:text-[13px] placeholder:text-muted-foreground/60 h-auto resize-none overflow-hidden leading-relaxed border-indigo-50"
                    />
                </div>

                <Separator className="bg-indigo-100/50" />

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-primary/70 uppercase tracking-wider flex items-center gap-2">
                            <ImageIcon className="h-4 w-4" />
                            {t('journal_addPhotoPrompt')}
                        </Label>
                        <div className="flex items-center gap-2">
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                            <Button 
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()} 
                                disabled={isUploadingPhoto || (currentDay.diary?.reflection?.photos || []).length >= 5}
                                className="h-8 rounded-full border-primary/30 text-primary hover:bg-primary/5"
                            >
                                {isUploadingPhoto ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Camera className="mr-2 h-3 w-3" />}
                                {t('peoples_upload')}
                            </Button>
                        </div>
                    </div>

                    {currentDay.diary.reflection?.photos && currentDay.diary.reflection.photos.length > 0 ? (
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                            {currentDay.diary.reflection.photos.map((photo) => (
                                <div 
                                    key={photo.id} 
                                    className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 shadow-sm cursor-pointer group hover:ring-2 hover:ring-primary transition-all"
                                >
                                    <img src={photo.url} alt="Daily Life" className="w-full h-full object-cover" onClick={() => setSelectedPhotoId(photo.id)} />
                                    <Button 
                                        variant="destructive" 
                                        size="icon" 
                                        className="absolute top-1 right-1 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 shadow-lg scale-75 group-hover:scale-100"
                                        onClick={(e) => { e.stopPropagation(); deletePhoto(photo.id); }}
                                    >
                                        <Trash2 className="h-2.5 w-2.5" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
            </CardContent>
        </Card>

        <div className="flex justify-between items-end border-b border-indigo-100 pb-2 pt-4 h-auto"><h2 className="text-xl font-semibold text-primary h-auto">🤔 {t('journal_todaysLife')}</h2></div>

        <Card className="h-auto border-indigo-100">
            <CardHeader className="pb-2"><h3 className="text-lg font-light text-primary">✨ {t('journal_godExperience')}</h3></CardHeader>
            <CardContent className="h-auto">
                <Textarea 
                    value={currentDay.diary.reflection?.godExperience || ''} 
                    onChange={(e) => updateReflection('godExperience', e.target.value)} 
                    onInput={handleTextareaInput}
                    placeholder={t('journal_godExperiencePlaceholder')} 
                    className="min-h-[80px] bg-white/40 placeholder:text-[13px] placeholder:text-muted-foreground/60 h-auto resize-none overflow-hidden"
                />
            </CardContent>
        </Card>

        <Card className="h-auto border-indigo-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <h3 className="text-lg font-light text-primary flex items-center gap-2"><Users className="h-5 w-5" /> {t('journal_timeWithPeople')}</h3>
                <div className="flex items-center gap-2">
                    <PeoplePicker 
                        open={peoplePopoverOpen} 
                        onOpenChange={setPeoplePopoverOpen} 
                        search={peopleSearch} 
                        setSearch={setPeopleSearch} 
                        filteredList={filteredPeoples} 
                        onSelect={handleAddInteraction} 
                    />
                    <Button variant="ghost" size="sm" onClick={addInteractionEmpty} className="gap-1 text-primary hover:bg-primary hover:text-white transition-colors">{t('journal_addInteraction')}</Button>
                </div>
            </CardHeader>
            <CardContent className="h-auto"> 
                <div className="space-y-4 h-auto">
                    {(currentDay.diary?.peopleInteractions || []).length > 0 ? (
                        currentDay.diary.peopleInteractions!.map((interaction) => { 
                            const person = peoples?.find(p => p.id === interaction.personId); 
                            return (
                                <div key={interaction.id} className="flex gap-3 bg-white/50 p-3 rounded-lg border group h-auto">
                                    <Avatar>
                                        <AvatarImage src={person?.avatarUrl} />
                                        <AvatarFallback><span>{person?.name?.charAt(0) || 'U'}</span></AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 h-auto">
                                        <div className="flex items-center justify-between"><p className="text-sm font-medium">{person?.name || '새 인물'}</p><Button onClick={() => removeInteraction(interaction.id)} variant="ghost" size="icon" className="text-destructive h-7 w-7"><X className="h-4 w-4" /></Button></div>
                                        <Textarea 
                                            value={interaction.note} 
                                            onChange={(e) => updateInteractionNote(interaction.id, e.target.value)} 
                                            onInput={handleTextareaInput}
                                            placeholder={t('journal_interactionPlaceholder').replace('{name}', person?.name || '')} 
                                            className="text-sm border-none p-0 shadow-none placeholder:text-[13px] placeholder:text-muted-foreground/60 h-auto resize-none overflow-hidden" 
                                            rows={1}
                                        />
                                    </div>
                                </div>
                            ); 
                        })
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 bg-muted/20 rounded-xl border border-dashed gap-3">
                            <Users className="h-8 w-8 text-primary opacity-20" />
                            <p className="text-xs text-muted-foreground">{t('journal_noInteraction')}</p>
                            <Button variant="outline" size="sm" onClick={() => setPeoplePopoverOpen(true)} className="h-8 rounded-full border-primary text-primary hover:bg-primary/10">
                                <Plus className="h-3.5 w-3.5 mr-1" /> {t('journal_addInteraction')}
                            </Button>
                        </div>
                    )}
                </div> 
            </CardContent>
        </Card>

        <Card className="h-auto border-indigo-100">
            <CardHeader className="pb-2"><h3 className="text-lg font-light text-primary">💛 {t('journal_myself')}</h3></CardHeader>
            <CardContent className="space-y-4 h-auto">
                <Textarea 
                    value={currentDay.diary.reflection?.hardestMoment || ''} 
                    onChange={(e) => updateReflection('hardestMoment', e.target.value)} 
                    onInput={handleTextareaInput}
                    placeholder={t('journal_hardestMomentPlaceholder')} 
                    className="min-h-[60px] bg-white/40 placeholder:text-[13px] placeholder:text-muted-foreground/60 h-auto resize-none overflow-hidden"
                />
                <Textarea 
                    value={currentDay.diary.reflection?.obedienceRepentance || ''} 
                    onChange={(e) => updateReflection('obedienceRepentance', e.target.value)} 
                    onInput={handleTextareaInput}
                    placeholder={t('journal_obedienceRepentancePlaceholder')} 
                    className="min-h-[60px] bg-white/40 placeholder:text-[13px] placeholder:text-muted-foreground/60 h-auto resize-none overflow-hidden"
                />
            </CardContent>
        </Card>
        
        <Card className="h-auto border-indigo-100">
            <CardHeader className="pb-2"><h3 className="text-lg font-light text-primary">🧭 {t('journal_lifesDirection')}</h3></CardHeader>
            <CardContent className="space-y-4 h-auto">
                <p className="text-sm h-auto">{t('journal_missionAlignmentQuestion')}</p>
                <div className="flex gap-4 h-auto">
                    <Select value={currentDay.diary.reflection?.missionAlignmentChoice || ''} onValueChange={(val) => updateReflection('missionAlignmentChoice', val as any)}>
                        <SelectTrigger className="w-[120px] h-10"><SelectValue placeholder={t('journal_missionAlignmentSelect')} /></SelectTrigger>
                        <SelectContent><SelectItem value="yes">{t('journal_yes')}</SelectItem><SelectItem value="no">{t('journal_no')}</SelectItem><SelectItem value="unsure">{t('journal_notSure')}</SelectItem></SelectContent>
                    </Select>
                    <Input value={currentDay.diary.reflection?.missionAlignment || ''} onChange={(e) => updateReflection('missionAlignment', e.target.value)} placeholder={t('journal_missionAlignmentRecord')} className="flex-1 h-10 bg-white/60 placeholder:text-[13px] placeholder:text-muted-foreground/60" />
                </div>
            </CardContent>
        </Card>
        
        <Card className="h-auto border-indigo-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <h3 className="text-lg font-light text-primary flex items-center gap-2"><Coins className="h-5 w-5 text-amber-500" /> {t('journal_meaningfulExpenditure')}</h3>
                <div className="flex items-center gap-2">
                    <PeoplePicker 
                        open={expenditurePeoplePopoverOpen} 
                        onOpenChange={setExpenditurePeoplePopoverOpen} 
                        search={expenditurePeopleSearch} 
                        setSearch={setExpenditurePeopleSearch} 
                        filteredList={filteredExpenditurePeoples} 
                        onSelect={handleAddPersonExpenditure} 
                    />
                    <Button variant="ghost" size="sm" onClick={addExpenditureItem} className="gap-1 text-primary hover:bg-primary hover:text-white transition-colors">{t('journal_addExpenditure')}</Button>
                </div>
            </CardHeader>
            <CardContent className="h-auto">
                <div className="space-y-3 h-auto"> 
                    {(currentDay.diary?.expenditures || []).length > 0 ? ( 
                        currentDay.diary.expenditures!.map((exp) => ( 
                            <div key={exp.id} className="flex items-center gap-2 p-2 bg-white/60 rounded-lg border border-indigo-50 group h-auto">
                                {exp.personId && (
                                    <Avatar className="h-9 w-9 border">
                                        <AvatarImage src={peoples?.find(p => p.id === exp.personId)?.avatarUrl} />
                                        <AvatarFallback><span>{peoples?.find(p => p.id === exp.personId)?.name.charAt(0) || 'U'}</span></AvatarFallback>
                                    </Avatar>
                                )}
                                <Input value={exp.title} onChange={(e) => updateExpenditureItem(exp.id, { title: e.target.value })} placeholder={t('journal_expenditurePlaceholder')} className="flex-1 border-none shadow-none placeholder:text-[13px] placeholder:text-muted-foreground/60 bg-transparent" />
                                <Input type="text" value={exp.amount === 0 ? '' : exp.amount.toLocaleString('ko-KR')} onChange={(e) => updateExpenditureItem(exp.id, { amount: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} placeholder={t('journal_amountPlaceholder')} className="w-24 border-none shadow-none text-right placeholder:text-[13px] placeholder:text-muted-foreground/60 bg-transparent font-mono" />
                                <Button onClick={() => removeExpenditureItem(exp.id)} size="icon" variant="ghost" className="text-destructive shrink-0 h-7 w-7"><X className="h-4 w-4" /></Button>
                            </div> 
                        )) 
                    ) : ( <p className="text-sm text-muted-foreground text-center py-4">{t('journal_addExpenditurePrompt')}</p> )} 
                </div>
            </CardContent>
        </Card>
        
        <Card className="h-auto border-indigo-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <h3 className="text-lg font-light text-primary flex items-center gap-2"><Heart className="h-5 w-5 text-red-500" /> {t('journal_todaysGratitude')}</h3>
                <div className="flex items-center gap-2">
                    <PeoplePicker 
                        open={gratitudePeoplePopoverOpen} 
                        onOpenChange={setGratitudePeoplePopoverOpen} 
                        search={gratitudePeopleSearch} 
                        setSearch={setGratitudePeopleSearch} 
                        filteredList={filteredGratitudePeoples} 
                        onSelect={handleAddPersonGratitude} 
                    />
                    <Button variant="ghost" size="sm" onClick={addGratitudeItem} className="gap-1 text-primary hover:bg-primary hover:text-white transition-colors">{t('journal_addGratitude')}</Button>
                </div>
            </CardHeader>
            <CardContent className="h-auto"> 
                <div className="space-y-3 h-auto">
                    {(currentDay.diary?.gratitudes || []).length > 0 ? (
                        currentDay.diary.gratitudes!.map((g) => (
                            <div key={g.id} className="flex items-center gap-2 p-2 bg-white/60 rounded-lg border border-indigo-50 group h-auto">
                                {g.personId && (
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={peoples?.find(p => p.id === g.personId)?.avatarUrl} />
                                        <AvatarFallback><span>{peoples?.find(p => p.id === g.personId)?.name?.charAt(0) || 'U'}</span></AvatarFallback>
                                    </Avatar>
                                )}
                                <Input value={g.title} onChange={(e) => updateGratitudeItem(g.id, { title: e.target.value })} placeholder={t('journal_gratitudePlaceholder')} className="flex-1 border-none shadow-none placeholder:text-[13px] placeholder:text-muted-foreground/60 bg-transparent" />
                                <Button onClick={() => setSelectedGratitudeId(g.id)} size="sm" variant="outline">{t('journal_shareHeart')}</Button>
                                <Button onClick={() => removeGratitudeItem(g.id)} size="icon" variant="ghost" className="text-destructive h-7 w-7"><X className="h-4 w-4" /></Button>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 bg-muted/20 rounded-xl border border-dashed gap-3">
                            <Heart className="h-8 w-8 text-primary opacity-20" />
                            <p className="text-xs text-muted-foreground">{t('journal_addGratitudePrompt')}</p>
                            <Button variant="outline" size="sm" onClick={addGratitudeItem} className="h-8 rounded-full border-primary text-primary hover:bg-primary/10">
                                <Plus className="h-3.5 w-3.5 mr-1" /> {t('journal_addGratitude')}
                            </Button>
                        </div>
                    )}
                </div> 
            </CardContent>
        </Card>
        
        <div className="flex justify-between items-end border-b border-indigo-100 pb-2 pt-4 h-auto"><h2 className="text-xl font-semibold text-primary h-auto">🌿 {t('journal_dailyCheck')}</h2><span className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary/80 pb-1 h-auto">DAILY CHECK</span></div>
        <Card className="h-auto border-indigo-100">
            <CardContent className="pt-6 space-y-6 h-auto">
                <DailyCheckSlider labelTitle={t('journal_closenessToGod_title')} labelDesc={t('journal_closenessToGod_desc')} value={currentDay.diary?.dailyCheck?.closenessToGod || 5} onValueChange={(val) => updateDailyCheck('closenessToGod', val)} />
                <DailyCheckSlider labelTitle={t('journal_relationships_title')} labelDesc={t('journal_relationships_desc')} value={currentDay.diary?.dailyCheck?.relationships || 5} onValueChange={(val) => updateDailyCheck('relationships', val)} />
                <DailyCheckSlider labelTitle={t('journal_innerPeace_title')} labelDesc={t('journal_innerPeace_desc')} value={currentDay.diary?.dailyCheck?.innerPeace || 5} onValueChange={(val) => updateDailyCheck('innerPeace', val)} />
                <DailyCheckSlider labelTitle={t('journal_senseOfPurpose_title')} labelDesc={t('journal_senseOfPurpose_desc')} value={currentDay.diary?.dailyCheck?.senseOfPurpose || 5} onValueChange={(val) => updateDailyCheck('senseOfPurpose', val)} />
                <DailyCheckSlider labelTitle={t('journal_thankfulness_title')} labelDesc={t('journal_thankfulness_desc')} value={currentDay.diary?.dailyCheck?.thankfulness || 5} onValueChange={(val) => updateDailyCheck('thankfulness', val)} />
            </CardContent>
        </Card>
        
        <Card className="h-auto border-indigo-100">
            <CardHeader className="pb-2"><h3 className="text-lg font-light text-primary">🙏 {t('journal_finalPrayer')}</h3></CardHeader>
            <CardContent className="h-auto">
                <Textarea 
                    value={currentDay.diary.reflection?.gratitudeJournal || ''} 
                    onChange={(e) => updateReflection('gratitudeJournal', e.target.value)} 
                    onInput={handleTextareaInput}
                    placeholder={t('journal_finalPrayerPlaceholder')} 
                    className="min-h-[100px] bg-white/40 placeholder:text-[13px] placeholder:text-muted-foreground/60 h-auto resize-none overflow-hidden" 
                    readOnly={isRecording || isTranscribing}
                />
                {currentDay.diary.reflection?.gratitudeJournalAudioUrl && !isRecording && (
                    <div className="mt-4 h-auto">
                        <audio controls src={currentDay.diary.reflection.gratitudeJournalAudioUrl} className="w-full h-10" />
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex-row-reverse pb-4 h-auto">
                <Button variant="outline" size="icon" onClick={handleToggleRecording} disabled={isTranscribing} className={cn(isRecording && "text-red-500 border-red-500")}>
                    {isTranscribing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                </Button>
            </CardFooter>
        </Card>
        
        {currentDay.diary.reflection?.dailySummary?.trim() && !currentDay.diary.reflection?.dailyAiReflection && (
            <div className="pt-4 h-auto">
                <Button onClick={handleFinishDay} disabled={anyAiLoading} variant="outline" size="sm" className="w-full bg-primary/10 text-primary h-12 rounded-full font-bold shadow-lg border-primary/20 hover:bg-primary/20">
                    {isFinishingDay ? <LoaderCircle className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
                    {t('journal_finishDay')}
                </Button>
            </div>
        )}
        {currentDay.diary.reflection?.dailyAiReflection && (
            <Card className="h-auto border-indigo-100">
                <CardHeader><h3 className="text-lg font-light text-primary">{t('journal_aiReflection')}</h3></CardHeader>
                <CardContent className="h-auto">
                    <p className="text-lg text-slate-600 bg-primary/5 p-4 rounded-md h-auto">{currentDay.diary.reflection.dailyAiReflection}</p>
                </CardContent>
            </Card>
        )}
    </div>
  );

  return (
    <div className="h-screen bg-[#2e2848] flex flex-col font-sans overflow-hidden">
      <header className="relative w-full bg-[#2e2848] backdrop-blur-sm py-2 px-10 shadow-sm flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 overflow-hidden shrink-0 z-50 min-w-[360px]">
          <SpiritualWave activityLevel={waveActivityLevel} className="opacity-40 z-0" />
          <div className="relative z-10 flex flex-col border-r border-slate-600 pr-4 shrink-0">
              <h1 className="text-xl font-black tracking-tighter flex items-center font-sans">
                  <span className="text-primary">Word</span> <span className="mx-1 text-white">N</span> <span className="text-accent">Walks</span>
              </h1>
              <p className="text-[10px] font-light text-slate-300 -mt-1 tracking-tight">Walk with the Word.</p>
          </div>

          <nav className="relative z-10 flex-1 flex flex-wrap justify-center items-center gap-x-2 gap-y-1 py-1">
            <Link href="/journal" className={cn(buttonVariants({ variant: 'ghost' }), pathname === '/journal' ? "text-white bg-white/10" : "text-slate-300 hover:bg-white/10 hover:text-white", "flex flex-col items-center justify-center h-auto p-1.5 gap-0.5 w-16 lg:w-20")}>
                <Home className="h-6 w-6 lg:h-7 lg:w-7" /><span className="text-[10px] lg:text-xs font-medium">{t('home')}</span>
            </Link>
            <Link href="/peoples" className={cn(buttonVariants({ variant: 'ghost' }), pathname === '/peoples' ? "text-white bg-white/10" : "text-slate-300 hover:bg-white/10 hover:text-white", "flex flex-col items-center justify-center h-auto p-1.5 gap-0.5 w-16 lg:w-20")}>
                <Users className="h-6 w-6 lg:h-7 lg:w-7" /><span className="text-[10px] lg:text-xs font-medium">{t('peoples')}</span>
            </Link>
            <Link href="/calendar" className={cn(buttonVariants({ variant: 'ghost' }), pathname === '/calendar' ? "text-white bg-white/10" : "text-slate-300 hover:bg-white/10 hover:text-white", "flex flex-col items-center justify-center h-auto p-2 gap-0.5 w-16 lg:w-20")}>
                <CalendarDays className="h-6 w-6 lg:h-7 lg:w-7" /><span className="text-[10px] lg:text-xs font-medium">{t('schedule')}</span>
            </Link>
            <Link href="/stats" className={cn(buttonVariants({ variant: 'ghost' }), pathname === '/stats' ? "text-white bg-white/10" : "text-slate-300 hover:bg-white/10 hover:text-white", "flex flex-col items-center justify-center h-auto p-2 gap-0.5 w-16 lg:w-20")}>
                <FilePenLine className="h-6 w-6 lg:h-7 lg:w-7" /><span className="text-[10px] lg:text-xs font-medium">{t('reports')}</span>
            </Link>
            <Link href="/prayer-room" className={cn(buttonVariants({ variant: 'ghost' }), pathname === '/prayer-room' ? "text-white bg-white/10" : "text-slate-300 hover:bg-white/10 hover:text-white", "flex flex-col items-center justify-center h-auto p-2 gap-0.5 w-16 lg:w-20")}>
                <Hand className="h-6 w-6 lg:h-7 lg:w-7" /><span className="text-[10px] lg:text-xs font-medium">{t('prayers')}</span>
            </Link>
            <Link href="/forum" className={cn(buttonVariants({ variant: 'ghost' }), pathname === '/forum' ? "text-white bg-white/10" : "text-slate-300 hover:bg-white/10 hover:text-white", "flex flex-col items-center justify-center h-auto p-1.5 gap-0.5 w-16 lg:w-20")}>
                <MessageSquare className="h-6 w-6 lg:h-7 lg:w-7" /><span className="text-[10px] lg:text-xs font-medium">{t('forum')}</span>
            </Link>
            <Link href="/groups" className={cn(buttonVariants({ variant: 'ghost' }), pathname === '/groups' ? "text-white bg-white/10" : "text-slate-300 hover:bg-white/10 hover:text-white", "flex flex-col items-center justify-center h-auto p-1.5 gap-0.5 w-16 lg:w-20")}>
                <Shapes className="h-6 w-6 lg:h-7 lg:w-7" /><span className="text-[10px] lg:text-xs font-medium">{t('groups')}</span>
            </Link>
            {isSuperAdmin ? (
                <Link href="/admin" className={cn(buttonVariants({ variant: 'ghost' }), "text-orange-400 hover:bg-white/10 hover:text-orange-300 flex flex-col items-center justify-center h-auto p-1.5 gap-0.5 w-16 lg:w-20")}>
                    <ShieldCheck className="h-6 w-6 lg:h-7 lg:w-7" /><span className="text-[10px] lg:text-xs font-medium">관리자</span>
                </Link>
            ) : isOrgAdmin ? (
                <Link href="/org-admin" className={cn(buttonVariants({ variant: 'ghost' }), "text-orange-400 hover:bg-white/10 hover:text-orange-300 flex flex-col items-center justify-center h-auto p-1.5 gap-0.5 w-16 lg:w-20")}>
                    <ShieldCheck className="h-6 w-6 lg:h-7 lg:w-7" /><span className="text-[10px] lg:text-xs font-medium">{t('groups_adminCenter')}</span>
                </Link>
            ) : null}
          </nav>

          <div className="relative z-10 flex items-center gap-2 shrink-0">
              <LanguageSelect />
              <Button variant="ghost" className="h-8 px-2 text-slate-300 hover:bg-white/10 hover:text-white hidden sm:flex" onClick={() => router.push('/feedback')}>
                  <MessageSquareQuote className="h-4 w-4 mr-1 lg:mr-2" /><span className="text-xs lg:text-sm">{t('feedback')}</span>
              </Button>
              {user && (
                  <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 lg:h-9 lg:w-9 rounded-full p-0 hover:bg-white/10">
                          <Avatar className="h-8 w-8 lg:h-9 lg:w-9">
                            <AvatarImage src={profile?.profilePictureUrl} alt={profile?.displayName} />
                            <AvatarFallback><span>{profile?.displayName?.charAt(0) || 'U'}</span></AvatarFallback>
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
                      <DropdownMenuItem onClick={handleSignOutAction}>
                        <LogOut className="mr-2 h-4 w-4" /><span>{t('logOut')}</span>
                      </DropdownMenuItem>
                  </DropdownMenuContent>
                  </DropdownMenu>
              )}
          </div>
      </header>

      <main className="relative w-full flex-1 bg-[#fafafa] paper-texture rounded-[10px] shadow-inner border-[1px] border-[#2e2848] flex flex-col min-h-0 overflow-hidden">
        <div className="hidden lg:flex flex-1 overflow-hidden relative">
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1px] bg-slate-300 z-10" />
            
            <div className="flex-1 flex flex-col min-h-0">
                <div className="px-5 md:px-7 h-20 shrink-0 flex items-center justify-between border-b bg-transparent">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-black text-accent">{t('meditation')}</h2>
                        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent/60">Quiet Time</span>
                    </div>
                    <div className="flex items-center gap-1 bg-white/50 border border-slate-200 rounded-full p-1 shadow-sm">
                        <Button variant="ghost" size="icon" onClick={() => changeDate(-1)} className="rounded-full h-8 w-8 hover:bg-accent/10">
                            <ChevronLeft className="h-5 w-5 text-accent" />
                        </Button>
                        <Link 
                            href={{ pathname: '/calendar', query: { date: dateString } }}
                            className="text-sm font-bold text-slate-800 px-3 py-1 hover:text-accent transition-colors"
                        >
                            {format(currentDate, 'yyyy. MM. dd (eee)', { locale: currentLocale })}
                        </Link>
                        <Button variant="ghost" size="icon" onClick={() => changeDate(1)} className="rounded-full h-8 w-8 hover:bg-accent/10">
                            <ChevronRight className="h-5 w-5 text-accent" />
                        </Button>
                    </div>
                </div>
                <ScrollArea className="flex-1">
                    <div className="p-5 md:p-7 pt-5 space-y-5 pb-28">
                        {qtSection}
                    </div>
                </ScrollArea>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
                <div className="px-5 md:px-7 h-20 shrink-0 flex items-center justify-between border-b bg-transparent">
                    <div className="flex items-end gap-3">
                        <h2 className="text-lg font-black text-primary">{t('dailyWalk')}</h2>
                        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary/60 pb-1">DAILY WALK</span>
                    </div>
                    <Button variant="ghost" className="text-primary hover:bg-primary/5 gap-2 font-bold" onClick={() => setOverlayMode('community')}>
                        <Building className="h-5 w-5" />
                        {`${profile?.memberships?.[0]?.organizationName || 'Church'} 소식`}
                    </Button>
                </div>
                <ScrollArea className="flex-1">
                    <div className="p-5 md:p-7 pt-5 space-y-5 pb-28">
                        {diarySection}
                    </div>
                </ScrollArea>
            </div>
        </div>

        <div className="flex lg:hidden flex-1 overflow-hidden">
            <Tabs defaultValue="meditation" className="w-full flex flex-col h-full">
                <div className="px-4 py-2 border-b bg-white/80 sticky top-0 z-20">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <Button variant="ghost" size="icon" onClick={() => changeDate(-1)} className="h-8 w-8"><ChevronLeft className="h-4 w-4"/></Button>
                        <span className="text-sm font-bold">{format(currentDate, 'yyyy. MM. dd', { locale: currentLocale })}</span>
                        <Button variant="ghost" size="icon" onClick={() => changeDate(1)} className="h-8 w-8"><ChevronRight className="h-4 w-4"/></Button>
                    </div>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="meditation" className="font-bold">{t('meditation')}</TabsTrigger>
                        <TabsTrigger value="diary" className="font-bold">{t('dailyWalk')}</TabsTrigger>
                    </TabsList>
                </div>
                <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                        <TabsContent value="meditation" className="mt-0 focus-visible:ring-0">
                            {qtSection}
                        </TabsContent>
                        <TabsContent value="diary" className="mt-0 focus-visible:ring-0">
                            <div className="px-4 py-3 flex justify-end">
                                <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/5 gap-2 font-bold" onClick={() => setOverlayMode('community')}>
                                    <Building className="h-4 w-4" />
                                    소식 보기
                                </Button>
                            </div>
                            {diarySection}
                        </TabsContent>
                    </ScrollArea>
                </div>
            </Tabs>
        </div>
        
        {(overlayMode === 'community' || (overlayMode === 'bible' && currentDay.qt.verses)) && (
            <div className="absolute inset-y-0 right-0 w-full lg:w-1/2 bg-background z-[100] shadow-2xl border-l animate-in slide-in-from-right duration-300">
                {overlayMode === 'bible' && <BibleContent qt={currentDay.qt} onCloseBible={() => setOverlayMode('none')} />}
                {overlayMode === 'community' && (
                    <CommunityContent 
                        orgContent={orgDailyContent} 
                        orgEvents={activePromotedEvents}
                        orgName={profile?.memberships?.[0]?.organizationName || 'Church'} 
                        onClose={() => setOverlayMode('none')} 
                        t={t}
                    />
                )}
            </div>
        )}
      </main>
      
      <Dialog open={!!activeSelectedPhoto} onOpenChange={(open) => !open && setSelectedPhotoId(null)}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-none rounded-xl [&>button]:hidden">
              <DialogHeader className="sr-only">
                  <DialogTitle>기록된 사진</DialogTitle>
              </DialogHeader>
              {activeSelectedPhoto && (
                  <div className="relative w-full h-full flex flex-col items-center justify-center p-6 gap-4">
                      <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-white hover:bg-white/20 z-50 rounded-full h-10 w-10" onClick={() => setSelectedPhotoId(null)}>
                          <X className="h-6 w-6" />
                      </Button>
                      <div className="relative w-full max-h-[70vh] flex items-center justify-center">
                          <img 
                            src={activeSelectedPhoto.url} 
                            alt="Daily Reflection" 
                            className="max-w-full max-h-full object-contain shadow-2xl border-[0.5px] border-white/20 rounded-md" 
                          />
                      </div>
                      <div className="w-full max-w-md space-y-4">
                          <Input 
                            value={activeSelectedPhoto.caption} 
                            onChange={(e) => updatePhotoCaption(activeSelectedPhoto.id, e.target.value)} 
                            placeholder="이 사진에 대한 짧은 설명을 적어주세요..."
                            className="bg-white/10 text-white border-white/20 h-10 focus-visible:ring-primary text-center"
                          />
                          <div className="flex justify-end gap-2">
                              <Button variant="ghost" className="text-green-400 font-bold" onClick={() => setSelectedPhotoId(null)}><Check className="mr-2 h-4 w-4" />{t('save')}</Button>
                              <Button variant="ghost" className="text-red-400 font-bold" onClick={() => deletePhoto(activeSelectedPhoto.id)}><Trash2 className="mr-2 h-4 w-4" />{t('delete')}</Button>
                          </div>
                      </div>
                  </div>
              )}
          </DialogContent>
      </Dialog>

      {selectedPrayer && (<PrayerFeedbackDialog prayer={selectedPrayer} onClose={() => setSelectedPrayerId(null)} onUpdateFeedbacks={(f) => updatePrayerItem(selectedPrayer.id, { feedbacks: f })} />)}
      {selectedGratitude && (<GratitudeFeedbackDialog gratitude={selectedGratitude} onClose={() => setSelectedGratitudeId(null)} onUpdateFeedbacks={(f) => updateGratitudeItem(selectedGratitude.id, { feedbacks: f })} />)}
    </div>
  );
};

export default JournalPage;
