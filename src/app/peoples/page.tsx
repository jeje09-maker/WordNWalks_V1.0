
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useUser, useAuth, useDoc, useMemoFirebase, useFirestore, useCollection, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import type { UserProfile, Person, DayData, SmallGroup } from '@/lib/types';
import { doc, collection, serverTimestamp, query, orderBy, writeBatch, where, documentId } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { cn } from '@/lib/utils';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format, subDays, startOfToday } from 'date-fns';
import { SpiritualWave } from '@/components/ui/spiritual-wave';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  Home,
  Users,
  CalendarDays,
  MessageSquare,
  MessageSquareQuote,
  User as UserIcon,
  LogOut,
  Plus,
  Trash2,
  FilePenLine,
  Hand,
  Search,
  ShieldCheck,
  Star,
  Shapes
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import PersonFormDialog from './components/PersonFormDialog';
import { useTranslation } from '@/hooks/use-translation';
import LanguageSelect from '@/components/language-select';

const categoryOrder = ['family', 'church', 'friend', 'colleague', 'neighbor', 'heart_held_friend', 'organization', 'other'];

const PersonCard = ({ person, onEdit, onDelete }: { person: Person; onEdit: (person: Person) => void; onDelete: (personId: string) => void; }) => {
    const { t } = useTranslation();
    return (
        <Card
            className="group relative flex flex-col p-3 text-center items-center w-[200px] h-[260px] shadow-md bg-background cursor-grab"
        >
            <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 z-10 flex items-center">
                <Button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onEdit(person); }} size="icon" variant="ghost" className="h-7 w-7">
                    <FilePenLine className="h-4 w-4" />
                </Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => {e.stopPropagation()}} size="icon" variant="ghost" className="h-7 w-7 text-destructive">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onPointerDown={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t('peoples_deleteConfirmTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {t('peoples_deleteConfirmDesc').replace('{name}', person.name)}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>{t('cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={(e) => { e.stopPropagation(); onDelete(person.id); }}>{t('delete')}</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
            {person.isFavorite && (
                <div className="absolute top-2 right-2 text-primary">
                    <Star className="h-4 w-4 fill-current" />
                </div>
            )}
            <div className="flex flex-col items-center pt-2">
                <Avatar className={cn("h-20 w-20 mb-3", person.relationship === 'organization' ? "rounded-2xl" : "rounded-full")}>
                    <AvatarImage src={person.avatarUrl} />
                    <AvatarFallback className="text-3xl">{person.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <h3 className="text-base font-semibold leading-tight line-clamp-1 px-2">{person.name}</h3>
                <p className="text-sm text-muted-foreground">
                    {t(`relationship_${person.relationship || 'other'}`)}
                </p>
                {person.birthDate && <p className="text-sm text-muted-foreground mt-0.5">🎂 {person.birthDate}</p>}
            </div>
            <div className="mt-auto w-full text-left pt-1">
            {person.comment && 
                <ScrollArea className="h-14 p-2 bg-muted/30 rounded-sm">
                    <p className="text-xs text-foreground whitespace-pre-wrap">{person.comment}</p>
                </ScrollArea>
            }
            </div>
        </Card>
    );
};

const SortablePersonCard = ({ person, onEdit, onDelete }: { person: Person; onEdit: (person: Person) => void; onDelete: (personId: string) => void; }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: person.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 100 : 'auto',
        opacity: isDragging ? 0.8 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <PersonCard person={person} onEdit={onEdit} onDelete={onDelete} />
        </div>
    );
};


const PeoplesPage: React.FC = () => {
    const { user, profile } = useUser();
    const auth = useAuth();
    const firestore = useFirestore();
    const router = useRouter();
    const pathname = usePathname();
    const { toast } = useToast();
    const { t } = useTranslation();

    const [isSaving, setIsSaving] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingPerson, setEditingPerson] = useState<Person | null>(null);

    const [activeCategory, setActiveCategory] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userDocRef);
    
    const peoplesRef = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'peoples') : null, [user, firestore]);
    const peoplesQuery = useMemoFirebase(() => peoplesRef ? query(peoplesRef, orderBy('order', 'asc')) : null, [peoplesRef]);
    const { data: peoples, isLoading: peoplesLoading } = useCollection<Person>(peoplesQuery);

    const [peopleList, setPeopleList] = useState<Person[]>([]);
    useEffect(() => {
        if (peoples) {
            setPeopleList(peoples);
        }
    }, [peoples]);
    
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


    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = peopleList.findIndex((p) => p.id === active.id);
            const newIndex = peopleList.findIndex((p) => p.id === over.id);

            const newOrderedList = arrayMove(peopleList, oldIndex, newIndex);
            setPeopleList(newOrderedList);

            if (firestore && peoplesRef) {
                const batch = writeBatch(firestore);
                newOrderedList.forEach((person, index) => {
                    const personRef = doc(peoplesRef, person.id);
                    batch.update(personRef, { order: index });
                });
                try {
                    await batch.commit();
                    toast({ title: t('peoples_orderSaved') });
                } catch (error) {
                    console.error("Error updating order:", error);
                    toast({ title: "Failed to save order.", variant: "destructive" });
                    setPeopleList(peoples || []); // Revert on error
                }
            }
        }
    };


    const handleSignOut = async () => {
        if (!auth) return;
        await signOut(auth);
        router.push('/');
    };

    const handleOpenEditDialog = (person: Person) => {
        setEditingPerson(person);
        setIsDialogOpen(true);
    };

    const handleOpenAddDialog = () => {
        setEditingPerson(null);
        setIsDialogOpen(true);
    };

    const handleDeletePerson = (personId: string) => {
        if (!user || !peoplesRef) return;
        const personDocRef = doc(peoplesRef, personId);
        deleteDocumentNonBlocking(personDocRef);
        toast({ title: t('peoples_deleteSuccess'), variant: "destructive"});
    };

    const handleSavePerson = async (personData: Partial<Person> & { id?: string }) => {
        if (!user || !peoplesRef || !personData.name?.trim()) {
            toast({ title: "Name is required.", variant: "destructive" });
            return;
        }
        setIsSaving(true);
        
        try {
            if (personData.id) { // Editing existing person
                const personDocRef = doc(peoplesRef, personData.id);
                const { id, ...dataToUpdate } = personData;
                updateDocumentNonBlocking(personDocRef, dataToUpdate);
                toast({ title: t('peoples_updateSuccess') });
            } else { // Adding new person
                await addDocumentNonBlocking(peoplesRef, {
                    ...personData,
                    userId: user.uid,
                    createdAt: serverTimestamp(),
                    order: peopleList.length || 0,
                });
                toast({ title: t('peoples_addSuccess') });
            }
        } catch (error) {
            console.error("Error saving person:", error);
            toast({ title: "Error", description: "Failed to save information.", variant: "destructive" });
        } finally {
            setIsSaving(false);
            setIsDialogOpen(false);
        }
    };
    
    const filteredPeople = useMemo(() => {
        if (!peopleList) return [];
        return searchTerm
            ? peopleList.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
            : peopleList;
    }, [peopleList, searchTerm]);

    const groupedAndFilteredPeoples = useMemo(() => {
        let source = filteredPeople;
        
        if (activeCategory === 'favorites') {
            source = filteredPeople.filter(p => p.isFavorite === true);
        } else if (activeCategory !== 'all') {
            source = filteredPeople.filter(p => (p.relationship || 'other') === activeCategory);
        }
        
        return source.reduce((acc, person) => {
            const category = person.relationship || 'other';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(person);
            return acc;
        }, {} as Record<string, Person[]>);

    }, [filteredPeople, activeCategory]);


    const categoriesWithContent = Object.keys(groupedAndFilteredPeoples).sort((a, b) => {
        const indexA = categoryOrder.indexOf(a);
        const indexB = categoryOrder.indexOf(b);
        if (indexA === -1 && indexB === -1) return a.localeCompare(b);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    const isSortable = !searchTerm && activeCategory === 'all';
    
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

            <main className="flex-1 bg-background p-6 min-h-0 flex flex-col">
                <div className="flex items-center justify-between mb-4 gap-4">
                    <div className="relative w-full max-sm:max-w-[200px] max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="이름으로 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
                    </div>
                    <Button onClick={handleOpenAddDialog} className="shrink-0">
                        <Plus className="mr-2 h-4 w-4"/>
                        {t('peoples_addPerson')}
                    </Button>
                </div>

                <div className="border-b overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-2 whitespace-nowrap pb-1">
                        <Button variant={activeCategory === 'all' ? 'secondary' : 'ghost'} onClick={() => setActiveCategory('all')} className="h-auto px-6 py-3 text-base">{t('peoples_all')}</Button>
                        <Button variant={activeCategory === 'favorites' ? 'secondary' : 'ghost'} onClick={() => setActiveCategory('favorites')} className="h-auto px-6 py-3 text-base flex items-center gap-2 text-primary font-bold">
                            <Star className={cn("h-4 w-4", activeCategory === 'favorites' && "fill-current")} />
                            {t('peoples_favorites')}
                        </Button>
                        {categoryOrder.map(cat => (
                            <Button key={cat} variant={activeCategory === cat ? 'secondary' : 'ghost'} onClick={() => setActiveCategory(cat)} className="h-auto px-6 py-3 text-base">
                                {t(`relationship_${cat}`)}
                            </Button>
                        ))}
                    </div>
                </div>
                
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <ScrollArea className="flex-1 mt-6 -mx-6 px-6">
                        {peoplesLoading ? (
                            <LoadingSpinner />
                        ) : isSortable ? (
                            <div className="space-y-8">
                                <SortableContext items={peopleList} strategy={rectSortingStrategy}>
                                    {categoriesWithContent.map(catKey => (
                                        <div key={catKey}>
                                            <h2 className="text-xl font-bold mb-4">{t(`relationship_${catKey}`)}</h2>
                                            <div className="flex flex-wrap gap-4">
                                                {groupedAndFilteredPeoples[catKey]?.map(person => (
                                                    <SortablePersonCard key={person.id} person={person} onEdit={handleOpenEditDialog} onDelete={handleDeletePerson} />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </SortableContext>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {categoriesWithContent.map(catKey => {
                                    if (!groupedAndFilteredPeoples[catKey] || groupedAndFilteredPeoples[catKey].length === 0) return null;
                                    return (
                                        <div key={catKey}>
                                            {activeCategory !== catKey && <h2 className="text-xl font-bold mb-4">{t(`relationship_${catKey}`)}</h2>}
                                            <div className="flex flex-wrap gap-4">
                                                {groupedAndFilteredPeoples[catKey].map(person => (
                                                    <PersonCard key={person.id} person={person} onEdit={handleOpenEditDialog} onDelete={handleDeletePerson} />
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}

                                {Object.keys(groupedAndFilteredPeoples).length === 0 && (
                                     <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
                                        {activeCategory === 'favorites' ? (
                                            <>
                                                <Star className="h-16 w-16 opacity-20" />
                                                <div className="text-center">
                                                    <p className="text-lg font-bold">즐겨찾는 대상이 없습니다.</p>
                                                    <p className="text-sm">자주 기도하거나 기억하고 싶은 대상을 편집 창에서 즐겨찾기에 추가해보세요.</p>
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-center">
                                                {searchTerm ? t('peoples_searchNoResult').replace('{name}', searchTerm) : t('peoples_noContent')}
                                            </p>
                                        )}
                                     </div>
                                )}
                            </div>
                        )}
                    </ScrollArea>
                </DndContext>
            </main>

            {isDialogOpen && (
                <PersonFormDialog 
                    person={editingPerson}
                    onSave={handleSavePerson}
                    onClose={() => setIsDialogOpen(false)}
                    isSaving={isSaving}
                />
            )}
        </div>
    );
};

export default PeoplesPage;
