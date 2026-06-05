
'use client';

import React, { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
    ArrowLeft, BookOpen, CalendarCheck, Lightbulb, Users, ChevronRight, 
    Bookmark, Library, Plus, Sailboat, Scale, Bird, Wind, Anchor, 
    Mountain, Heart, Shield, Sun, Moon, Search, CheckCircle2, Sparkles,
    ShieldCheck, Building, Droplets, Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BIBLE_SEGMENTS_OT, BIBLE_SEGMENTS_NT, BIBLE_BOOK_KEYS } from '@/lib/bible-segments';
import type { BibleSegment, GlobalBibleSegment } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/use-translation';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const IconWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
    {children}
  </div>
);

const GenesisIcon = () => <IconWrapper><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg></IconWrapper>;
const ExodusIcon = () => <IconWrapper><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg></IconWrapper>;
const LeviticusIcon = () => <IconWrapper><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 18.67c.9-1.33 2.13-2.33 4-3.33-2.01-1-2.9-2.02-4-3.34-1.1 1.32-1.99 2.34-4-3.34 1.87 1 3.1 2 4 3.33z"></path></svg></IconWrapper>;
const NumbersIcon = () => <IconWrapper><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path></svg></IconWrapper>;
const DeuteronomyIcon = () => <IconWrapper><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v15H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg></IconWrapper>;

const oldTestamentBooks = [
    { key: 'genesis', name: '창세기', icon: <GenesisIcon /> },
    { key: 'exodus', name: '출애굽기', icon: <ExodusIcon /> },
    { key: 'leviticus', name: '레위기', icon: <LeviticusIcon /> },
    { key: 'numbers', name: '민수기', icon: <NumbersIcon /> },
    { key: 'deuteronomy', name: '신명기', icon: <DeuteronomyIcon /> },
    { key: 'joshua', name: '여호수아', icon: <IconWrapper><Wind /></IconWrapper> },
    { key: 'judges', name: '사사기', icon: <IconWrapper><Scale /></IconWrapper> },
    { key: 'ruth', name: '룻기', icon: <IconWrapper><Heart /></IconWrapper> },
    { key: '1samuel', name: '사무엘상', icon: <IconWrapper><Plus /></IconWrapper> },
    { key: '2samuel', name: '사무엘하', icon: <IconWrapper><Plus opacity="0.5" /></IconWrapper> },
    { key: '1kings', name: '열왕기상', icon: <IconWrapper><Building /></IconWrapper> },
    { key: '2kings', name: '열왕기하', icon: <IconWrapper><Building opacity="0.5" /></IconWrapper> },
    { key: '1chronicles', name: '역대상', icon: <IconWrapper><Library /></IconWrapper> },
    { key: '2chronicles', name: '역대하', icon: <IconWrapper><Library opacity="0.5" /></IconWrapper> },
    { key: 'ezra', name: '에스라', icon: <IconWrapper><Plus /></IconWrapper> },
    { key: 'nehemiah', name: '느헤미야', icon: <IconWrapper><ShieldCheck /></IconWrapper> },
    { key: 'esther', name: '에스더', icon: <IconWrapper><Shield /></IconWrapper> },
    { key: 'job', name: '욥기', icon: <IconWrapper><Mountain /></IconWrapper> },
    { key: 'psalms', name: '시편', icon: <IconWrapper><Sun /></IconWrapper> },
    { key: 'proverbs', name: '잠언', icon: <IconWrapper><Lightbulb /></IconWrapper> },
    { key: 'ecclesiastes', name: '전도서', icon: <IconWrapper><Moon /></IconWrapper> },
    { key: 'songofsolomon', name: '아가', icon: <IconWrapper><Heart /></IconWrapper> },
    { key: 'isaiah', name: '이사야', icon: <IconWrapper><Wind /></IconWrapper> },
    { key: 'jeremiah', name: '예레미야', icon: <IconWrapper><Droplets /></IconWrapper> },
    { key: 'lamentations', name: '예레미야애가', icon: <IconWrapper><Droplets opacity="0.5" /></IconWrapper> },
    { key: 'ezekiel', name: '에스겔', icon: <IconWrapper><Sparkles /></IconWrapper> },
    { key: 'daniel', name: '다니엘', icon: <IconWrapper><ShieldCheck /></IconWrapper> },
    { key: 'hosea', name: '호세아', icon: <IconWrapper><Heart opacity="0.5" /></IconWrapper> },
    { key: 'joel', name: '요엘', icon: <IconWrapper><Wind opacity="0.5" /></IconWrapper> },
    { key: 'amos', name: '아모스', icon: <IconWrapper><Scale /></IconWrapper> },
    { key: 'obadiah', name: '오바댜', icon: <IconWrapper><Target /></IconWrapper> },
    { key: 'jonah', name: '요나', icon: <IconWrapper><Sailboat /></IconWrapper> },
    { key: 'micah', name: '미가', icon: <IconWrapper><CheckCircle2 /></IconWrapper> },
    { key: 'nahum', name: '나훔', icon: <IconWrapper><Shield opacity="0.5" /></IconWrapper> },
    { key: 'habakkuk', name: '하박국', icon: <IconWrapper><Anchor /></IconWrapper> },
    { key: 'zephaniah', name: '스바냐', icon: <IconWrapper><Wind opacity="0.3" /></IconWrapper> },
    { key: 'haggai', name: '학개', icon: <IconWrapper><Building /></IconWrapper> },
    { key: 'zechariah', name: '스가랴', icon: <IconWrapper><Sparkles opacity="0.5" /></IconWrapper> },
    { key: 'malachi', koreanName: '말라기', name: '말라기', icon: <IconWrapper><Sun opacity="0.5" /></IconWrapper> },
];

const newTestamentBooks = [
    { key: 'matthew', name: '마태복음', icon: <IconWrapper><BookOpen /></IconWrapper> },
    { key: 'mark', name: '마가복음', icon: <IconWrapper><Bookmark /></IconWrapper> },
    { key: 'luke', name: '누가복음', icon: <IconWrapper><Heart /></IconWrapper> },
    { key: 'john', name: '요한복음', icon: <IconWrapper><Sun /></IconWrapper> },
    { key: 'acts', name: '사도행전', icon: <IconWrapper><Wind /></IconWrapper> },
    { key: 'romans', name: '로마서', icon: <IconWrapper><Scale /></IconWrapper> },
    { key: '1corinthians', name: '고린도전서', icon: <IconWrapper><Plus /></IconWrapper> },
    { key: '2corinthians', name: '고린도후서', icon: <IconWrapper><Anchor /></IconWrapper> },
    { key: 'galatians', name: '갈라디아서', icon: <IconWrapper><Shield /></IconWrapper> },
    { key: 'ephesians', name: '에베소서', icon: <IconWrapper><Library /></IconWrapper> },
    { key: 'philippians', name: '빌립보서', icon: <IconWrapper><Sun /></IconWrapper> },
    { key: 'colossians', name: '골로새서', icon: <IconWrapper><Mountain /></IconWrapper> },
    { key: '1thessalonians', name: '데살로니가전서', icon: <IconWrapper><Moon /></IconWrapper> },
    { key: '2thessalonians', name: '데살로니가후서', icon: <IconWrapper><Moon /></IconWrapper> },
    { key: '1timothy', name: '디모데전서', icon: <IconWrapper><Users /></IconWrapper> },
    { key: '2timothy', name: '디모데후서', icon: <IconWrapper><Users /></IconWrapper> },
    { key: 'titus', name: '디도서', icon: <IconWrapper><Users /></IconWrapper> },
    { key: 'philemon', name: '빌레몬서', icon: <IconWrapper><Bird /></IconWrapper> },
    { key: 'hebrews', name: '히브리서', icon: <IconWrapper><Anchor /></IconWrapper> },
    { key: 'james', name: '야고보서', icon: <IconWrapper><Scale /></IconWrapper> },
    { key: '1peter', name: '베드로전서', icon: <IconWrapper><Sailboat /></IconWrapper> },
    { key: '2peter', name: '베드로후서', icon: <IconWrapper><Sailboat /></IconWrapper> },
    { key: '1john', name: '요한1서', icon: <IconWrapper><Heart /></IconWrapper> },
    { key: '2john', name: '요한2서', icon: <IconWrapper><Heart /></IconWrapper> },
    { key: '3john', name: '요한3서', icon: <IconWrapper><Heart /></IconWrapper> },
    { key: 'jude', name: '유다서', icon: <IconWrapper><Shield /></IconWrapper> },
    { key: 'revelation', name: '요한계시록', icon: <IconWrapper><Sun /></IconWrapper> },
];

const categories = [
    { id: 'book', name: '책별 말씀', icon: BookOpen },
    { id: 'season', name: '절기별 말씀', icon: CalendarCheck },
    { id: 'theme', name: '주제별 말씀', icon: Lightbulb },
    { id: 'community', name: '교회 및 단체', icon: Users },
];

export default function SeriesPage() {
    const router = useRouter();
    const firestore = useFirestore();
    const searchParams = useSearchParams();
    const date = searchParams.get('date');
    const { lang } = useTranslation();
    const [activeCategory, setActiveCategory] = useState('book');
    const [selectedBook, setSelectedBook] = useState<string | null>(searchParams.get('book'));
    const [searchTerm, setSearchTerm] = useState('');

    const segmentsQuery = useMemoFirebase(() => 
        query(collection(firestore, 'bibleSegments'), where('language', '==', lang)), 
        [firestore, lang]
    );
    const { data: globalSegments } = useCollection<GlobalBibleSegment>(segmentsQuery);

    const activeSegmentIds = useMemo(() => {
        return new Set(globalSegments?.map(s => s.id.replace(`${lang}_`, '')) || []);
    }, [globalSegments, lang]);

    const handleSelectSegment = (segment: BibleSegment) => {
      const bookName = BIBLE_BOOK_KEYS[selectedBook!];
      const passage = `${bookName} ${segment.range}`;
      const params = new URLSearchParams();
      if (date) {
        params.append('date', date);
      }
      params.append('passage', passage);
      params.append('segmentId', segment.id);
      router.push(`/journal?${params.toString()}`);
    };

    const renderBookList = (books: any[]) => {
        const filteredBooks = books.filter(book => (book.name || '').toLowerCase().includes(searchTerm.toLowerCase()));

        if (filteredBooks.length === 0 && searchTerm) {
            return <p className="text-muted-foreground text-center col-span-full py-10">검색 결과가 없습니다.</p>;
        }

        return (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                {filteredBooks.map((book) => (
                    <Card 
                        key={book.key || book.id} 
                        className="flex flex-col items-center justify-center p-4 text-center transition-all hover:shadow-lg hover:-translate-y-1 cursor-pointer"
                        onClick={() => setSelectedBook(book.key || book.id)}
                    >
                        {book.icon}
                        <p className="text-sm font-semibold text-foreground">{book.name}</p>
                    </Card>
                ))}
            </div>
        );
    };
    
    const renderSegmentList = () => {
        if (!selectedBook) return null;
        const segments = BIBLE_SEGMENTS_OT[selectedBook] || BIBLE_SEGMENTS_NT[selectedBook];
        if (!segments || segments.length === 0) return <p className="text-center py-10 text-muted-foreground">본문 데이터가 준비 중입니다.</p>;

        return (
            <div>
                <div className="flex items-center mb-6">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedBook(null)} className="mr-4">
                        <ArrowLeft />
                    </Button>
                    <h2 className="text-2xl font-bold">{BIBLE_BOOK_KEYS[selectedBook]}</h2>
                </div>
                <div className="space-y-2">
                    {segments.map(segment => {
                        const isMeditated = activeSegmentIds.has(segment.id);
                        return (
                            <Card key={segment.id} className={cn("p-4 flex items-center justify-between hover:bg-muted/50 cursor-pointer", isMeditated && "border-primary/30 bg-primary/5")} onClick={() => handleSelectSegment(segment)}>
                               <div className="flex items-center gap-3">
                                   <div className="flex flex-col">
                                       <div className="flex items-center gap-2">
                                            <p className="font-semibold text-primary">{segment.range}</p>
                                            {isMeditated && (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <CheckCircle2 className="h-4 w-4 text-primary" />
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>이미 공유된 묵상 자료가 있습니다.</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )}
                                       </div>
                                       <p className="text-muted-foreground">{segment.title}</p>
                                   </div>
                               </div>
                               <div className="flex items-center gap-2">
                                   {isMeditated && <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">공유됨</Badge>}
                                   <ChevronRight className="text-muted-foreground"/>
                               </div>
                            </Card>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderContent = () => {
        if (selectedBook) {
            return renderSegmentList();
        }

        switch (activeCategory) {
            case 'book':
                return (
                    <Tabs defaultValue="old-testament">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">성경 선택</h2>
                            <TabsList className="grid w-auto grid-cols-2 bg-muted/60">
                                <TabsTrigger value="old-testament" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-md">구약</TabsTrigger>
                                <TabsTrigger value="new-testament" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-md">신약</TabsTrigger>
                            </TabsList>
                        </div>
                        <TabsContent value="old-testament">
                            {renderBookList(oldTestamentBooks)}
                        </TabsContent>
                        <TabsContent value="new-testament">
                             {renderBookList(newTestamentBooks)}
                        </TabsContent>
                    </Tabs>
                );
            case 'community':
                 return (
                    <div>
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-6">교회 및 단체</h2>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                            <Card className="flex flex-col items-center justify-center p-4 text-center transition-all hover:shadow-lg hover:-translate-y-1 cursor-pointer">
                                <IconWrapper><Users /></IconWrapper>
                                <p className="text-sm font-semibold text-foreground">에덴정원교회</p>
                            </Card>
                        </div>
                    </div>
                );
            case 'season':
            case 'theme':
                return (
                    <Card className="flex items-center justify-center h-96">
                        <div className="text-center">
                            <h3 className="text-lg font-semibold text-muted-foreground">콘텐츠 준비 중입니다.</h3>
                            <p className="text-sm text-muted-foreground/70">곧 멋진 내용으로 찾아뵙겠습니다!</p>
                        </div>
                    </Card>
                );
            default:
                return null;
        }
    };

    return (
        <div className="h-screen w-screen grid grid-cols-1 md:grid-cols-[200px_1fr] bg-muted/20 font-sans overflow-hidden">
            <aside className="bg-background p-6 flex flex-col border-r h-full overflow-y-auto">
                <div className="space-y-2 mb-8">
                    <Button variant="ghost" size="icon" className="rounded-full h-10 w-10" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-2xl font-bold text-foreground">시리즈 인덱스</h1>
                    <p className="text-sm text-muted-foreground">영적 성장의 깊이를 더하는 말씀 여정</p>
                </div>
                
                <nav className="space-y-2 flex-1">
                    {categories.map(cat => (
                        <Button
                            key={cat.id}
                            variant={activeCategory === cat.id ? 'default' : 'ghost'}
                            className={cn(
                                "w-full justify-start text-base h-14 px-4",
                                activeCategory !== cat.id && "text-muted-foreground"
                            )}
                            onClick={() => {
                                setSelectedBook(null);
                                setActiveCategory(cat.id);
                            }}
                        >
                            <cat.icon className="mr-4 h-5 w-5" />
                            {cat.name}
                        </Button>
                    ))}
                </nav>

                <div className="mt-auto bg-muted/50 p-4 rounded-lg">
                    <h4 className="font-semibold text-foreground">공동체 가이드 안내</h4>
                    <p className="text-sm text-muted-foreground mt-1">이미 묵상 자료가 생성된 본문은 공유 뱃지가 표시됩니다.</p>
                </div>
            </aside>
            
            <main className="flex flex-col h-full overflow-hidden">
                <div className="p-8 pb-0">
                    <div className="relative mb-6">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input 
                            placeholder="성경 책 이름 검색..." 
                            className="pl-10 h-12 bg-white"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <ScrollArea className="flex-1 px-8 pb-8">
                    {renderContent()}
                </ScrollArea>
            </main>
        </div>
    );
}
