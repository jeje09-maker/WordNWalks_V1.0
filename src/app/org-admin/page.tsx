
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase, updateDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, where, serverTimestamp, limit, orderBy } from 'firebase/firestore';
import type { UserProfile, Organization, OrgDailyContent, ScheduleItem, SmallGroup, ContentBlock, OrgEvent, PrayerPost } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import { 
    Settings, Users, CalendarDays, BookOpen, Plus, Trash2, Save, 
    MessageSquare, ArrowLeft, LayoutDashboard, ChevronLeft, ChevronRight, Megaphone, Target, ShieldCheck,
    Building, UserCog, Edit, X, Sparkles, LoaderCircle, Wand2, Type, Image as ImageIcon, Video, AlignLeft, AlignCenter, AlignRight, Bold,
    ArrowUp, ArrowDown, Calendar as CalendarIcon, Clock, MegaphoneOff, Hand, Eye, EyeOff, Shapes, Home, FilePenLine, User as UserIcon, LogOut, MessageSquareQuote
} from 'lucide-react';
import { format, addDays, startOfToday, subDays } from 'date-fns';
import { ko as koLocale } from 'date-fns/locale';
import { useRouter, usePathname, Link } from 'next/navigation';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import React from 'react';
import { generateBibleSegmentContentAction } from '@/app/journal/actions';
import { languages } from '@/lib/i18n';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import TimePicker from '@/app/journal/components/TimePicker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { SpiritualWave } from '@/components/ui/spiritual-wave';
import LanguageSelect from '@/components/language-select';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/firebase';

const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

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
                    <React.Fragment key={`verse-${number}-${i}`}>
                        <sup className="text-muted-foreground font-sans font-medium text-sm mr-1 -top-1 relative">{number}</sup>
                        <span className={cn(isKeyVerse && 'text-orange-600 font-bold bg-orange-50/80 rounded px-1')}>
                            {text}
                        </span>{' '}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

const DateNavigator = ({ date, onChange }: { date: Date, onChange: (d: Date) => void }) => {
    const { t } = useTranslation();
    const [viewDate, setViewDate] = useState(date);
    
    useEffect(() => {
        setViewDate(date);
    }, [date]);

    return (
        <div className="flex items-center gap-1 bg-white border rounded-lg p-1 shadow-sm">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md" onClick={() => onChange(subDays(date, 1))}><ChevronLeft className="h-4 w-4"/></Button>
            
            <div className="relative flex items-center">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="h-8 w-[140px] px-2 font-bold text-xs justify-between gap-2 border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary">
                            <span className="flex items-center gap-2">
                                <CalendarIcon className="h-3.5 w-3.5" />
                                {format(date, 'yyyy-MM-dd')}
                            </span>
                            <X className="h-3 w-3 opacity-50 hover:opacity-100" onClick={(e) => { e.stopPropagation(); onChange(startOfToday()); }} />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="center">
                        <Calendar
                            mode="single"
                            selected={date}
                            month={viewDate}
                            onMonthChange={setViewDate}
                            onSelect={(d) => {
                                if (d) {
                                    onChange(d);
                                }
                            }}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>
            </div>

            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md" onClick={() => onChange(addDays(date, 1))}><ChevronRight className="h-4 w-4"/></Button>
        </div>
    );
};

export default function OrgAdminPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const auth = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const { toast } = useToast();
    const { lang, t } = useTranslation();

    const [activeTab, setActiveTab] = useState('dashboard');
    const [selectedDate, setSelectedDate] = useState(startOfToday());
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [editingGroup, setEditingGroup] = useState<SmallGroup | null>(null);
    const [groupFormData, setGroupFormData] = useState({ name: '', description: '', leaderId: '' });
    
    const [isGeneratingAi, setIsGeneratingAi] = useState(false);
    const [newSchedule, setNewSchedule] = useState({ time: '오전 09:00', content: '' });

    const [isCreatingEvent, setIsCreatingEvent] = useState(false);
    const [editingEvent, setEditingEvent] = useState<OrgEvent | null>(null);
    const [eventFormData, setEventFormData] = useState<Partial<OrgEvent>>({
        title: '',
        date: format(startOfToday(), 'yyyy-MM-dd'),
        time: '오전 11:00',
        promotionStartType: '1week',
        materialBlocks: []
    });

    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
    const { data: profile } = useDoc<UserProfile>(userDocRef);

    const adminOrgs = useMemo(() => {
        const memberships = profile?.memberships || [];
        const isSuper = user?.email === 'darak303@naver.com' || user?.uid === '4PYWOqRk1dXhVt5NXe5DZq7Fa4Q2' || profile?.isAdmin;
        if (isSuper) return memberships;
        return memberships.filter(m => m.role === 'admin');
    }, [profile, user]);

    const [activeOrgId, setActiveOrgId] = useState<string | null>(null);

    useEffect(() => {
        if (adminOrgs.length > 0 && !activeOrgId) {
            setActiveOrgId(adminOrgs[0].organizationId);
        }
    }, [adminOrgs, activeOrgId]);

    const canQuery = useMemo(() => {
        if (!user || !profile) return false;
        const isSuper = user.email === 'darak303@naver.com' || user.uid === '4PYWOqRk1dXhVt5NXe5DZq7Fa4Q2' || profile.isAdmin;
        const isGroupAdmin = profile.isGroupAdmin || (profile.memberships && profile.memberships.some(m => m.role === 'admin'));
        return isSuper || isGroupAdmin;
    }, [user, profile]);

    const orgRef = useMemoFirebase(() => 
        (activeOrgId && canQuery) ? doc(firestore, 'organizations', activeOrgId) : null,
        [activeOrgId, canQuery, firestore]
    );
    const { data: org, isLoading: isOrgLoading } = useDoc<Organization>(orgRef);

    const dailyContentRef = useMemoFirebase(() => 
        (activeOrgId && canQuery) ? doc(firestore, 'organizations', activeOrgId, 'dailyContent', dateStr) : null,
        [activeOrgId, canQuery, dateStr, firestore]
    );
    const { data: dailyContent, isLoading: isContentLoading } = useDoc<OrgDailyContent>(dailyContentRef);

    const membersQuery = useMemoFirebase(() => {
        if (!activeOrgId || !canQuery || !firestore) return null;
        return query(collection(firestore, 'users'), where('membershipIds', 'array-contains', activeOrgId));
    }, [activeOrgId, canQuery, firestore]);
    const { data: members } = useCollection<UserProfile>(membersQuery);

    const groupsQuery = useMemoFirebase(() => {
        if (!activeOrgId || !canQuery || !firestore) return null;
        return query(collection(firestore, 'organizations', activeOrgId, 'smallGroups'), orderBy('name', 'asc'));
    }, [activeOrgId, canQuery, firestore]);
    const { data: smallGroups } = useCollection<SmallGroup>(groupsQuery);

    const eventsQuery = useMemoFirebase(() => {
        if (!activeOrgId || !canQuery || !firestore) return null;
        return query(collection(firestore, 'organizations', activeOrgId, 'events'), orderBy('date', 'asc'));
    }, [activeOrgId, canQuery, firestore]);
    const { data: events } = useCollection<OrgEvent>(eventsQuery);

    const sharedPrayersQuery = useMemoFirebase(() => {
        if (!activeOrgId || !canQuery || !firestore) return null;
        return query(collection(firestore, 'prayerPosts'), where('organizationId', '==', activeOrgId), orderBy('createdAt', 'desc'));
    }, [activeOrgId, canQuery, firestore]);
    const { data: sharedPrayers } = useCollection<PrayerPost>(sharedPrayersQuery);

    const [editingOrg, setEditingOrg] = useState<Partial<Organization>>({});
    const [editingDailyContent, setEditingDailyContent] = useState<Partial<OrgDailyContent>>({});

    useEffect(() => {
        if (org) setEditingOrg(org);
    }, [org]);

    useEffect(() => {
        if (dailyContent) {
            setEditingDailyContent(dailyContent);
        } else {
            setEditingDailyContent({ 
                id: dateStr, 
                schedules: [], 
                passage: '', 
                title: '', 
                verses: '', 
                analysis: '', 
                meditationGuide: '', 
                questions: ['', '', ''],
                materialBlocks: []
            });
        }
    }, [dailyContent, dateStr]);

    useEffect(() => {
        const textareas = document.querySelectorAll('textarea');
        textareas.forEach(ta => {
            ta.style.height = 'auto';
            ta.style.height = `${ta.scrollHeight}px`;
        });
    }, [editingOrg, editingDailyContent, activeTab, isCreatingGroup, isCreatingEvent]);

    const handleSaveOrgSettings = () => {
        if (!org) return;
        updateDocumentNonBlocking(doc(firestore, 'organizations', org.id), {
            philosophy: editingOrg.philosophy || '',
            vision: editingOrg.vision || '',
            ministryDirection: editingOrg.ministryDirection || '',
            description: editingOrg.description || '',
            updatedAt: serverTimestamp(),
        });
        toast({ title: t('peoples_updateSuccess') });
    };

    const handleSaveDailyContent = () => {
        if (!org || !dailyContentRef || !activeOrgId) return;
        setDocumentNonBlocking(doc(firestore, 'organizations', activeOrgId, 'dailyContent', dateStr), {
            ...editingDailyContent,
            id: dateStr,
            updatedAt: serverTimestamp(),
        }, { merge: true });
        toast({ title: t('peoples_updateSuccess') });
    };

    const handleGenerateAiContent = async () => {
        if (!editingDailyContent.passage?.trim()) {
            toast({ title: t('journal_biblePassagePlaceholder'), variant: "destructive" });
            return;
        }

        setIsGeneratingAi(true);
        try {
            const languageName = languages.find(l => l.code === lang)?.name || 'Korean';
            const result = await generateBibleSegmentContentAction({ 
                passage: editingDailyContent.passage, 
                language: languageName 
            });

            if (result.error) throw new Error(result.error);

            setEditingDailyContent(prev => ({
                ...prev,
                title: result.title || prev.title,
                verses: result.verses || prev.verses,
                analysis: result.analysis || prev.analysis,
                meditationGuide: result.meditationGuide || prev.meditationGuide,
                questions: result.questions || prev.questions,
                paragraphs: result.paragraphs || prev.paragraphs,
                keyVerses: result.keyVerses || []
            }));

            toast({ title: t('peoples_updateSuccess') });
        } catch (error: any) {
            toast({ variant: "destructive", title: "오류", description: error.message || "생성에 실패했습니다." });
        } finally {
            setIsGeneratingAi(false);
        }
    };

    const addBlock = (type: 'text' | 'image' | 'video', isEvent: boolean = false) => {
        const newBlock: ContentBlock = {
            id: Date.now().toString(),
            type,
            content: '',
            config: type === 'text' ? { fontSize: '16px', color: '#000000', textAlign: 'left', fontWeight: 'normal' } : {}
        };
        if (isEvent) {
            setEventFormData(prev => ({
                ...prev,
                materialBlocks: [...(prev.materialBlocks || []), newBlock]
            }));
        } else {
            setEditingDailyContent(prev => ({
                ...prev,
                materialBlocks: [...(prev.materialBlocks || []), newBlock]
            }));
        }
    };

    const updateBlock = (id: string, updates: Partial<ContentBlock>, isEvent: boolean = false) => {
        if (isEvent) {
            setEventFormData(prev => ({
                ...prev,
                materialBlocks: (prev.materialBlocks || []).map(b => b.id === id ? { ...b, ...updates } : b)
            }));
        } else {
            setEditingDailyContent(prev => ({
                ...prev,
                materialBlocks: (prev.materialBlocks || []).map(b => b.id === id ? { ...b, ...updates } : b)
            }));
        }
    };

    const removeBlock = (id: string, isEvent: boolean = false) => {
        if (isEvent) {
            setEventFormData(prev => ({
                ...prev,
                materialBlocks: (prev.materialBlocks || []).filter(b => b.id !== id)
            }));
        } else {
            setEditingDailyContent(prev => ({
                ...prev,
                materialBlocks: (prev.materialBlocks || []).filter(b => b.id !== id)
            }));
        }
    };

    const moveBlock = (index: number, direction: 'up' | 'down', isEvent: boolean = false) => {
        const blocks = isEvent ? [...(eventFormData.materialBlocks || [])] : [...(editingDailyContent.materialBlocks || [])];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= blocks.length) return;
        const temp = blocks[index];
        blocks[index] = blocks[targetIndex];
        blocks[targetIndex] = temp;
        if (isEvent) {
            setEventFormData(p => ({ ...p, materialBlocks: blocks }));
        } else {
            setEditingDailyContent(p => ({ ...p, materialBlocks: blocks }));
        }
    };

    const handleAddSchedule = () => {
        if (!newSchedule.content.trim()) return;
        const item: ScheduleItem = { id: Date.now().toString(), ...newSchedule };
        setEditingDailyContent(prev => ({
            ...prev,
            schedules: [...(prev.schedules || []), item]
        }));
        setNewSchedule({ time: '오전 09:00', content: '' });
    };

    const removeSchedule = (id: string) => {
        setEditingDailyContent(prev => ({
            ...prev,
            schedules: (prev.schedules || []).filter(s => s.id !== id)
        }));
    };

    const handleSaveEvent = async () => {
        if (!activeOrgId || !eventFormData.title?.trim()) return;
        
        const data: any = {
            ...eventFormData,
            updatedAt: serverTimestamp(),
        };

        if (editingEvent) {
            updateDocumentNonBlocking(doc(firestore, 'organizations', activeOrgId, 'events', editingEvent.id), data);
            toast({ title: t('peoples_updateSuccess') });
        } else {
            await addDocumentNonBlocking(collection(firestore, 'organizations', activeOrgId, 'events'), {
                ...data,
                createdAt: serverTimestamp(),
            });
            toast({ title: t('peoples_addSuccess') });
        }
        setIsCreatingEvent(false);
        setEditingEvent(null);
    };

    const handleDeleteEvent = (eventId: string) => {
        if (!activeOrgId) return;
        deleteDocumentNonBlocking(doc(firestore, 'organizations', activeOrgId, 'events', eventId));
        toast({ title: t('peoples_deleteSuccess'), variant: "destructive" });
    };

    const openEditEvent = (event: OrgEvent) => {
        setEditingEvent(event);
        setEventFormData(event);
        setIsCreatingEvent(true);
    };

    const handleCreateOrUpdateGroup = async () => {
        if (!activeOrgId || !groupFormData.name.trim()) return;
        const leader = members?.find(m => m.id === groupFormData.leaderId);
        const groupData = {
            name: groupFormData.name,
            description: groupFormData.description,
            leaderId: groupFormData.leaderId,
            leaderName: leader?.displayName || '',
            updatedAt: serverTimestamp(),
        };

        if (editingGroup) {
            updateDocumentNonBlocking(doc(firestore, 'organizations', activeOrgId, 'smallGroups', editingGroup.id), groupData);
            toast({ title: t('peoples_updateSuccess') });
        } else {
            await addDocumentNonBlocking(collection(firestore, 'organizations', activeOrgId, 'smallGroups'), {
                ...groupData,
                memberIds: [],
                createdAt: serverTimestamp(),
            });
            toast({ title: t('peoples_addSuccess') });
        }
        setIsCreatingGroup(false);
        setEditingGroup(null);
        setGroupFormData({ name: '', description: '', leaderId: '' });
    };

    const handleDeleteGroup = (groupId: string) => {
        if (!activeOrgId) return;
        deleteDocumentNonBlocking(doc(firestore, 'organizations', activeOrgId, 'smallGroups', groupId));
        toast({ title: t('peoples_deleteSuccess'), variant: "destructive" });
    };

    const openEditGroup = (group: SmallGroup) => {
        setEditingGroup(group);
        setGroupFormData({ name: group.name, description: group.description || '', leaderId: group.leaderId || '' });
        setIsCreatingGroup(true);
    };

    const handleTogglePrayerVisibility = (prayer: PrayerPost) => {
        const nextVisibility = prayer.visibility === 'private' ? 'public' : 'private';
        updateDocumentNonBlocking(doc(firestore, 'prayerPosts', prayer.id), {
            visibility: nextVisibility,
            updatedAt: serverTimestamp()
        });
        toast({ title: t('peoples_updateSuccess') });
    };

    const formatTimeLabel = (timeStr: string) => {
        const amLabel = t('time_am') || '오전';
        const pmLabel = t('time_pm') || '오후';
        return timeStr.replace('오전', amLabel).replace('오후', pmLabel);
    };

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
            const day = recentJournalsForWave.find(j => j.id === dateStr);
            if (day?.completed && day?.diaryCompleted) count++;
        }
        return count / 7;
    }, [recentJournalsForWave]);

    const handleSignOut = async () => { if (auth) { await signOut(auth); router.push('/'); } };

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

    return (
        <div className="h-full flex flex-col bg-muted/10 overflow-hidden font-sans">
            <header className="relative w-full bg-[#2e2848] backdrop-blur-sm py-2 px-10 shadow-sm flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 overflow-hidden shrink-0 z-50 min-w-[360px]">
                <SpiritualWave activityLevel={waveActivityLevel} className="opacity-40 z-0" />
                <div className="relative z-10 flex flex-col border-r border-slate-600 pr-4 shrink-0">
                    <h1 className="text-xl font-black tracking-tighter flex items-center font-sans">
                        <span className="text-primary">Word</span> <span className="mx-1 text-white">N</span> <span className="text-accent">Walks</span>
                    </h1>
                    <p className="text-[10px] font-light text-slate-300 -mt-1 tracking-tight">Walk with the Word.</p>
                </div>

                <nav className="relative z-10 flex-1 flex flex-wrap justify-center items-center gap-x-2 gap-y-1 py-1 max-h-[140px] lg:max-h-none overflow-hidden">
                    <div className="flex items-center gap-1 shrink-0">
                        <Link href="/journal" className={cn(buttonVariants({ variant: 'ghost' }), pathname === '/journal' ? "text-white bg-white/10" : "text-slate-300 hover:bg-white/10 hover:text-white", "flex flex-col items-center justify-center h-auto p-1.5 gap-0.5 w-16 lg:w-20")}>
                            <Home className="h-6 w-6 lg:h-7 lg:w-7" /><span className="text-[10px] lg:text-xs font-medium">{t('home')}</span>
                        </Link>
                        <Link href="/peoples" className={cn(buttonVariants({ variant: 'ghost' }), pathname === '/peoples' ? "text-white bg-white/10" : "text-slate-300 hover:bg-white/10 hover:text-white", "flex flex-col items-center justify-center h-auto p-1.5 gap-0.5 w-16 lg:w-20")}>
                            <Users className="h-6 w-6 lg:h-7 lg:w-7" /><span className="text-[10px] lg:text-xs font-medium">{t('peoples')}</span>
                        </Link>
                        <Link href="/calendar" className={cn(buttonVariants({ variant: 'ghost' }), pathname === '/calendar' ? "text-white bg-white/10" : "text-slate-300 hover:bg-white/10 hover:text-white", "flex flex-col items-center justify-center h-auto p-1.5 gap-0.5 w-16 lg:w-20")}>
                            <CalendarDays className="h-6 w-6 lg:h-7 lg:w-7" /><span className="text-[10px] lg:text-xs font-medium">{t('schedule')}</span>
                        </Link>
                        <Link href="/stats" className={cn(buttonVariants({ variant: 'ghost' }), pathname === '/stats' ? "text-white bg-white/10" : "text-slate-300 hover:bg-white/10 hover:text-white", "flex flex-col items-center justify-center h-auto p-1.5 gap-0.5 w-16 lg:w-20")}>
                            <FilePenLine className="h-6 w-6 lg:h-7 lg:w-7" /><span className="text-[10px] lg:text-xs font-medium">{t('reports')}</span>
                        </Link>
                        <Link href="/prayer-room" className={cn(buttonVariants({ variant: 'ghost' }), pathname === '/prayer-room' ? "text-white bg-white/10" : "text-slate-300 hover:bg-white/10 hover:text-white", "flex flex-col items-center justify-center h-auto p-1.5 gap-0.5 w-16 lg:w-20")}>
                            <Hand className="h-6 w-6 lg:h-7 lg:w-7" /><span className="text-[10px] lg:text-xs font-medium">{t('prayers')}</span>
                        </Link>
                    </div>
                    
                    <div className="flex items-center gap-1 shrink-0 lg:ml-2">
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
                          <Link href="/org-admin" className={cn(buttonVariants({ variant: 'ghost' }), "text-orange-400 bg-white/10 hover:text-orange-300 flex flex-col items-center justify-center h-auto p-1.5 gap-0.5 w-16 lg:w-20")}>
                            <ShieldCheck className="h-6 w-6 lg:h-7 lg:w-7" /><span className="text-[10px] lg:text-xs font-medium">{t('groups_adminCenter')}</span>
                          </Link>
                        ) : null}
                    </div>
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

            <main className="flex-1 min-h-0 overflow-y-auto p-8 font-sans">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="h-auto flex flex-col">
                    <TabsList className="grid grid-cols-5 w-full max-w-4xl mb-8 bg-white shadow-sm border p-1 rounded-xl shrink-0">
                        <TabsTrigger value="dashboard" className="rounded-lg font-bold"><LayoutDashboard className="mr-2 h-4 w-4"/>현황판</TabsTrigger>
                        <TabsTrigger value="members" className="rounded-lg font-bold"><Users className="mr-2 h-4 w-4"/>회원 및 소그룹</TabsTrigger>
                        <TabsTrigger value="content" className="rounded-lg font-bold"><Wand2 className="mr-2 h-4 w-4"/>공지 및 본문</TabsTrigger>
                        <TabsTrigger value="schedule" className="rounded-lg font-bold"><CalendarDays className="mr-2 h-4 w-4"/>행사 및 일정</TabsTrigger>
                        <TabsTrigger value="prayers" className="rounded-lg font-bold"><Hand className="mr-2 h-4 w-4"/>기도제목 관리</TabsTrigger>
                    </TabsList>

                    <div className="max-w-6xl mx-auto pb-20 w-full h-auto">
                        <TabsContent value="dashboard" className="mt-0 space-y-8 h-auto">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-auto">
                                <Card className="h-auto border-none shadow-sm"><CardHeader><CardTitle className="text-sm text-muted-foreground uppercase">전체 회원 수</CardTitle></CardHeader><CardContent><p className="text-4xl font-black text-primary">{members?.length || 0}</p></CardContent></Card>
                                <Card className="h-auto border-none shadow-sm"><CardHeader><CardTitle className="text-sm text-muted-foreground uppercase">오늘의 본문</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{dailyContent?.passage || '-'}</p></CardContent></Card>
                                <Card className="h-auto border-none shadow-sm"><CardHeader><CardTitle className="text-sm text-muted-foreground uppercase">소그룹 수</CardTitle></CardHeader><CardContent><p className="text-4xl font-black text-emerald-600">{smallGroups?.length || 0}</p></CardContent></Card>
                            </div>
                            
                            <Card className="border-primary/20 bg-primary/5 h-auto">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 font-black text-xl"><Target className="text-primary h-5 w-5"/> 공동체 철학 및 비전</CardTitle>
                                    <CardDescription>공동체의 핵심 가치와 방향성을 설정합니다.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6 h-auto">
                                    <div className="space-y-2 h-auto">
                                        <label className="text-sm font-bold text-primary">공동체 설립 목적</label>
                                        <Textarea 
                                            value={editingOrg.philosophy || ''} 
                                            onChange={e => setEditingOrg(p => ({...p, philosophy: e.target.value}))} 
                                            placeholder="공동체가 세워진 목적을 기록하세요..."
                                            className="bg-white h-auto min-h-[100px] resize-none overflow-hidden leading-relaxed text-base border-primary/20 shadow-sm" 
                                        />
                                    </div>
                                    <div className="space-y-2 h-auto">
                                        <label className="text-sm font-bold text-primary">비전 및 핵심 가치</label>
                                        <Textarea 
                                            value={editingOrg.vision || ''} 
                                            onChange={e => setEditingOrg(p => ({...p, vision: e.target.value}))} 
                                            placeholder="공동체가 지향하는 비전을 기록하세요..."
                                            className="bg-white h-auto min-h-[100px] resize-none overflow-hidden leading-relaxed text-base border-primary/20 shadow-sm"
                                        />
                                    </div>
                                    <div className="space-y-2 h-auto">
                                        <label className="text-sm font-bold text-primary">금년도 사역 방향</label>
                                        <Textarea 
                                            value={editingOrg.ministryDirection || ''} 
                                            onChange={e => setEditingOrg(p => ({...p, ministryDirection: e.target.value}))} 
                                            placeholder="올해의 구체적인 사역 방향을 기록하세요..."
                                            className="bg-white h-auto min-h-[100px] resize-none overflow-hidden leading-relaxed text-base border-primary/20 shadow-sm"
                                        />
                                    </div>
                                    <Button className="w-full h-auto py-3 font-bold shadow-lg" onClick={handleSaveOrgSettings}><Save className="mr-2 h-4 w-4"/> 설정 저장</Button>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="members" className="mt-0 space-y-8 h-auto">
                            <Card className="h-auto">
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="font-black text-xl">소그룹 관리</CardTitle>
                                        <CardDescription>공동체 내의 소그룹을 생성하고 리더를 지정합니다.</CardDescription>
                                    </div>
                                    <Button onClick={() => { setEditingGroup(null); setGroupFormData({ name: '', description: '', leaderId: '' }); setIsCreatingGroup(true); }}>
                                        <Plus className="mr-2 h-4 w-4" /> 소그룹 추가
                                    </Button>
                                </CardHeader>
                                <CardContent className="h-auto">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-auto">
                                        {smallGroups?.map(group => (
                                            <Card key={group.id} className="border-l-4 border-emerald-500 h-auto hover:shadow-md transition-shadow">
                                                <CardHeader className="pb-2">
                                                    <div className="flex justify-between items-start">
                                                        <CardTitle className="text-lg font-bold">{group.name}</CardTitle>
                                                        <div className="flex gap-1">
                                                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditGroup(group)}><Edit className="h-4 w-4"/></Button>
                                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDeleteGroup(group.id)}><Trash2 className="h-4 w-4"/></Button>
                                                        </div>
                                                    </div>
                                                    <CardDescription className="line-clamp-1">{group.description || '설명 없음'}</CardDescription>
                                                </CardHeader>
                                                <CardContent className="h-auto">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100">리더</Badge>
                                                        <span className="text-sm font-semibold">{group.leaderName || '미지정'}</span>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="h-auto">
                                <CardHeader><CardTitle className="font-black text-xl">전체 회원 목록 ({members?.length || 0})</CardTitle></CardHeader>
                                <CardContent className="h-auto">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead className="font-bold text-slate-900">회원</TableHead>
                                                <TableHead className="font-bold text-slate-900">이메일</TableHead>
                                                <TableHead className="text-right font-bold text-slate-900">권한</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {members?.map(m => {
                                                const membership = m.memberships?.find(ms => ms.organizationId === activeOrgId);
                                                return (
                                                    <TableRow key={m.id}>
                                                        <TableCell className="flex items-center gap-3">
                                                            <Avatar className="h-8 w-8">
                                                                <AvatarImage src={m.profilePictureUrl}/>
                                                                <AvatarFallback>{m.displayName?.charAt(0)}</AvatarFallback>
                                                            </Avatar>
                                                            <span className="font-semibold">{m.displayName}</span>
                                                        </TableCell>
                                                        <TableCell className="text-sm text-muted-foreground">{m.email}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Badge variant={membership?.role === 'admin' ? "default" : "secondary"} className={cn(membership?.role === 'admin' && "bg-primary")}>
                                                                {membership?.role === 'admin' ? '관리자' : '일반'}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="content" className="mt-0 space-y-8 h-auto">
                            <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border sticky top-0 z-10">
                                <DateNavigator date={selectedDate} onChange={setSelectedDate} />
                                <div className="flex gap-2">
                                    <Button onClick={handleSaveDailyContent} className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 px-8 h-11 rounded-full font-black">
                                        <Save className="mr-2 h-5 w-5"/> 콘텐츠 저장
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-auto">
                                <Card className="shadow-md h-auto">
                                    <CardHeader className="bg-slate-50 border-b">
                                        <CardTitle className="text-lg font-bold">말씀 묵상 설정</CardTitle>
                                        <CardDescription>오늘 성도들이 함께 나눌 성경 본문과 해설을 입력하세요.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6 pt-6 h-auto">
                                        <div className="space-y-2 h-auto">
                                            <label className="text-sm font-bold text-slate-700">성경 본문 (장절)</label>
                                            <div className="flex gap-2">
                                                <Input 
                                                    value={editingDailyContent.passage || ''} 
                                                    onChange={e => setEditingDailyContent(p => ({...p, passage: e.target.value}))} 
                                                    placeholder="예: 시편 23:1-6" 
                                                    className="flex-1 text-base border-primary/30 h-11 shadow-sm" 
                                                />
                                                <Button variant="default" className="bg-primary hover:bg-primary/90 h-11 px-6 font-bold" onClick={handleGenerateAiContent} disabled={isGeneratingAi}>
                                                    {isGeneratingAi ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4"/>} 묵상 자료 생성
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="space-y-2 h-auto">
                                            <label className="text-sm font-bold text-slate-700">묵상 제목</label>
                                            <Input value={editingDailyContent.title || ''} onChange={e => setEditingDailyContent(p => ({...p, title: e.target.value}))} placeholder="오늘의 묵상 제목을 입력하세요..." className="text-base h-11 shadow-sm" />
                                        </div>
                                        <div className="space-y-2 h-auto">
                                            <div className="p-4 bg-muted/10 border border-dashed rounded-xl h-auto">
                                                <p className="text-[10px] font-bold text-muted-foreground mb-4 uppercase tracking-tighter">강조 표시된 성경 본문</p>
                                                <VersesWithHighlighting verses={editingDailyContent.verses} keyVerses={editingDailyContent.keyVerses} />
                                            </div>
                                        </div>
                                        <div className="space-y-2 h-auto">
                                            <label className="text-sm font-bold text-slate-700">성경 해설</label>
                                            <Textarea 
                                                value={editingDailyContent.analysis || ''} 
                                                onChange={e => setEditingDailyContent(p => ({...p, analysis: e.target.value}))} 
                                                placeholder="본문에 대한 신학적 해설과 묵상 포인트를 입력하세요..."
                                                className="text-lg h-auto min-h-[300px] resize-none border-primary/20 leading-relaxed shadow-sm" 
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                                
                                <Card className="shadow-md h-auto">
                                    <CardHeader className="bg-slate-50 border-b">
                                        <CardTitle className="text-lg font-bold">묵상 가이드 및 성찰 질문</CardTitle>
                                        <CardDescription>성도들의 깊은 묵상을 돕는 가이드와 질문을 설정합니다.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6 pt-6 h-auto">
                                        <div className="space-y-2 h-auto">
                                            <label className="text-sm font-bold text-slate-700">오늘의 묵상 가이드</label>
                                            <Textarea 
                                                value={editingDailyContent.meditationGuide || ''} 
                                                onChange={e => setEditingDailyContent(p => ({...p, meditationGuide: e.target.value}))} 
                                                placeholder="무엇에 집중하여 묵상할지 안내를 적어주세요..."
                                                className="text-lg h-auto min-h-[200px] resize-none border-primary/20 leading-relaxed shadow-sm" 
                                            />
                                        </div>
                                        <div className="space-y-4 h-auto">
                                            <label className="text-sm font-bold text-slate-700">성찰 질문 (3가지)</label>
                                            {[0, 1, 2].map(i => (
                                                <Textarea 
                                                    key={`question-${i}`} 
                                                    placeholder={`질문 ${i + 1}을 입력하세요`} 
                                                    value={editingDailyContent.questions?.[i] || ''} 
                                                    onChange={e => {
                                                        const nq = [...(editingDailyContent.questions || ['', '', ''])];
                                                        nq[i] = e.target.value;
                                                        setEditingDailyContent(p => ({...p, questions: nq}));
                                                    }}
                                                    className="text-lg border-emerald-100 focus:border-emerald-500 whitespace-pre-wrap h-auto min-h-[80px] resize-none leading-relaxed shadow-sm"
                                                />
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card className="shadow-lg border-orange-200 h-auto">
                                <CardHeader className="bg-orange-50 border-b flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-xl text-orange-900 flex items-center gap-2 font-black"><Megaphone className="h-6 w-6"/> 공동체 소식 및 안내</CardTitle>
                                        <CardDescription>성도들에게 전달할 오늘의 공지사항을 작성하세요.</CardDescription>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" onClick={() => addBlock('text')} className="bg-white font-bold"><Type className="mr-2 h-4 w-4"/>텍스트</Button>
                                        <Button size="sm" variant="outline" onClick={() => addBlock('image')} className="bg-white font-bold"><ImageIcon className="mr-2 h-4 w-4"/>이미지</Button>
                                        <Button size="sm" variant="outline" onClick={() => addBlock('video')} className="bg-white font-bold"><Video className="mr-2 h-4 w-4"/>비디오</Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-8 space-y-8 h-auto">
                                    {(editingDailyContent.materialBlocks || []).map((block, idx) => (
                                        <div key={block.id} className="relative group p-6 border-2 border-dashed rounded-2xl bg-white h-auto transition-all hover:border-orange-200">
                                            <div className="absolute -top-3 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                <Button variant="outline" size="icon" className="h-8 w-8 bg-white" onClick={() => moveBlock(idx, 'up')} disabled={idx === 0}><ArrowUp className="h-4 w-4"/></Button>
                                                <Button variant="outline" size="icon" className="h-8 w-8 bg-white" onClick={() => moveBlock(idx, 'down')} disabled={idx === (editingDailyContent.materialBlocks?.length || 0) - 1}><ArrowDown className="h-4 w-4"/></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-red-100 text-red-600 border border-red-200" onClick={() => removeBlock(block.id)}><X className="h-4 w-4"/></Button>
                                            </div>
                                            {block.type === 'text' && (
                                                <div className="space-y-4 h-auto">
                                                    <div className="flex items-center gap-4 flex-wrap border-b pb-4 mb-4">
                                                        <Select value={block.config?.fontFamily || 'sans-serif'} onValueChange={v => updateBlock(block.id, { config: { ...block.config, fontFamily: v } })}>
                                                            <SelectTrigger className="w-32 h-8 text-xs font-bold"><SelectValue placeholder="글꼴"/></SelectTrigger>
                                                            <SelectContent><SelectItem value="sans-serif">고딕체</SelectItem><SelectItem value="serif">명조체</SelectItem><SelectItem value="cursive">손글씨체</SelectItem></SelectContent>
                                                        </Select>
                                                        <Select value={block.config?.fontSize || '16px'} onValueChange={v => updateBlock(block.id, { config: { ...block.config, fontSize: v } })}>
                                                            <SelectTrigger className="w-24 h-8 text-xs font-bold"><SelectValue placeholder="크기"/></SelectTrigger>
                                                            <SelectContent><SelectItem value="14px">작게</SelectItem><SelectItem value="16px">보통</SelectItem><SelectItem value="20px">크게</SelectItem><SelectItem value="28px">매우 크게</SelectItem></SelectContent>
                                                        </Select>
                                                        <Input type="color" value={block.config?.color || '#000000'} onChange={e => updateBlock(block.id, { config: { ...block.config, color: e.target.value } })} className="w-10 h-8 p-0 border-none cursor-pointer" />
                                                        <div className="flex bg-muted rounded-md p-0.5">
                                                            <Button variant={block.config?.textAlign === 'left' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => updateBlock(block.id, { config: { ...block.config, textAlign: 'left' } })}><AlignLeft className="h-3.5 w-3.5"/></Button>
                                                            <Button variant={block.config?.textAlign === 'center' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => updateBlock(block.config?.textAlign === 'center' ? 'secondary' : 'ghost', { config: { ...block.config, textAlign: 'center' } })}><AlignCenter className="h-3.5 w-3.5"/></Button>
                                                            <Button variant={block.config?.textAlign === 'right' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => updateBlock(block.id, { config: { ...block.config, textAlign: 'right' } })}><AlignRight className="h-3.5 w-3.5"/></Button>
                                                        </div>
                                                        <Button variant={block.config?.fontWeight === 'bold' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => updateBlock(block.id, { config: { ...block.config, fontWeight: block.config?.fontWeight === 'bold' ? 'normal' : 'bold' } })}><Bold className="h-3.5 w-3.5"/></Button>
                                                    </div>
                                                    <Textarea 
                                                        value={block.content} 
                                                        onChange={e => updateBlock(block.id, { content: e.target.value })} 
                                                        placeholder="내용을 입력하세요..." 
                                                        style={{ fontSize: block.config?.fontSize, color: block.config?.color, fontFamily: block.config?.fontFamily, textAlign: block.config?.textAlign as any, fontWeight: block.config?.fontWeight as any }} 
                                                        className="border-none shadow-none focus-visible:ring-0 h-auto min-h-[100px] resize-none overflow-hidden leading-relaxed" 
                                                    />
                                                </div>
                                            )}
                                            {block.type === 'image' && (
                                                <div className="space-y-4 h-auto">
                                                    <Label className="text-xs font-bold text-primary uppercase tracking-widest">이미지 업로드</Label>
                                                    <Input 
                                                        type="file" 
                                                        accept="image/*" 
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) {
                                                                const reader = new FileReader();
                                                                reader.onloadend = () => {
                                                                    updateBlock(block.id, { content: reader.result as string }, false);
                                                                };
                                                                reader.readAsDataURL(file);
                                                            }
                                                        }}
                                                        className="h-11 shadow-sm"
                                                    />
                                                    {block.content && (
                                                        <div className="mt-4 flex justify-center h-auto">
                                                            <div className="relative w-[80%] h-auto">
                                                                <img src={block.content} alt="Preview" className="w-full h-auto rounded-xl shadow-lg bg-muted border" />
                                                                <Button variant="destructive" size="icon" className="absolute -top-3 -right-3 h-8 w-8 rounded-full shadow-lg" onClick={() => updateBlock(block.id, { content: '' }, false)}><Trash2 className="h-4 4"/></Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {block.type === 'video' && (
                                                <div className="space-y-4 h-auto">
                                                    <Label className="text-xs font-bold text-primary uppercase tracking-widest">유튜브 링크</Label>
                                                    <Input value={block.content} onChange={e => updateBlock(block.id, { content: e.target.value })} placeholder="유튜브 주소를 입력하세요 (https://...)" className="h-11 shadow-sm" />
                                                    {block.content && getYouTubeId(block.content) && (
                                                        <div className="mt-4 aspect-video rounded-xl overflow-hidden shadow-lg border h-auto bg-black">
                                                            <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${getYouTubeId(block.content)}`} frameBorder="0" allowFullScreen />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {(!editingDailyContent.materialBlocks?.length) && <p className="text-center py-12 text-sm text-muted-foreground border-2 border-dotted rounded-2xl italic">공지사항 영역이 비어있습니다. 상단의 버튼을 눌러 블록을 추가하세요.</p>}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="schedule" className="mt-0 space-y-8 h-auto">
                            <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border sticky top-0 z-10">
                                <DateNavigator date={selectedDate} onChange={setSelectedDate} />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-auto">
                                <Card className="lg:col-span-1 shadow-md h-auto">
                                    <CardHeader className="bg-slate-50 border-b">
                                        <CardTitle className="text-lg font-black flex items-center gap-2">
                                            <CalendarDays className="h-5 w-5 text-primary"/>
                                            공동체 공식 일정
                                        </CardTitle>
                                        <CardDescription className="font-bold text-primary/80">{format(selectedDate, 'yyyy년 MM월 dd일', { locale: koLocale })}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="pt-6 space-y-6 h-auto">
                                        <div className="space-y-4 p-5 bg-muted/20 rounded-2xl border-2 border-dashed h-auto">
                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold text-slate-600">행사 시간</Label>
                                                <TimePicker value={newSchedule.time} onChange={t => setNewSchedule(p => ({...p, time: t}))}/>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold text-slate-600">행사명</Label>
                                                <Input value={newSchedule.content} onChange={e => setNewSchedule(p => ({...p, content: e.target.value}))} placeholder="예: 주일 예배, 금요 기도회" className="h-11 shadow-sm" />
                                            </div>
                                            <Button className="w-full h-11 font-bold shadow-md" onClick={handleAddSchedule} disabled={!newSchedule.content.trim()}><Plus className="h-4 w-4 mr-2"/> 일정 추가</Button>
                                        </div>

                                        <div className="space-y-3 h-auto">
                                            {(editingDailyContent.schedules || []).length > 0 ? (
                                                editingDailyContent.schedules?.map(item => (
                                                    <div key={item.id} className="flex items-center justify-between p-4 bg-white border rounded-2xl group h-auto shadow-sm hover:border-primary/30 transition-all">
                                                        <div className="flex items-center gap-4">
                                                            <Badge className="bg-primary/10 text-primary text-[11px] font-mono h-7 px-3">{formatTimeLabel(item.time)}</Badge>
                                                            <span className="font-bold text-sm text-slate-800">{item.content}</span>
                                                        </div>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 rounded-full hover:bg-red-50" onClick={() => removeSchedule(item.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))
                                            ) : <p className="text-xs text-muted-foreground text-center py-12 border-2 border-dotted rounded-2xl italic">오늘 등록된 공식 일정이 없습니다.</p>}
                                        </div>
                                        {((editingDailyContent.schedules?.length || 0) > 0 || (dailyContent?.schedules?.length || 0) > 0) && (
                                            <Button onClick={handleSaveDailyContent} className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 rounded-full font-black shadow-lg shadow-emerald-600/20">일정 전체 저장</Button>
                                        )}
                                    </CardContent>
                                </Card>

                                <div className="lg:col-span-2 space-y-6 h-auto">
                                    <Card className="shadow-md h-auto">
                                        <CardHeader className="bg-indigo-50 border-b flex flex-row items-center justify-between">
                                            <div>
                                                <CardTitle className="text-xl text-indigo-900 flex items-center gap-2 font-black"><Sparkles className="h-6 w-6"/> 특별 행사 및 홍보 관리</CardTitle>
                                                <CardDescription>특별한 행사 정보를 등록하고 전용 페이지로 홍보하세요.</CardDescription>
                                            </div>
                                            <Button onClick={() => { setEditingEvent(null); setEventFormData({ title: '', date: format(selectedDate, 'yyyy-MM-dd'), time: '오전 11:00', promotionStartType: '1week', materialBlocks: [] }); setIsCreatingEvent(true); }} className="font-bold shadow-md">
                                                <Plus className="mr-2 h-4 w-4"/> 행사 등록
                                            </Button>
                                        </CardHeader>
                                        <CardContent className="pt-6 h-auto">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-auto">
                                                {events?.map(event => {
                                                    const isPromoting = event.promotionStartType !== 'none';
                                                    return (
                                                        <Card key={event.id} className="border-l-4 border-indigo-500 hover:shadow-xl transition-all h-auto rounded-xl">
                                                            <CardHeader className="pb-2">
                                                                  <div className="flex justify-between items-start">
                                                                    <div className="space-y-1">
                                                                        <CardTitle className="text-lg font-black">{event.title}</CardTitle>
                                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold">
                                                                            <CalendarIcon className="h-3 w-3"/> {event.date}
                                                                            <Clock className="h-3 w-3 ml-1"/> {formatTimeLabel(event.time)}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex gap-1">
                                                                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => openEditEvent(event)}><Edit className="h-4 w-4"/></Button>
                                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive rounded-full" onClick={() => handleDeleteEvent(event.id)}><Trash2 className="h-4 w-4"/></Button>
                                                                    </div>
                                                                </div>
                                                            </CardHeader>
                                                            <CardContent className="pb-4 h-auto">
                                                                <div className="flex items-center gap-2">
                                                                    {isPromoting ? (
                                                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 font-bold px-3">
                                                                            <Megaphone className="h-3 w-3"/> 홍보 중 ({event.promotionStartType === '1week' ? '1주 전' : event.promotionStartType === '2weeks' ? '2주 전' : '커스텀'})
                                                                        </Badge>
                                                                    ) : (
                                                                        <Badge variant="secondary" className="gap-1 font-bold px-3"><MegaphoneOff className="h-3 w-3"/> 홍보 안함</Badge>
                                                                    )}
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    )
                                                })}
                                                {(!events?.length) && (
                                                    <div className="col-span-full py-20 text-center text-muted-foreground bg-muted/5 border-2 border-dashed rounded-2xl italic">
                                                        <Sparkles className="h-10 w-10 mx-auto mb-2 opacity-20"/>
                                                        <p>등록된 특별 행사가 없습니다.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="prayers" className="mt-0 space-y-8 h-auto">
                            <Card className="h-auto shadow-sm">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 font-black text-xl"><Hand className="text-primary h-6 w-6"/> 공유 기도제목 관리</CardTitle>
                                    <CardDescription>공동체에 공유된 기도제목의 공개 여부를 관리합니다. 민감한 내용은 비공개로 전환할 수 있습니다.</CardDescription>
                                </CardHeader>
                                <CardContent className="h-auto">
                                    <div className="space-y-4 h-auto">
                                        {sharedPrayers && sharedPrayers.length > 0 ? (
                                            <div className="border rounded-2xl overflow-hidden h-auto shadow-sm">
                                                <Table>
                                                    <TableHeader className="bg-muted/50">
                                                        <TableRow>
                                                            <TableHead className="font-bold text-slate-900">작성자</TableHead>
                                                            <TableHead className="font-bold text-slate-900">기도제목</TableHead>
                                                            <TableHead className="font-bold text-slate-900">공유일시</TableHead>
                                                            <TableHead className="text-right font-bold text-slate-900">상태</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {sharedPrayers.map(p => (
                                                            <TableRow key={p.id} className={cn(p.visibility === 'private' && "bg-red-50/30")}>
                                                                <TableCell className="flex items-center gap-3">
                                                                    <Avatar className="h-8 w-8 border">
                                                                        <AvatarImage src={p.userProfilePictureUrl}/>
                                                                        <AvatarFallback>{p.userDisplayName.charAt(0)}</AvatarFallback>
                                                                    </Avatar>
                                                                    <span className="font-bold">{p.userDisplayName}</span>
                                                                </TableCell>
                                                                <TableCell className="max-w-md h-auto">
                                                                    <p className="line-clamp-1 font-medium">{p.title}</p>
                                                                </TableCell>
                                                                <TableCell className="text-xs text-muted-foreground font-medium">
                                                                    {p.createdAt?.toDate ? format(p.createdAt.toDate(), 'yyyy-MM-dd HH:mm') : '...'}
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <Button 
                                                                        variant={p.visibility === 'private' ? "destructive" : "outline"} 
                                                                        size="sm" 
                                                                        onClick={() => handleTogglePrayerVisibility(p)}
                                                                        className="gap-2 font-bold h-8 rounded-full"
                                                                    >
                                                                        {p.visibility === 'private' ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                                                                        {p.visibility === 'private' ? '비공개 중' : '공개 중'}
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        ) : (
                                            <div className="py-24 text-center text-muted-foreground bg-muted/5 border-2 border-dashed rounded-3xl italic">
                                                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20"/>
                                                <p>공동체에 공유된 기도제목이 없습니다.</p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </div>
                </Tabs>
            </main>

            <Dialog open={isCreatingEvent} onOpenChange={setIsCreatingEvent}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col font-sans">
                    <DialogHeader className="shrink-0">
                        <DialogTitle className="font-black text-2xl">{editingEvent ? '행사 정보 수정' : '신규 행사 등록'}</DialogTitle>
                        <DialogDescription>행사 일정과 홍보 자료를 입력하여 성도들에게 알리세요.</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 min-h-0 overflow-hidden mt-4">
                        <ScrollArea className="h-full pr-4">
                            <div className="space-y-8 pb-10 h-auto px-1">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-auto">
                                    <div className="space-y-5 h-auto">
                                        <div className="space-y-2 h-auto">
                                            <Label className="font-bold text-slate-900">행사 제목</Label>
                                            <Input value={eventFormData.title} onChange={e => setEventFormData(p => ({...p, title: e.target.value}))} placeholder="예: 전교인 수련회" className="h-11 shadow-sm" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 h-auto">
                                            <div className="space-y-2 h-auto">
                                                <Label className="font-bold text-slate-900">날짜</Label>
                                                <Input type="date" value={eventFormData.date} onChange={e => setEventFormData(p => ({...p, date: e.target.value}))} className="h-11 shadow-sm" />
                                            </div>
                                            <div className="space-y-2 h-auto">
                                                <Label className="font-bold text-slate-900">시간</Label>
                                                <TimePicker value={eventFormData.time || '오전 11:00'} onChange={t => setEventFormData(p => ({...p, time: t}))}/>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-5 h-auto">
                                        <div className="space-y-2 h-auto">
                                            <Label className="font-bold text-slate-900">홍보 시작일</Label>
                                            <Select value={eventFormData.promotionStartType} onValueChange={v => setEventFormData(p => ({...p, promotionStartType: v as any}))}>
                                                <SelectTrigger className="h-11 shadow-sm font-bold"><SelectValue/></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">홍보 안함</SelectItem>
                                                    <SelectItem value="1week">1주 전부터</SelectItem>
                                                    <SelectItem value="2weeks">2주 전부터</SelectItem>
                                                    <SelectItem value="custom">직접 날짜 지정</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {eventFormData.promotionStartType === 'custom' && (
                                            <div className="space-y-2 h-auto animate-in fade-in slide-in-from-top-2">
                                                <Label className="font-bold text-primary">시작 날짜 지정</Label>
                                                <Input type="date" value={eventFormData.customPromotionStartDate} onChange={e => setEventFormData(p => ({...p, customPromotionStartDate: e.target.value}))} className="h-11 border-primary/30 shadow-sm" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <Separator />

                                <div className="space-y-6 h-auto">
                                    <div className="flex items-center justify-between sticky top-0 bg-background z-10 py-3 border-b">
                                        <Label className="text-lg font-black text-indigo-900">홍보 자료 편집</Label>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" onClick={() => addBlock('text', true)} className="font-bold"><Type className="mr-2 h-4 w-4"/>텍스트</Button>
                                            <Button size="sm" variant="outline" onClick={() => addBlock('image', true)} className="font-bold"><ImageIcon className="mr-2 h-4 w-4"/>이미지</Button>
                                            <Button size="sm" variant="outline" onClick={() => addBlock('video', true)} className="font-bold"><Video className="mr-2 h-4 w-4"/>비디오</Button>
                                        </div>
                                    </div>

                                    <div className="space-y-8 h-auto">
                                        {(eventFormData.materialBlocks || []).map((block, idx) => (
                                            <div key={block.id} className="relative group p-6 border-2 border-dashed rounded-2xl bg-muted/5 h-auto transition-colors hover:border-primary/30">
                                                <div className="absolute -top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                    <Button variant="outline" size="icon" className="h-8 w-8 bg-white shadow-sm" onClick={() => moveBlock(idx, 'up', true)} disabled={idx === 0}><ArrowUp className="h-4 w-4"/></Button>
                                                    <Button variant="outline" size="icon" className="h-8 w-8 bg-white shadow-sm" onClick={() => moveBlock(idx, 'down', true)} disabled={idx === (eventFormData.materialBlocks?.length || 0) - 1}><ArrowDown className="h-4 w-4"/></Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-red-100 text-red-600 border border-red-100" onClick={() => removeBlock(block.id, true)}><X className="h-4 w-4"/></Button>
                                                </div>
                                                {block.type === 'text' && (
                                                    <div className="space-y-4 h-auto">
                                                        <div className="flex items-center gap-3 flex-wrap border-b pb-3 mb-3 h-auto">
                                                            <Select value={block.config?.fontSize || '16px'} onValueChange={v => updateBlock(block.id, { config: { ...block.config, fontSize: v } }, true)}>
                                                                <SelectTrigger className="w-28 h-8 text-xs font-bold"><SelectValue placeholder="크기"/></SelectTrigger>
                                                                <SelectContent><SelectItem value="14px">작게</SelectItem><SelectItem value="16px">보통</SelectItem><SelectItem value="20px">크게</SelectItem></SelectContent>
                                                            </Select>
                                                            <div className="flex bg-muted rounded-md p-0.5 h-auto">
                                                                <Button variant={block.config?.textAlign === 'left' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => updateBlock(block.id, { config: { ...block.config, textAlign: 'left' } }, true)}><AlignLeft className="h-3.5 w-3.5"/></Button>
                                                                <Button variant={block.config?.textAlign === 'center' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => updateBlock(block.id, { config: { ...block.config, textAlign: 'center' } }, true)}><AlignCenter className="h-3.5 w-3.5"/></Button>
                                                                <Button variant={block.config?.textAlign === 'right' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => updateBlock(block.id, { config: { ...block.config, textAlign: 'right' } }, true)}><AlignRight className="h-3.5 w-3.5"/></Button>
                                                            </div>
                                                        </div>
                                                        <Textarea 
                                                            value={block.content} 
                                                            onChange={e => updateBlock(block.id, { content: e.target.value }, true)} 
                                                            placeholder="내용을 입력하세요..." 
                                                            style={{ fontSize: block.config?.fontSize, textAlign: block.config?.textAlign as any }} 
                                                            className="border-none shadow-none focus-visible:ring-0 h-auto min-h-[100px] resize-none overflow-hidden leading-relaxed bg-transparent text-lg" 
                                                        />
                                                    </div>
                                                )}
                                                {block.type === 'image' && (
                                                    <div className="space-y-4 h-auto">
                                                        <Label className="text-xs font-black text-primary uppercase tracking-widest">이미지 업로드</Label>
                                                        <Input 
                                                            type="file" 
                                                            accept="image/*" 
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    const reader = new FileReader();
                                                                    reader.onloadend = () => {
                                                                        updateBlock(block.id, { content: reader.result as string }, true);
                                                                    };
                                                                    reader.readAsDataURL(file);
                                                                }
                                                            }}
                                                            className="h-11 shadow-sm bg-white"
                                                        />
                                                        {block.content && (
                                                            <div className="mt-4 flex justify-center h-auto">
                                                                <div className="relative w-[80%] h-auto">
                                                                    <img src={block.content} alt="Preview" className="w-full h-auto rounded-2xl shadow-xl bg-muted border border-slate-200" />
                                                                    <Button variant="destructive" size="icon" className="absolute -top-3 -right-3 h-8 w-8 rounded-full shadow-lg" onClick={() => updateBlock(block.id, { content: '' }, true)}><Trash2 className="h-4 4"/></Button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {block.type === 'video' && (
                                                    <div className="space-y-4 h-auto">
                                                        <Label className="text-xs font-black text-primary uppercase tracking-widest">유튜브 비디오 링크</Label>
                                                        <Input value={block.content} onChange={e => updateBlock(block.id, { content: e.target.value })} placeholder="유튜브 주소를 입력하세요 (https://...)" className="h-11 shadow-sm bg-white" />
                                                        {block.content && getYouTubeId(block.content) && (
                                                            <div className="mt-4 aspect-video rounded-2xl overflow-hidden shadow-xl border border-slate-200 h-auto bg-black">
                                                                <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${getYouTubeId(block.content)}`} frameBorder="0" allowFullScreen />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {(!eventFormData.materialBlocks?.length) && <p className="text-center py-16 text-sm text-muted-foreground border-2 border-dotted rounded-3xl italic bg-muted/5">등록된 홍보 자료가 없습니다. 상단 버튼으로 텍스트나 이미지를 추가하세요.</p>}
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                    </div>
                    <DialogFooter className="shrink-0 pt-4 border-t gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => { setIsCreatingEvent(false); setEditingEvent(null); }} className="rounded-full px-6 font-bold">취소</Button>
                        <Button onClick={handleSaveEvent} className="bg-indigo-600 hover:bg-indigo-700 h-auto py-2 px-8 rounded-full font-black shadow-lg shadow-indigo-600/20" disabled={!eventFormData.title?.trim()}>
                            {editingEvent ? '정보 수정' : '행사 등록 완료'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isCreatingGroup} onOpenChange={setIsCreatingGroup}>
                <DialogContent className="h-auto font-sans">
                    <DialogHeader className="h-auto">
                        <DialogTitle className="font-black text-2xl">{editingGroup ? '소그룹 수정' : '신규 소그룹 생성'}</DialogTitle>
                        <DialogDescription>소그룹의 이름과 리더를 지정합니다.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-5 py-6 h-auto">
                        <div className="space-y-2 h-auto">
                            <Label className="font-bold text-slate-900">소그룹 이름</Label>
                            <Input value={groupFormData.name} onChange={e => setGroupFormData(p => ({...p, name: e.target.value}))} placeholder="예: 여호수아 1팀" className="h-11 shadow-sm" />
                        </div>
                        <div className="space-y-2 h-auto">
                            <Label className="font-bold text-slate-900">설명</Label>
                            <Textarea 
                                value={groupFormData.description} 
                                onChange={e => setGroupFormData(p => ({...p, description: e.target.value}))} 
                                placeholder="소그룹에 대한 간단한 설명을 입력하세요..."
                                className="h-auto min-h-[100px] resize-none overflow-hidden leading-relaxed shadow-sm border-slate-200" 
                                rows={1} 
                            />
                        </div>
                        <div className="space-y-2 h-auto">
                            <Label className="font-bold text-slate-900">리더 선택</Label>
                            <Select value={groupFormData.leaderId} onValueChange={val => setGroupFormData(p => ({...p, leaderId: val}))}>
                                <SelectTrigger className="h-11 shadow-sm font-bold"><SelectValue placeholder="소그룹 리더를 선택하세요"/></SelectTrigger>
                                <SelectContent className="max-h-60 overflow-y-auto">{members?.map(m => <SelectItem key={m.id} value={m.id}>{m.displayName}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter className="h-auto pt-4 border-t gap-2">
                        <Button variant="outline" onClick={() => { setIsCreatingGroup(false); setEditingGroup(null); }}>취소</Button>
                        <Button onClick={handleCreateOrUpdateGroup} className="h-auto py-2.5 px-8 rounded-full font-black shadow-lg" disabled={!groupFormData.name.trim()}>{editingGroup ? '수정 완료' : '소그룹 생성'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
