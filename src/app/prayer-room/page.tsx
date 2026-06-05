
'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useUser, useAuth, useMemoFirebase, useFirestore, useCollection } from '@/firebase';
import type { UserProfile, PrayerPost, DayData, SmallGroup, PrayerItem, PrayerFeedback } from '@/lib/types';
import { PrayerStatus } from '@/lib/types';
import { doc, collection, query, where, orderBy, runTransaction, documentId, limit, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardFooter, CardTitle, CardDescription } from '@/components/ui/card';
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
  Heart,
  Hand,
  Trash2,
  ShieldCheck,
  User,
  Building,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  EyeOff,
  Shapes
} from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { format, formatDistanceToNow, subDays, startOfToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { SpiritualWave } from '@/components/ui/spiritual-wave';
import { useTranslation } from '@/hooks/use-translation';
import LanguageSelect from '@/components/language-select';
import PrayerFeedbackDialog from '@/app/journal/components/PrayerFeedbackDialog';

const statusMap: Record<string, string> = {
  '기도중': 'inProgress',
  '응답됨': 'answered',
  '거절': 'declined',
  '기다림': 'waiting',
};

const PrayerPostCard = ({ post, currentUserId, isAdmin }: { post: PrayerPost, currentUserId: string, isAdmin: boolean }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { t } = useTranslation();

    const handleAmen = async () => {
        if (!firestore || !currentUserId) return;
        const postRef = doc(firestore, 'prayerPosts', post.id);

        try {
            await runTransaction(firestore, async (transaction) => {
                const postDoc = await transaction.get(postRef);
                if (!postDoc.exists()) throw "Document does not exist!";
                const currentAmens = postDoc.data().amens || [];
                let newAmens = [...currentAmens];
                const userIndex = newAmens.indexOf(currentUserId);
                if (userIndex > -1) newAmens.splice(userIndex, 1);
                else newAmens.push(currentUserId);
                transaction.update(postRef, { amens: newAmens });
            });
        } catch (e) {
            toast({ title: "Error", description: "Fail", variant: "destructive" });
        }
    };
    
    const handleDeletePost = async () => {
        if (!isAdmin && post.userId !== currentUserId) return;
        const postRef = doc(firestore, 'prayerPosts', post.id);
        try {
            await runTransaction(firestore, async (t) => { t.delete(postRef); });
            toast({ title: t('peoples_deleteSuccess'), variant: "destructive" });
        } catch (e) {
            toast({ title: "Fail", variant: "destructive" });
        }
    };

    const userHasSaidAmen = post.amens?.includes(currentUserId);

    return (
        <Card className="hover:shadow-md transition-shadow relative">
            {post.visibility === 'private' && (
                <div className="absolute top-2 right-12 z-10">
                    <Badge variant="destructive" className="gap-1"><EyeOff className="h-3 w-3"/>비공개 (관리자만 보임)</Badge>
                </div>
            )}
            <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 border">
                        <AvatarImage src={post.userProfilePictureUrl} />
                        <AvatarFallback>{post.userDisplayName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <div className="flex items-center justify-between">
                           <div>
                               <div className="flex items-center gap-2">
                                   <p className="font-bold text-slate-900">{post.userDisplayName}</p>
                                   {post.category === 'small_group' && <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-100">{post.groupName}</Badge>}
                               </div>
                               <p className="text-[10px] text-muted-foreground">
                                    {post.createdAt?.toDate ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true }) : '...'}
                                </p>
                           </div>
                           {(isAdmin || post.userId === currentUserId) && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>{t('peoples_deleteConfirmTitle')}</AlertDialogTitle>
                                            <AlertDialogDescription>{t('peoples_deleteConfirmDesc').replace('{name}', post.title)}</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <div className="flex justify-end gap-2 mt-4">
                                            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                            <Button variant="destructive" onClick={handleDeletePost}>{t('delete')}</Button>
                                        </div>
                                    </AlertDialogContent>
                                </AlertDialog>
                           )}
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <p className="whitespace-pre-wrap text-base font-medium text-slate-800 leading-relaxed">{post.title}</p>
            </CardContent>
            <CardFooter className="pt-2 border-t mt-2 flex items-center justify-end gap-4 bg-slate-50/50 py-2 px-4 rounded-b-lg">
                <Button variant="ghost" size="sm" onClick={handleAmen} className={cn("h-8 text-xs gap-2 rounded-full", userHasSaidAmen ? "bg-red-50 text-red-600 hover:bg-red-100" : "hover:bg-slate-100")}>
                    <Heart className={cn("h-4 w-4", userHasSaidAmen && "fill-current")} /> AMEN
                </Button>
                <span className="text-xs font-bold text-slate-500">{post.amens?.length || 0} participants</span>
            </CardFooter>
        </Card>
    );
};

export default function PrayerRoomPage() {
    const { user, profile, isUserLoading } = useUser();
    const auth = useAuth();
    const firestore = useFirestore();
    const router = useRouter();
    const pathname = usePathname();
    const { t } = useTranslation();
    const { toast } = useToast();

    const [selectedPrayerInfo, setSelectedPrayerInfo] = useState<{ id: string; date: string } | null>(null);

    const myOrgId = profile?.memberships?.[0]?.organizationId;
    const myOrgName = profile?.memberships?.[0]?.organizationName || 'Church';
    
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

    const isCurrentOrgAdmin = useMemo(() => 
        isSuperAdmin || (myOrgId && profile?.memberships?.some(m => m.organizationId === myOrgId && m.role === 'admin')),
    [isSuperAdmin, profile, myOrgId]);

    const mySmallGroupsQuery = useMemoFirebase(() => user && myOrgId ? query(collection(firestore, 'organizations', myOrgId, 'smallGroups'), where('memberIds', 'array-contains', user.uid)) : null, [user, myOrgId, firestore]);
    const { data: mySmallGroups } = useCollection<SmallGroup>(mySmallGroupsQuery);
    const activeSmallGroup = mySmallGroups?.[0];

    const myJournalsQuery = useMemoFirebase(() => user ? query(collection(firestore, 'users', user.uid, 'journal'), limit(100)) : null, [user, firestore]);
    const { data: myJournals } = useCollection<DayData>(myJournalsQuery);
    
    const allMyPrayers = useMemo(() => {
        if (!myJournals) return [];
        const prayers = myJournals.flatMap(j => (j.diary?.prayers || []).map(p => ({ ...p, date: j.date || j.id || '' })));
        return prayers.sort((a, b) => b.date.localeCompare(a.date));
    }, [myJournals]);

    const activeSelectedPrayer = useMemo(() => {
        if (!selectedPrayerInfo || !allMyPrayers) return null;
        return allMyPrayers.find(p => p.id === selectedPrayerInfo.id && p.date === selectedPrayerInfo.date) || null;
    }, [allMyPrayers, selectedPrayerInfo]);

    const churchPrayersQuery = useMemoFirebase(() => 
        (user && myOrgId) ? query(
            collection(firestore, 'prayerPosts'), 
            where('category', '==', 'church'), 
            where('organizationId', '==', myOrgId),
            orderBy('createdAt', 'desc')
        ) : null, 
    [user, myOrgId, firestore]);
    const { data: churchPrayersRaw, isLoading: churchLoading } = useCollection<PrayerPost>(churchPrayersQuery);

    const groupPrayersQuery = useMemoFirebase(() => 
        (user && activeSmallGroup) ? query(
            collection(firestore, 'prayerPosts'), 
            where('category', '==', 'small_group'), 
            where('groupId', '==', activeSmallGroup.id), 
            orderBy('createdAt', 'desc')
        ) : null, 
    [user, activeSmallGroup, firestore]);
    const { data: groupPrayersRaw, isLoading: groupLoading } = useCollection<PrayerPost>(groupPrayersQuery);

    const churchPrayers = useMemo(() => {
        if (!churchPrayersRaw) return [];
        if (isCurrentOrgAdmin) return churchPrayersRaw;
        return churchPrayersRaw.filter(p => p.visibility !== 'private');
    }, [churchPrayersRaw, isCurrentOrgAdmin]);

    const groupPrayers = useMemo(() => {
        if (!groupPrayersRaw) return [];
        if (isCurrentOrgAdmin) return groupPrayersRaw;
        return groupPrayersRaw.filter(p => p.visibility !== 'private');
    }, [groupPrayersRaw, isCurrentOrgAdmin]);

    const todayForQuery = startOfToday();
    const sevenDaysAgoStr = format(subDays(todayForQuery, 6), 'yyyy-MM-dd');
    const todayStr = format(todayForQuery, 'yyyy-MM-dd');
    const recentJournalQueryForWave = useMemoFirebase(() => user ? query(collection(firestore, 'users', user.uid, 'journal'), where(documentId(), '>=', sevenDaysAgoStr), where(documentId(), '<=', todayStr)) : null, [user, firestore, sevenDaysAgoStr, todayStr]);
    const { data: recentJournalsForWave } = useCollection<DayData>(recentJournalQueryForWave);

    const waveActivityLevel = useMemo(() => {
        if (!recentJournalsForWave) return 0;
        let count = 0;
        for (let i = 0; i < 7; i++) {
            const dateStr = format(subDays(todayForQuery, i), 'yyyy-MM-dd');
            const day = recentJournalsForWave.find(j => j.id === dateStr);
            if (day?.completed && day?.diaryCompleted) count++;
        }
        return count / 7;
    }, [recentJournalsForWave]);

    const handleUpdatePrayerFeedback = async (feedbacks: PrayerFeedback[]) => {
        if (!user || !firestore || !selectedPrayerInfo) return;
        const journalRef = doc(firestore, 'users', user.uid, 'journal', selectedPrayerInfo.date);
        try {
            const snap = await getDoc(journalRef);
            if (snap.exists()) {
                const data = snap.data() as DayData;
                const updatedPrayers = (data.diary?.prayers || []).map(p => 
                    p.id === selectedPrayerInfo.id ? { ...p, feedbacks } : p
                );
                await updateDoc(journalRef, {
                    'diary.prayers': updatedPrayers,
                    updatedAt: serverTimestamp()
                });
                toast({ title: t('save') });
            }
        } catch (e) {
            toast({ title: "Fail", variant: "destructive" });
        }
    };

    const handleUpdatePrayerStatus = async (date: string, prayerId: string, status: PrayerStatus) => {
        if (!user || !firestore) return;
        const journalRef = doc(firestore, 'users', user.uid, 'journal', date);
        try {
            const snap = await getDoc(journalRef);
            if (snap.exists()) {
                const data = snap.data() as DayData;
                const updatedPrayers = (data.diary?.prayers || []).map(p => 
                    p.id === prayerId ? { ...p, status } : p
                );
                await updateDoc(journalRef, {
                    'diary.prayers': updatedPrayers,
                    updatedAt: serverTimestamp()
                });
                toast({ title: t('peoples_updateSuccess') });
            }
        } catch (e) {
            toast({ title: "Fail", variant: "destructive" });
        }
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

            <main className="w-full flex-1 bg-[#fafafa] paper-texture rounded-2xl shadow-inner border-[5px] border-[#2e2848] flex flex-col min-h-0 overflow-hidden">
                <div className="p-8 flex flex-col h-full">
                     <h1 className="text-3xl font-bold mb-2 text-slate-900 tracking-tight">{t('prayerRoom_title')}</h1>
                     <p className="text-muted-foreground mb-6">{t('prayerRoom_desc')}</p>
                     <Tabs defaultValue="my" className="w-full flex-1 flex flex-col min-h-0">
                        <TabsList className="bg-slate-100 p-1 rounded-xl w-fit">
                            <TabsTrigger value="my" className="rounded-lg gap-2 font-bold"><User className="h-4 w-4"/>{t('prayerRoom_myPrayers')}</TabsTrigger>
                            {myOrgId && <TabsTrigger value="church" className="rounded-lg gap-2 font-bold"><Building className="h-4 w-4"/>{myOrgName}</TabsTrigger>}
                            {activeSmallGroup && <TabsTrigger value="group" className="rounded-lg gap-2 font-bold"><Users className="h-4 w-4"/>{activeSmallGroup.name}</TabsTrigger>}
                        </TabsList>
                        <TabsContent value="my" className="flex-1 min-h-0 mt-6 overflow-hidden">
                           <Card className="h-full flex flex-col">
                                <CardHeader className="border-b pb-4">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg">{t('prayerRoom_allMyPrayers')}</CardTitle>
                                        <p className="text-sm text-muted-foreground">{t('prayerRoom_totalPrayers').replace('{count}', allMyPrayers.length.toString())}</p>
                                    </div>
                                </CardHeader>
                                <ScrollArea className="flex-1">
                                    <div className="divide-y">
                                        {allMyPrayers.length > 0 ? (
                                            allMyPrayers.map((p, idx) => (
                                                <div key={`${p.id}-${idx}`} className="flex items-center justify-between p-4 hover:bg-muted/30 group">
                                                    <div className="flex items-center gap-4 flex-1">
                                                        <button 
                                                            onClick={() => router.push(`/journal?date=${p.date}`)}
                                                            className="flex flex-col items-center justify-center min-w-[100px] px-2 py-1 rounded bg-slate-100 text-slate-600 border text-[10px] font-bold hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
                                                        >
                                                            <span>{p.date}</span>
                                                        </button>
                                                        <span className="font-semibold text-slate-800 flex-1">{p.title}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <Select 
                                                            value={p.status} 
                                                            onValueChange={(v) => handleUpdatePrayerStatus(p.date, p.id, v as PrayerStatus)}
                                                        >
                                                            <SelectTrigger className={cn("w-[100px] h-8 text-[10px] px-2", p.status === '응답됨' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-blue-50 text-blue-700 border-blue-100')}>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {Object.values(PrayerStatus).map(s => (
                                                                    <SelectItem key={s} value={s}>{t(`prayerStatus_${statusMap[s] || 'inProgress'}`)}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setSelectedPrayerInfo({ id: p.id, date: p.date })}>
                                                            <MessageCircle className="h-3 w-3" /> {t('prayerRoom_feedback')}
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="py-20 text-center text-muted-foreground">
                                                <p>{t('prayerRoom_noPrayers')}</p>
                                                <Link href="/journal" className="text-primary font-bold mt-2 inline-block hover:underline">{t('signUpLink')}</Link>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                           </Card>
                        </TabsContent>
                        <TabsContent value="church" className="flex-1 min-h-0 mt-6"><ScrollArea className="h-full pr-4 -mr-4"><div className="max-w-3xl mx-auto space-y-4 pb-10">{churchLoading ? <LoadingSpinner /> : (churchPrayers?.length ? churchPrayers.map(post => <PrayerPostCard key={post.id} post={post} currentUserId={user.uid} isAdmin={isCurrentOrgAdmin || isSuperAdmin} />) : <div className="py-20 text-center text-muted-foreground bg-white border border-dashed rounded-2xl"><p>{t('prayerRoom_sharedNoPrayers').replace('{name}', myOrgName)}</p></div>)}</div></ScrollArea></TabsContent>
                        <TabsContent value="group" className="flex-1 min-h-0 mt-6"><ScrollArea className="h-full pr-4 -mr-4"><div className="max-w-3xl mx-auto space-y-4 pb-10">{groupLoading ? <LoadingSpinner /> : (groupPrayers?.length ? groupPrayers.map(post => <PrayerPostCard key={post.id} post={post} currentUserId={user.uid} isAdmin={isCurrentOrgAdmin || isSuperAdmin} />) : <div className="py-20 text-center text-muted-foreground bg-white border border-dashed rounded-2xl"><p>{t('prayerRoom_sharedNoPrayers').replace('{name}', activeSmallGroup?.name || '')}</p></div>)}</div></ScrollArea></TabsContent>
                     </Tabs>
                </div>
            </main>
            {activeSelectedPrayer && (
                <PrayerFeedbackDialog prayer={activeSelectedPrayer} onClose={() => setSelectedPrayerInfo(null)} onUpdateFeedbacks={handleUpdatePrayerFeedback} />
            )}
        </div>
    );
}
