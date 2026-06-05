
'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useUser, useAuth, useDoc, useMemoFirebase, useFirestore, useCollection } from '@/firebase';
import type { UserProfile, DayData, InvitationCode, Organization, UserMembership, SmallGroup, OrgEvent, PrayerPost, ContentBlock, ForumPost, OrgDailyContent } from '@/lib/types';
import { doc, collection, query, where, documentId, getDocs, getDoc, limit, runTransaction, serverTimestamp, orderBy, arrayUnion } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
  LoaderCircle,
  ArrowLeft,
  ShieldCheck,
  Ticket,
  Plus,
  Sparkles,
  ChevronRight,
  Clock,
  Calendar as CalendarIcon,
  X,
  Heart,
  Building,
  Megaphone,
  MessageCircle,
  CornerDownRight,
  BookOpen,
  ThumbsUp,
  Shapes
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Separator } from '@/components/ui/separator';
import { format, subDays, startOfToday, parseISO, startOfDay, isAfter, isBefore, isSameDay, formatDistanceToNow } from 'date-fns';
import { SpiritualWave } from '@/components/ui/spiritual-wave';
import { useTranslation } from '@/hooks/use-translation';
import LanguageSelect from '@/components/language-select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SmallGroupChat } from './components/ChatRoom';

const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

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

export default function GroupsPage() {
    const { user, profile, isUserLoading } = useUser();
    const auth = useAuth();
    const firestore = useFirestore();
    const router = useRouter();
    const pathname = usePathname();
    const { toast } = useToast();
    const { t } = useTranslation();

    const todayForQuery = startOfToday();
    const sevenDaysAgoStr = format(subDays(todayForQuery, 6), 'yyyy-MM-dd');
    const todayStr = format(todayForQuery, 'yyyy-MM-dd');

    const recentJournalQuery = useMemoFirebase(() =>
        user ? query(
            collection(firestore, 'users', user.uid, 'journal'),
            where(documentId(), '>=', sevenDaysAgoStr),
            where(documentId(), '<=', todayStr)
        ) : null,
        [user, firestore, sevenDaysAgoStr, todayStr]
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

    const memberships = useMemo(() => profile?.memberships || [], [profile]);
    
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

    const [inviteCode, setInviteCode] = useState('');
    const [isJoining, setIsJoining] = useState(false);
    const [activeMenu, setActiveMenu] = useState('my-group');
    
    const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    
    const [selectedMeditation, setSelectedMeditation] = useState<ForumPost | null>(null);
    const [selectedPrayer, setSelectedPrayer] = useState<PrayerPost | null>(null);

    const orgSmallGroupsQuery = useMemoFirebase(() => 
        selectedOrgId ? query(collection(firestore, 'organizations', selectedOrgId, 'smallGroups'), orderBy('name', 'asc')) : null,
        [selectedOrgId, firestore]
    );
    const { data: allOrgGroups } = useCollection<SmallGroup>(orgSmallGroupsQuery);

    const myJoinedGroupsQuery = useMemoFirebase(() => 
        user ? query(collection(firestore, 'organizations', selectedOrgId || 'NONE', 'smallGroups'), where('memberIds', 'array-contains', user.uid)) : null,
        [user, selectedOrgId, firestore]
    );
    const { data: myGroupsInOrg } = useCollection<SmallGroup>(myJoinedGroupsQuery);

    const orgDocRef = useMemoFirebase(() => selectedOrgId ? doc(firestore, 'organizations', selectedOrgId) : null, [selectedOrgId, firestore]);
    const { data: selectedOrg } = useDoc<Organization>(orgDocRef);

    const eventsQuery = useMemoFirebase(() => 
        selectedOrgId ? query(collection(firestore, 'organizations', selectedOrgId, 'events'), orderBy('date', 'asc')) : null,
        [selectedOrgId, firestore]
    );
    const { data: orgEvents } = useCollection<OrgEvent>(eventsQuery);

    const dailyContentRef = useMemoFirebase(() => 
        (selectedOrgId) ? doc(firestore, 'organizations', selectedOrgId, 'dailyContent', todayStr) : null,
        [selectedOrgId, todayStr, firestore]
    );
    const { data: orgDailyContent } = useDoc<OrgDailyContent>(dailyContentRef);

    const groupDocRef = useMemoFirebase(() => (selectedOrgId && selectedGroupId) ? doc(firestore, 'organizations', selectedOrgId, 'smallGroups', selectedGroupId) : null, [selectedOrgId, selectedGroupId, firestore]);
    const { data: selectedGroup } = useDoc<SmallGroup>(groupDocRef);

    const prayersQuery = useMemoFirebase(() => {
        if (!selectedOrgId) return null;
        if (selectedGroupId) {
            return query(collection(firestore, 'prayerPosts'), where('groupId', '==', selectedGroupId), orderBy('createdAt', 'desc'), limit(30));
        }
        return query(collection(firestore, 'prayerPosts'), where('organizationId', '==', selectedOrgId), where('category', '==', 'church'), orderBy('createdAt', 'desc'), limit(30));
    }, [selectedOrgId, selectedGroupId, firestore]);
    const { data: sharedPrayers } = useCollection<PrayerPost>(prayersQuery);

    const meditationsQuery = useMemoFirebase(() => {
        if (!selectedOrgId) return null;
        return query(collection(firestore, 'forumPosts'), orderBy('createdAt', 'desc'), limit(100));
    }, [selectedOrgId, firestore]);
    const { data: allMeditations } = useCollection<ForumPost>(meditationsQuery);

    const filteredMeditations = useMemo(() => {
        if (!allMeditations || !selectedOrgId) return [];
        if (selectedGroupId && selectedGroup) {
            return allMeditations.filter(m => selectedGroup.memberIds.includes(m.userId));
        }
        return allMeditations;
    }, [allMeditations, selectedGroupId, selectedGroup, selectedOrgId]);

    const activePromotedEvents = useMemo(() => {
        if (!orgEvents) return [];
        const today = startOfDay(new Date());
        return orgEvents.filter(event => {
            if (event.promotionStartType === 'none') return false;
            let promoStartDate: Date;
            const eventDate = parseISO(event.date);
            if (event.promotionStartType === '1week') promoStartDate = subDays(eventDate, 7);
            else if (event.promotionStartType === '2weeks') promoStartDate = subDays(eventDate, 14);
            else if (event.promotionStartType === 'custom' && event.customPromotionStartDate) promoStartDate = parseISO(event.customPromotionStartDate);
            else return false;
            return (isAfter(today, promoStartDate) || isSameDay(today, promoStartDate)) && (isBefore(today, eventDate) || isSameDay(today, eventDate));
        });
    }, [orgEvents]);

    const formatTimeLabel = (timeStr: string) => {
        const amLabel = t('time_am') || '오전';
        const pmLabel = t('time_pm') || '오후';
        return timeStr.replace('오전', amLabel).replace('오후', pmLabel);
    };

    const handleJoinSmallGroup = async (sgId: string) => {
        if (!user || !selectedOrgId) return;
        const sgRef = doc(firestore, 'organizations', selectedOrgId, 'smallGroups', sgId);
        try {
            await runTransaction(firestore, async (transaction) => {
                const snap = await transaction.get(sgRef);
                const currentIds = snap.data()?.memberIds || [];
                if (!currentIds.includes(user.uid)) {
                    transaction.update(sgRef, { memberIds: arrayUnion(user.uid) });
                }
            });
            toast({ title: t('groups_joinSuccess') });
        } catch (error) {
            toast({ title: t('groups_joinFail'), variant: "destructive" });
        }
    };

    const handleAmen = async (e: React.MouseEvent, postId: string) => {
        e.stopPropagation(); 
        if (!firestore || !user) return;
        const postRef = doc(firestore, 'prayerPosts', postId);
        try {
            await runTransaction(firestore, async (transaction) => {
                const postDoc = await transaction.get(postRef);
                if (!postDoc.exists()) return;
                const amens = postDoc.data().amens || [];
                const userIndex = amens.indexOf(user.uid);
                if (userIndex > -1) amens.splice(userIndex, 1);
                else amens.push(user.uid);
                transaction.update(postRef, { amens });
            });
        } catch (e) { toast({ title: "Error", variant: "destructive" }); }
    };

    const handleJoinOrg = async () => {
        if (!user || !firestore || !inviteCode.trim()) return;
        setIsJoining(true);
        const codeToTry = inviteCode.trim().toUpperCase();
        try {
            const codesRef = collection(firestore, 'invitationCodes');
            const q = query(codesRef, where('code', '==', codeToTry), limit(1));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) throw new Error("Invalid Code");
            const codeDoc = querySnapshot.docs[0];
            const codeData = codeDoc.data() as InvitationCode;
            if (codeData.status !== 'active') throw new Error("Disabled Code");
            const orgRef = doc(firestore, 'organizations', codeData.organizationId);
            const orgSnap = await getDoc(orgRef);
            if (!orgSnap.exists()) throw new Error("Org Not Found");
            const orgData = orgSnap.data() as Organization;
            const currentMemberships = profile?.memberships || [];
            await runTransaction(firestore, async (transaction) => {
                const freshCodeSnap = await transaction.get(codeDoc.ref);
                const freshCodeData = freshCodeSnap.data() as InvitationCode;
                const newMembership: UserMembership = { organizationId: orgSnap.id, organizationName: orgData.name, role: 'member', joinedAt: new Date() };
                const updatedMemberships = [...currentMemberships, newMembership];
                const updatedIds = Array.from(new Set([...(profile?.membershipIds || []), orgSnap.id]));
                const hasAdminRole = updatedMemberships.some(m => m.role === 'admin');
                transaction.update(doc(firestore, 'users', user.uid), { memberships: updatedMemberships, membershipIds: updatedIds, isGroupAdmin: hasAdminRole, updatedAt: serverTimestamp() });
                transaction.update(codeDoc.ref, { timesUsed: freshCodeData.timesUsed + 1, updatedAt: serverTimestamp() });
            });
            toast({ title: t('groups_joinSuccess') });
            setInviteCode('');
            setActiveMenu('my-group');
            setSelectedOrgId(orgSnap.id);
        } catch (error: any) { toast({ title: t('groups_joinFail'), variant: "destructive" }); } finally { setIsJoining(false); }
    };

    const handleSignOut = async () => { if (auth) { await signOut(auth); router.push('/'); } };

    if (isUserLoading || !user) return <LoadingSpinner fullScreen />;

    return (
        <div className="h-screen w-screen bg-[#2e2848] flex flex-col font-sans overflow-hidden">
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
                        <Home className="h-7 w-7" /><span className="text-xs font-medium">{t('home')}</span>
                    </Link>
                    <Link href="/peoples" className={cn(buttonVariants({ variant: 'ghost' }), pathname === '/peoples' ? "text-white bg-white/10" : "text-slate-300 hover:bg-white/10 hover:text-white", "flex flex-col items-center justify-center h-auto p-2 gap-0.5 w-20")}>
                        <Users className="h-7 w-7" /><span className="text-xs font-medium">{t('peoples')}</span>
                    </Link>
                    <Link href="/calendar" className={cn(buttonVariants({ variant: 'ghost' }), pathname === '/calendar' ? "text-white bg-white/10" : "text-slate-300 hover:bg-white/10 hover:text-white", "flex flex-col items-center justify-center h-auto p-2 gap-0.5 w-20")}>
                        <CalendarDays className="h-7 w-7" /><span className="text-xs font-medium">{t('schedule')}</span>
                    </Link>
                    <Link href="/stats" className={cn(buttonVariants({ variant: 'ghost' }), pathname === '/stats' ? "text-white bg-white/10" : "text-slate-300 hover:bg-white/10 hover:text-white", "flex flex-col items-center justify-center h-auto p-2 gap-0.5 w-20")}>
                        <FilePenLine className="h-7 w-7" /><span className="text-xs font-medium">{t('reports')}</span>
                    </Link>
                    <Link href="/prayer-room" className={cn(buttonVariants({ variant: 'ghost' }), pathname === '/prayer-room' ? "text-white bg-white/10" : "text-slate-300 hover:bg-white/10 hover:text-white", "flex flex-col items-center justify-center h-auto p-2 gap-0.5 w-20")}>
                        <Hand className="h-7 w-7" /><span className="text-xs font-medium">{t('prayers')}</span>
                    </Link>
                    <Link href="/forum" className={cn(buttonVariants({ variant: 'ghost' }), pathname === '/forum' ? "text-white bg-white/10" : "text-slate-300 hover:bg-white/10 hover:text-white", "flex flex-col items-center justify-center h-auto p-2 gap-0.5 w-20")}>
                        <MessageSquare className="h-7 w-7" /><span className="text-xs font-medium">{t('forum')}</span>
                    </Link>
                     <Link href="/groups" className={cn(buttonVariants({ variant: 'ghost' }), pathname === '/groups' ? "text-white bg-white/10" : "text-slate-300 hover:bg-white/10 hover:text-white", "flex flex-col items-center justify-center h-auto p-2 gap-0.5 w-20")}>
                        <Shapes className="h-7 w-7" /><span className="text-xs font-medium">{t('groups')}</span>
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
                                <DropdownMenuItem onClick={() => router.push('/profile-setup')}><UserIcon className="mr-2 h-4 w-4" /><span>{t('profileSettings')}</span></DropdownMenuItem>
                                <DropdownMenuItem onClick={handleSignOut}><LogOut className="mr-2 h-4 w-4" /><span>{t('logOut')}</span></DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </header>

            <main className="flex-1 bg-[#fafafa] paper-texture grid grid-cols-1 md:grid-cols-[260px_1fr] min-h-0 border-t border-[#2e2848]">
                <aside className="border-r bg-muted/20 p-4 flex flex-col overflow-y-auto custom-scrollbar">
                    <nav className="flex flex-col gap-1">
                        {isSuperAdmin && (
                            <Button 
                                variant="ghost" 
                                className="justify-start mb-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 font-bold border border-orange-200" 
                                onClick={() => router.push('/admin')}
                            >
                                <ShieldCheck className="mr-2 h-4 w-4" /> 관리자 (시스템)
                            </Button>
                        )}
                        {isOrgAdmin && (
                            <Button 
                                variant="ghost" 
                                className="justify-start mb-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 font-bold border border-orange-200" 
                                onClick={() => router.push('/org-admin')}
                            >
                                <ShieldCheck className="mr-2 h-4 w-4" /> {t('groups_adminCenter')}
                            </Button>
                        )}
                        <Button variant={activeMenu === 'join' ? 'secondary' : 'ghost'} className="justify-start mb-2" onClick={() => { setActiveMenu('join'); setSelectedOrgId(null); setSelectedGroupId(null); }}>
                            <Plus className="mr-2 h-4 w-4" /> {t('groups_joinNew')}
                        </Button>
                        <Separator className="my-2" />
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3 mb-2">{t('groups_joinedOrgs')}</h3>
                        
                        {memberships.map(m => {
                            const isOrgSelected = selectedOrgId === m.organizationId && !selectedGroupId;
                            return (
                                <div key={m.organizationId} className="flex flex-col">
                                    <Button 
                                        variant={isOrgSelected ? 'secondary' : 'ghost'} 
                                        className={cn("w-full justify-start h-auto py-2.5 px-3 rounded-lg mb-1", isOrgSelected && "bg-primary/10 text-primary hover:bg-primary/15")}
                                        onClick={() => { setActiveMenu('my-group'); setSelectedOrgId(m.organizationId); setSelectedGroupId(null); setIsChatOpen(false); }}
                                    >
                                        <Building className="mr-2 h-4 w-4 shrink-0" />
                                        <span className="truncate text-sm font-bold">{m.organizationName}</span>
                                    </Button>
                                    
                                    {selectedOrgId === m.organizationId && (
                                        <div className="flex flex-col pl-4 border-l ml-4 border-slate-200 mt-1 space-y-1">
                                            {myGroupsInOrg?.map(sg => {
                                                const isSgSelected = selectedGroupId === sg.id;
                                                return (
                                                    <Button 
                                                        key={sg.id}
                                                        variant="ghost"
                                                        className={cn("w-full justify-start h-8 text-xs px-2 gap-2 text-slate-600 hover:text-primary", isSgSelected && "text-primary font-bold bg-primary/5")}
                                                        onClick={() => { setSelectedGroupId(sg.id); setIsChatOpen(false); }}
                                                    >
                                                        <CornerDownRight className="h-3 w-3 opacity-50" />
                                                        <span className="truncate">{sg.name}</span>
                                                    </Button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </nav>
                </aside>

                <div className="overflow-y-auto custom-scrollbar">
                    {activeMenu === 'my-group' && selectedOrgId && (
                        <div className="p-8 max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500 h-auto">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-5">
                                    <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-sm border border-primary/20">
                                        {selectedGroupId ? <Shapes className="h-8 w-8" /> : <Building className="h-8 w-8" />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h1 className="text-3xl font-black tracking-tight text-slate-900">
                                                {selectedGroupId ? selectedGroup?.name : t('groups_joinCommunity')}
                                            </h1>
                                            {selectedGroupId && <Badge variant="outline" className="bg-primary/5">{t('groups_smallGroups').split(' ')[0]}</Badge>}
                                        </div>
                                        <p className="text-muted-foreground mt-1">
                                            {selectedGroupId ? `${selectedGroup?.leaderName} Leader` : t('groups_journeyWithCommunity')}
                                        </p>
                                    </div>
                                </div>
                                {selectedGroupId && (
                                    <Button variant="outline" className="rounded-full gap-2 border-primary text-primary hover:bg-primary/5" onClick={() => { setSelectedGroupId(null); setIsChatOpen(false); }}>
                                        <ArrowLeft className="h-4 w-4"/> {t('groups_backToList')}
                                    </Button>
                                )}
                            </div>

                            <div className="space-y-10 h-auto">
                                {selectedGroupId && (
                                    <div className="flex justify-center">
                                        <Button size="lg" className="h-16 px-10 text-xl font-black rounded-2xl shadow-xl shadow-primary/30 animate-bounce" onClick={() => setIsChatOpen(true)}>
                                            <MessageCircle className="mr-2 h-6 w-6"/> {t('groups_chatRoom')}
                                        </Button>
                                    </div>
                                )}

                                {!selectedGroupId && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-auto">
                                        <Card className="shadow-sm border-indigo-100 rounded-[10px] border-[0.5px] h-auto">
                                            <CardHeader className="bg-indigo-50/50 py-4">
                                                <CardTitle className="text-base flex items-center gap-2 text-indigo-900"><CalendarDays className="h-5 w-5"/> {t('groups_officialSchedule')}</CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-4 space-y-3 h-auto">
                                                {orgDailyContent?.schedules && orgDailyContent.schedules.length > 0 ? (
                                                    orgDailyContent.schedules.map((s, i) => (
                                                        <div key={i} className="flex items-center gap-4 p-3 bg-white border-[0.5px] rounded-xl border-slate-200 h-auto">
                                                            <Badge variant="outline" className="font-mono h-6 text-[10px]">{formatTimeLabel(s.time)}</Badge>
                                                            <span className="text-sm font-semibold">{s.content}</span>
                                                        </div>
                                                    ))
                                                ) : <p className="text-xs text-center py-10 text-muted-foreground">{t('groups_noEvents')}</p>}
                                            </CardContent>
                                        </Card>

                                        <Card className="shadow-sm border-orange-100 rounded-[10px] border-[0.5px] h-auto">
                                            <CardHeader className="bg-orange-50/50 py-4">
                                                <CardTitle className="text-base flex items-center gap-2 text-orange-900"><Megaphone className="h-5 w-5"/> {t('groups_news')}</CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-4 space-y-3 h-auto">
                                                {activePromotedEvents.length > 0 ? activePromotedEvents.map(e => (
                                                    <div key={e.id} className="p-3 border-[0.5px] border-slate-200 rounded-xl hover:bg-orange-50/30 cursor-pointer transition-colors h-auto" onClick={() => setSelectedEventId(e.id)}>
                                                        <p className="text-sm font-bold truncate">{e.title}</p>
                                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                                                            <CalendarIcon className="h-3 w-3"/> {e.date}
                                                        </div>
                                                    </div>
                                                )) : <p className="text-xs text-center py-10 text-muted-foreground">{t('groups_noNews')}</p>}
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                <section className="space-y-4 h-auto">
                                    <h3 className="text-lg font-black flex items-center gap-2 text-slate-800 border-b pb-2 h-auto">
                                        <BookOpen className="h-5 w-5 text-primary"/> {t('groups_sharedMeditations')}
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 h-auto">
                                        {filteredMeditations.length > 0 ? filteredMeditations.map(m => (
                                            <Card key={m.id} className="hover:shadow-md transition-all border-l-4 border-orange-400 cursor-pointer rounded-[10px] border-[0.5px] h-auto" onClick={() => setSelectedMeditation(m)}>
                                                <CardHeader className="p-4 pb-2">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={m.userProfilePictureUrl}/>
                                                            <AvatarFallback>{m.userDisplayName.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="text-sm font-bold">{m.userDisplayName}</p>
                                                            <p className="text-[10px] text-muted-foreground">{m.passage}</p>
                                                        </div>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="p-4 pt-0 h-auto">
                                                    <p className="text-sm text-slate-700 line-clamp-3 whitespace-pre-wrap leading-relaxed h-auto">{m.meditation}</p>
                                                </CardContent>
                                                <CardFooter className="p-2 border-t bg-muted/5 flex justify-between h-auto">
                                                    <span className="text-[10px] text-muted-foreground ml-2">
                                                        {m.createdAt?.toDate ? formatDistanceToNow(m.createdAt.toDate(), { addSuffix: true }) : '...'}
                                                    </span>
                                                    <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={(e) => { e.stopPropagation(); }}><ThumbsUp className="h-3 w-3"/> AMEN</Button>
                                                </CardFooter>
                                            </Card>
                                        )) : (
                                            <div className="col-span-full py-12 text-center bg-white border border-dashed rounded-2xl text-muted-foreground h-auto">
                                                <p className="text-sm">{t('forum_noPosts')}</p>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                <section className="space-y-4 h-auto">
                                    <h3 className="text-lg font-black flex items-center gap-2 text-slate-800 border-b pb-2 h-auto">
                                        <Hand className="h-5 w-5 text-primary"/> {t('groups_sharedPrayers')}
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-auto">
                                        {sharedPrayers && sharedPrayers.length > 0 ? sharedPrayers.map(p => (
                                            <Card key={p.id} className="shadow-sm hover:border-primary/30 transition-all cursor-pointer rounded-[10px] border-[0.5px] h-auto" onClick={() => setSelectedPrayer(p)}>
                                                <CardHeader className="p-5 pb-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="h-10 w-10 border shadow-sm">
                                                                <AvatarImage src={p.userProfilePictureUrl}/>
                                                                <AvatarFallback>{p.userDisplayName.charAt(0)}</AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <p className="font-bold text-slate-900">{p.userDisplayName}</p>
                                                                <p className="text-[10px] text-muted-foreground">
                                                                    {p.createdAt?.toDate ? formatDistanceToNow(p.createdAt.toDate(), { addSuffix: true }) : '...'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {p.visibility === 'private' && <Badge variant="destructive" className="text-[8px]">Private</Badge>}
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="p-5 pt-2 h-auto">
                                                    <p className="text-sm text-slate-700 leading-relaxed font-medium line-clamp-2 h-auto">{p.title}</p>
                                                </CardContent>
                                                <CardFooter className="p-3 border-t bg-slate-50/50 flex justify-end h-auto">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className={cn("h-8 px-4 gap-2 rounded-full", p.amens?.includes(user.uid) ? "bg-red-50 text-red-600" : "hover:bg-slate-100")}
                                                        onClick={(e) => handleAmen(e, p.id)}
                                                    >
                                                        <Heart className={cn("h-4 w-4", p.amens?.includes(user.uid) && "fill-current")}/>
                                                        AMEN {p.amens?.length || 0}
                                                    </Button>
                                                </CardFooter>
                                            </Card>
                                        )) : (
                                            <div className="col-span-full py-12 text-center bg-white border border-dashed rounded-2xl text-muted-foreground h-auto">
                                                <p className="text-sm">{t('prayerRoom_noPrayers')}</p>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {!selectedGroupId && (
                                    <section className="space-y-4 h-auto">
                                        <h3 className="text-lg font-black flex items-center gap-2 text-slate-800 border-b pb-2 h-auto">
                                            <Shapes className="h-5 w-5 text-emerald-600"/> {t('groups_smallGroups')}
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 h-auto">
                                            {allOrgGroups?.map(sg => {
                                                const isMember = sg.memberIds?.includes(user.uid);
                                                return (
                                                    <Card key={sg.id} className="hover:shadow-md transition-all rounded-[10px] border-[0.5px] h-auto">
                                                        <CardHeader className="p-4 pb-2">
                                                            <CardTitle className="text-sm font-bold truncate">{sg.name}</CardTitle>
                                                            <CardDescription className="text-[10px]">{sg.memberIds?.length || 0} members</CardDescription>
                                                        </CardHeader>
                                                        <CardFooter className="p-3 pt-0 flex justify-end h-auto">
                                                            {isMember ? (
                                                                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{t('groups_joined')}</Badge>
                                                            ) : (
                                                                <Button size="sm" variant="outline" className="h-7 text-[10px] rounded-full px-4" onClick={() => handleJoinSmallGroup(sg.id)}>{t('groups_join')}</Button>
                                                            )}
                                                        </CardFooter>
                                                    </Card>
                                                );
                                            })}
                                        </div>
                                    </section>
                                )}
                            </div>
                        </div>
                    )}

                    {activeMenu === 'my-group' && !selectedOrgId && (
                        <div className="p-12 max-w-4xl mx-auto space-y-10">
                            <div className="text-center space-y-4">
                                <div className="h-20 w-20 bg-primary/10 rounded-[30px] flex items-center justify-center text-primary mx-auto shadow-inner"><Building className="h-10 w-10"/></div>
                                <h1 className="text-4xl font-black tracking-tight text-slate-900">{t('groups_joinCommunity')}</h1>
                                <p className="text-lg text-muted-foreground">{t('groups_joinCommunityDesc')}</p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-auto">
                                {memberships.map(m => (
                                    <Card key={m.organizationId} className="group cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all border-t-4 border-primary rounded-[10px] border-[0.5px] h-auto" onClick={() => setSelectedOrgId(m.organizationId)}>
                                        <CardHeader className="flex flex-row items-center justify-between p-6">
                                            <div className="min-w-0">
                                                <CardTitle className="text-xl font-black truncate">{m.organizationName}</CardTitle>
                                                <CardDescription className="mt-1">{t('groups_joined')}: {m.joinedAt?.toDate ? format(m.joinedAt.toDate(), 'yyyy-MM-dd') : '...'}</CardDescription>
                                            </div>
                                            <div className="h-12 w-12 bg-muted rounded-2xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                                                <ChevronRight className="h-6 w-6" />
                                            </div>
                                        </CardHeader>
                                    </Card>
                                ))}
                                <Card className="border-dashed border-2 flex flex-col items-center justify-center py-10 cursor-pointer hover:bg-muted/50 transition-all group rounded-[10px] h-auto" onClick={() => setActiveMenu('join')}>
                                    <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><Plus className="h-6 w-6 text-muted-foreground" /></div>
                                    <p className="text-sm font-bold text-muted-foreground">{t('groups_registerNewOrg')}</p>
                                </Card>
                            </div>
                        </div>
                    )}

                    {activeMenu === 'join' && (
                        <div className="p-12 max-w-xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
                            <Card className="shadow-2xl border-t-8 border-primary rounded-3xl overflow-hidden border-[0.5px] h-auto relative">
                                <Button variant="ghost" size="icon" className="absolute top-4 right-4 rounded-full z-10 text-muted-foreground hover:bg-muted" onClick={() => setActiveMenu('my-group')}>
                                    <X className="h-5 w-5"/>
                                </Button>
                                <CardHeader className="p-8 pb-4">
                                    <div className="h-14 w-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-4"><Ticket className="h-8 w-8" /></div>
                                    <CardTitle className="text-2xl font-black">{t('groups_inviteCodeTitle')}</CardTitle>
                                    <CardDescription className="text-base">{t('groups_inviteCodeDesc')}</CardDescription>
                                </CardHeader>
                                <CardContent className="p-8 pt-0 space-y-6 h-auto">
                                    <div className="flex flex-col gap-4 h-auto">
                                        <input 
                                            value={inviteCode} 
                                            onChange={(e) => setInviteCode(e.target.value.toUpperCase())} 
                                            placeholder="CODE-1234" 
                                            className="flex h-16 w-full rounded-md border-2 border-input bg-background px-3 py-2 text-2xl font-black tracking-widest text-center uppercase ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
                                            disabled={isJoining} 
                                        />
                                        <div className="flex gap-3 h-auto">
                                            <Button variant="outline" onClick={() => setActiveMenu('my-group')} className="h-16 flex-1 text-lg font-bold rounded-2xl">
                                                {t('cancel')}
                                            </Button>
                                            <Button onClick={handleJoinOrg} disabled={isJoining || !inviteCode.trim()} className="h-16 flex-[2] text-lg font-black rounded-2xl shadow-lg shadow-primary/20">
                                                {isJoining ? <LoaderCircle className="h-6 w-6 animate-spin" /> : t('groups_join')}
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </main>

            <Dialog open={!!selectedEventId} onOpenChange={(open) => !open && setSelectedEventId(null)}>
                <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden rounded-[10px] bg-background">
                    {orgEvents?.find(e => e.id === selectedEventId) && (
                        <div className="flex flex-col h-full">
                            <header className="p-6 border-b shrink-0 bg-background/95 backdrop-blur-sm sticky top-0 z-10 flex justify-between items-center">
                                <div>
                                    <Badge className="bg-indigo-100 text-indigo-700 mb-2">{t('groups_specialEvent')}</Badge>
                                    <h2 className="text-2xl font-black tracking-tight">{orgEvents.find(e => e.id === selectedEventId)?.title}</h2>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                                        <span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3"/> {orgEvents.find(e => e.id === selectedEventId)?.date}</span>
                                        <span className="flex items-center gap-1"><Clock className="h-3 w-3"/> {formatTimeLabel(orgEvents.find(e => e.id === selectedEventId)?.time || '')}</span>
                                    </div>
                                </div>
                            </header>
                            <ScrollArea className="flex-1">
                                <div className="p-8 h-auto">
                                    <BlockRenderer blocks={orgEvents.find(e => e.id === selectedEventId)?.materialBlocks || []} />
                                </div>
                            </ScrollArea>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={!!selectedMeditation} onOpenChange={(open) => !open && setSelectedMeditation(null)}>
                <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-[10px] bg-background">
                    {selectedMeditation && (
                        <div className="flex flex-col h-full">
                            <header className="p-6 border-b shrink-0 bg-background/95 backdrop-blur-sm sticky top-0 z-10 flex justify-between items-start">
                                <div className="flex items-center gap-4">
                                    <Avatar className="h-12 w-12 border">
                                        <AvatarImage src={selectedMeditation.userProfilePictureUrl} />
                                        <AvatarFallback>{selectedMeditation.userDisplayName.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h2 className="text-xl font-black">{selectedMeditation.userDisplayName}</h2>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">{selectedMeditation.passage}</Badge>
                                            <span>•</span>
                                            <span>{selectedMeditation.createdAt?.toDate ? format(selectedMeditation.createdAt.toDate(), 'yyyy-MM-dd HH:mm') : '...'}</span>
                                        </div>
                                    </div>
                                </div>
                            </header>
                            <ScrollArea className="flex-1">
                                <div className="p-8 h-auto">
                                    <p className="text-lg leading-relaxed text-slate-800 whitespace-pre-wrap h-auto">
                                        {selectedMeditation.meditation}
                                    </p>
                                </div>
                            </ScrollArea>
                            <footer className="p-4 border-t bg-muted/5 flex justify-end gap-2 h-auto">
                                <Button variant="ghost" size="sm" className="gap-2"><ThumbsUp className="h-4 w-4"/> AMEN</Button>
                            </footer>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={!!selectedPrayer} onOpenChange={(open) => !open && setSelectedPrayer(null)}>
                <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-[10px] bg-background">
                    {selectedPrayer && (
                        <div className="flex flex-col h-full">
                            <header className="p-6 border-b shrink-0 bg-background/95 backdrop-blur-sm sticky top-0 z-10 flex justify-between items-start">
                                <div className="flex items-center gap-4">
                                    <Avatar className="h-12 w-12 border">
                                        <AvatarImage src={selectedPrayer.userProfilePictureUrl} />
                                        <AvatarFallback>{selectedPrayer.userDisplayName.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h2 className="text-xl font-black">{selectedPrayer.userDisplayName}</h2>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                            <span>{selectedPrayer.createdAt?.toDate ? format(selectedPrayer.createdAt.toDate(), 'yyyy-MM-dd HH:mm') : '...'}</span>
                                            {selectedPrayer.category === 'small_group' && (
                                                <>
                                                    <span>•</span>
                                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100">{selectedPrayer.groupName}</Badge>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </header>
                            <ScrollArea className="flex-1">
                                <div className="p-8 h-auto">
                                    <p className="text-xl font-medium leading-relaxed text-slate-800 whitespace-pre-wrap h-auto">
                                        {selectedPrayer.title}
                                    </p>
                                </div>
                            </ScrollArea>
                            <footer className="p-4 border-t bg-muted/5 flex justify-end gap-4 items-center h-auto">
                                <span className="text-sm text-muted-foreground font-bold">{selectedPrayer.amens?.length || 0} people are praying together.</span>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className={cn("h-9 px-6 gap-2 rounded-full", selectedPrayer.amens?.includes(user.uid) ? "bg-red-50 text-red-600" : "hover:bg-slate-100")}
                                    onClick={(e) => handleAmen(e, p.id)}
                                >
                                    <Heart className={cn("h-5 w-5", selectedPrayer.amens?.includes(user.uid) && "fill-current")}/>
                                    AMEN
                                </Button>
                            </footer>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {selectedOrgId && selectedGroupId && isChatOpen && (
                <SmallGroupChat 
                    orgId={selectedOrgId} 
                    groupId={selectedGroupId} 
                    onClose={() => setIsChatOpen(false)}
                />
            )}
        </div>
    );
}
