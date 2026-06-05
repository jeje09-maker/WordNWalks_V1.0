'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useUser, useAuth, useDoc, useMemoFirebase, useFirestore, useCollection, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import type { UserProfile, BibleBook, ForumPost, DayData } from '@/lib/types';
import { doc, collection, query, where, orderBy, Timestamp, runTransaction, documentId } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
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
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardFooter, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Home,
  Users,
  CalendarDays,
  MessageSquare,
  MessageSquareQuote,
  User as UserIcon,
  LogOut,
  BookOpen,
  FilePenLine,
  Trash2,
  ThumbsUp,
  Hand,
  LoaderCircle,
  ShieldCheck,
  Shapes
} from 'lucide-react';
import { OLD_TESTAMENT_BOOKS, NEW_TESTAMENT_BOOKS } from '@/lib/bible-books';
import LoadingSpinner from '@/components/LoadingSpinner';
import { formatDistanceToNow, startOfToday, subDays, format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { SpiritualWave } from '@/components/ui/spiritual-wave';
import { useTranslation } from '@/hooks/use-translation';
import LanguageSelect from '@/components/language-select';


const reactionEmojis: Record<string, string> = {
  heart: '❤️',
  insight: '✨',
  wow: '🤩',
  touched: '😊',
  pray: '🙏',
  best: '🏆',
  cheer: '👏',
};


const ForumPostCard = ({ post, currentUserId, isAdmin }: { post: ForumPost, currentUserId: string, isAdmin: boolean }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { t } = useTranslation();
    const [showReactionPopup, setShowReactionPopup] = useState(false);
    const reactionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleDeletePost = () => {
        if (!isAdmin && post.userId !== currentUserId) return;

        const postRef = doc(firestore, 'forumPosts', post.id);
        deleteDocumentNonBlocking(postRef);
        toast({
            title: t('peoples_deleteSuccess'),
            variant: "destructive"
        });
    };

    const handleReactionTriggerEnter = () => {
        if (reactionTimeoutRef.current) {
            clearTimeout(reactionTimeoutRef.current);
        }
        setShowReactionPopup(true);
    };

    const handleReactionTriggerLeave = () => {
        reactionTimeoutRef.current = setTimeout(() => {
            setShowReactionPopup(false);
        }, 300);
    };

    const handleReaction = async (reactionType: string) => {
        if (!firestore) return;
        setShowReactionPopup(false);
        const postRef = doc(firestore, 'forumPosts', post.id);

        try {
            await runTransaction(firestore, async (transaction) => {
                const postDoc = await transaction.get(postRef);
                if (!postDoc.exists()) {
                    throw "Document does not exist!";
                }

                const currentReactions = postDoc.data().reactions || {};
                
                const newReactions = JSON.parse(JSON.stringify(currentReactions));

                let previousReaction = null;
                for (const key in newReactions) {
                    const index = (newReactions[key] || []).indexOf(currentUserId);
                    if (index > -1) {
                        previousReaction = key;
                        newReactions[key].splice(index, 1);
                        break; 
                    }
                }

                if (previousReaction !== reactionType) {
                    if (!newReactions[reactionType]) {
                        newReactions[reactionType] = [];
                    }
                    newReactions[reactionType].push(currentUserId);
                }
                
                transaction.update(postRef, { reactions: newReactions });
            });
        } catch (e) {
            toast({
                title: "Error",
                variant: "destructive"
            });
        }
    };
    
    const reactionSummary = Object.entries(post.reactions || {})
        .map(([key, users]) => ({
            key,
            emoji: reactionEmojis[key],
            count: users.length,
        }))
        .filter(reaction => reaction.count > 0)
        .sort((a, b) => b.count - a.count);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                        <AvatarImage src={post.userProfilePictureUrl} />
                        <AvatarFallback>{post.userDisplayName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <div className="flex items-center justify-between">
                           <div>
                               <p className="font-semibold">{post.userDisplayName}</p>
                               <p className="text-xs text-muted-foreground">{post.passage}</p>
                           </div>
                           <div className="flex items-center gap-2">
                                <p className="text-xs text-muted-foreground">
                                    {post.createdAt && (post.createdAt as any).toDate
                                    ? formatDistanceToNow((post.createdAt as any).toDate(), { addSuffix: true })
                                    : '...'}
                                </p>
                                {(isAdmin || post.userId === currentUserId) && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>{t('peoples_deleteConfirmTitle')}</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            {t('peoples_deleteConfirmDesc').replace('{name}', post.passage)}
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                          <AlertDialogAction onClick={handleDeletePost}>{t('delete')}</AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                )}
                           </div>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <p className="whitespace-pre-wrap">{post.meditation}</p>
            </CardContent>

            <CardFooter className="pt-2 border-t mt-2 flex items-center justify-between">
                 <div 
                    className="relative"
                    onMouseEnter={handleReactionTriggerEnter}
                    onMouseLeave={handleReactionTriggerLeave}
                >
                     <Button
                        variant="ghost"
                        size="sm"
                        className="peer text-muted-foreground hover:text-primary"
                    >
                        <ThumbsUp className="h-5 w-5 mr-2" />
                        AMEN
                    </Button>
                    
                    {showReactionPopup && (
                        <div className="absolute bottom-8 flex gap-1 p-1 bg-card border rounded-full shadow-lg animate-in fade-in-0 zoom-in-95">
                            {Object.entries(reactionEmojis).map(([key, emoji]) => (
                                <button
                                    key={key}
                                    onClick={() => handleReaction(key)}
                                    className="p-1 rounded-full transition-transform hover:scale-125"
                                    aria-label={key}
                                >
                                    <span className="text-3xl">{emoji}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                {reactionSummary.length > 0 && (
                    <div className="flex items-center gap-2">
                        {reactionSummary.map(({ key, emoji, count }) => (
                            <div key={key} className="flex items-center gap-1 rounded-full border bg-muted/50 py-0.5 px-2">
                                <span className="text-sm">{emoji}</span>
                                <span className="text-xs font-semibold">{count}</span>
                            </div>
                        ))}
                    </div>
                )}
            </CardFooter>
        </Card>
    );
};


const ForumPage: React.FC = () => {
    const { user, profile } = useUser();
    const auth = useAuth();
    const firestore = useFirestore();
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const { t } = useTranslation();

    const selectedBookName = searchParams.get('book');

    const [selectedChapter, setSelectedChapter] = React.useState<number | null>(1);
    const [chapterPostCounts, setChapterPostCounts] = useState<Map<number, number>>(new Map());
    
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
    
    const selectedBookData = useMemo(() => {
        if (!selectedBookName) return null;
        const book = OLD_TESTAMENT_BOOKS.find(b => b.englishName === selectedBookName) || NEW_TESTAMENT_BOOKS.find(b => b.englishName === selectedBookName);
        if (book) {
            setSelectedChapter(1); 
        }
        return book;
    }, [selectedBookName]);

    const forumPostsQuery = useMemoFirebase(() => {
        if (!firestore || !selectedBookData || selectedChapter === null) return null;
        return query(
            collection(firestore, 'forumPosts'),
            where('bookKey', '==', selectedBookData.key),
            where('chapter', '==', selectedChapter),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, selectedBookData, selectedChapter]);

    const { data: forumPosts, isLoading: postsLoading } = useCollection<ForumPost>(forumPostsQuery);

    const allBookPostsQuery = useMemoFirebase(() => {
        if (!firestore || !selectedBookData) return null;
        return query(
            collection(firestore, 'forumPosts'),
            where('bookKey', '==', selectedBookData.key)
        );
    }, [firestore, selectedBookData]);

    const { data: allBookPosts } = useCollection<ForumPost>(allBookPostsQuery);

    useEffect(() => {
        if (allBookPosts) {
            const counts = new Map<number, number>();
            allBookPosts.forEach(post => {
                counts.set(post.chapter, (counts.get(post.chapter) || 0) + 1);
            });
            setChapterPostCounts(counts);
        }
    }, [allBookPosts]);

    // ✅ 수정: early return 전에 모든 훅을 먼저 선언
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

    const handleBookSelect = (book: BibleBook) => {
        router.push(`/forum?book=${book.englishName}`);
    };

    const handleChapterSelect = (chapter: number) => {
        setSelectedChapter(chapter);
    };

    const getChapterIndicator = (count: number | undefined): string | null => {
        if (!count || count === 0) return null;
        if (count >= 1000) return '👑';
        if (count >= 301) return '💎';
        if (count >= 101) return '🎖️';
        if (count >= 51) return '🔥';
        if (count >= 11) return '🌸';
        if (count > 0) return '🌿';
        return null;
    };
    
    const renderBookList = (books: BibleBook[]) => (
        <div className="space-y-1">
            {books.map((book) => (
                <Button
                    key={book.key || book.englishName}
                    variant="ghost"
                    className={cn(
                        "w-full justify-start hover:bg-white/10 hover:text-white",
                        selectedBookName === book.englishName && "bg-white/20 text-white font-semibold"
                    )}
                    onClick={() => handleBookSelect(book)}
                >
                    {t(`bible_${book.key}`)}
                </Button>
            ))}
        </div>
    );

    // ✅ 수정: 모든 훅 선언 후 early return
    if (postsLoading || !user) {
        return <LoadingSpinner fullScreen />;
    }

    return (
        <div className="h-screen bg-[#2e2848] flex flex-col font-sans">
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

            <main className="w-full flex-1 bg-[#fafafa] paper-texture rounded-2xl shadow-inner border-[5px] border-[#2e2848] grid grid-cols-1 md:grid-cols-[200px_1fr] min-h-0 overflow-hidden">
                <aside className="border-r border-slate-700 bg-[#2e2848] text-slate-300 flex flex-col min-h-0 rounded-bl-xl">
                    <div className="p-4 border-b border-slate-700">
                        <h2 className="text-lg font-semibold text-white">{t('forum_bibleForum')}</h2>
                    </div>
                    <Tabs defaultValue="old-testament" className="flex-1 flex flex-col min-h-0">
                        <TabsList className="grid w-auto grid-cols-2 m-2 mx-auto bg-slate-900/50 p-1">
                            <TabsTrigger value="old-testament" className="text-slate-300 data-[state=active]:bg-slate-50 data-[state=active]:text-slate-900">{t('forum_ot')}</TabsTrigger>
                            <TabsTrigger value="new-testament" className="text-slate-300 data-[state=active]:bg-slate-50 data-[state=active]:text-slate-900">{t('forum_nt')}</TabsTrigger>
                        </TabsList>
                        <ScrollArea className="flex-1">
                            <TabsContent value="old-testament" className="p-2">
                                {renderBookList(OLD_TESTAMENT_BOOKS)}
                            </TabsContent>
                            <TabsContent value="new-testament" className="p-2">
                                {renderBookList(NEW_TESTAMENT_BOOKS)}
                            </TabsContent>
                        </ScrollArea>
                    </Tabs>
                </aside>
                <main className="min-h-0">
                    <ScrollArea className="h-full">
                        <div className="p-8">
                            {postsLoading ? <LoadingSpinner /> : selectedBookData ? (
                                <div>
                                    <h1 className="text-3xl font-bold mb-6">{t(`bible_${selectedBookData.key}`)} ({selectedBookData.englishName})</h1>
                                    <div className="grid grid-cols-10 gap-2">
                                        {Array.from({ length: selectedBookData.chapters }, (_, i) => i + 1).map((chapter) => {
                                            const count = chapterPostCounts.get(chapter);
                                            const indicator = getChapterIndicator(count);
                                            return (
                                                <Button
                                                    key={chapter}
                                                    variant={selectedChapter === chapter ? 'default' : 'outline'}
                                                    className="relative h-12 w-12 text-lg font-semibold"
                                                    onClick={() => handleChapterSelect(chapter)}
                                                >
                                                    <div className="flex items-center justify-center gap-0.5">
                                                        {chapter}
                                                        {indicator && <span className="text-sm">{indicator}</span>}
                                                    </div>
                                                </Button>
                                            );
                                        })}
                                    </div>
                                    <div className="mt-8">
                                        <h2 className="text-2xl font-bold mb-4">{t('forum_postsInChapter').replace('{chapter}', (selectedChapter || 1).toString()).replace('{count}', (forumPosts?.length || 0).toString())}</h2>
                                        <div className="space-y-4">
                                            {forumPosts && forumPosts.length > 0 ? (
                                                forumPosts.map(post => (
                                                    <ForumPostCard key={post.id} post={post} currentUserId={user.uid} isAdmin={isSuperAdmin} />
                                                ))
                                            ) : (
                                                <Card>
                                                    <CardContent className="p-6 text-center text-muted-foreground">
                                                        <p>{t('forum_noPosts')}</p>
                                                    </CardContent>
                                                </Card>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                                    <BookOpen className="h-24 w-24 mb-4" />
                                    <h2 className="text-2xl font-bold">{t('forum_selectBook')}</h2>
                                    <p>{t('forum_selectBookDesc')}</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </main>
            </main>
        </div>
    );
};

export default ForumPage;
