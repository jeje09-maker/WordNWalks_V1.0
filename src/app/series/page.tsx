
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
    ShieldCheck, Building, Droplets, Target, ChevronDown, ChevronUp
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

const SUFFERING_THEME = {
  id: 'suffering',
  title: '고난을 견디는 믿음',
  description: '환난과 시련 속에서 하나님을 신뢰하고 소망을 품게 하는 50일간의 말씀 여정',
  subThemes: [
    {
      id: 1,
      title: '1. 환난 가운데 하나님을 신뢰하라',
      passages: [
        { id: 'theme_suffering_1', passage: '시편 46:1-11', description: '환난 중에 만날 큰 도움이 되시는 하나님.' },
        { id: 'theme_suffering_2', passage: '이사야 41:8-13', description: '두려워하지 말라 내가 너를 붙들리라.' },
        { id: 'theme_suffering_3', passage: '이사야 43:1-7', description: '물과 불 가운데서도 함께하시는 하나님.' },
        { id: 'theme_suffering_4', passage: '신명기 31:6-8', description: '너를 버리지 아니하시고 떠나지 아니하신다.' },
        { id: 'theme_suffering_5', passage: '여호수아 1:1-9', description: '강하고 담대하라.' }
      ]
    },
    {
      id: 2,
      title: '2. 낙심과 절망을 이길 때',
      passages: [
        { id: 'theme_suffering_6', passage: '시편 42:5-11', description: '낙심하는 영혼에게 스스로 복음을 전하라.' },
        { id: 'theme_suffering_7', passage: '시편 34:15-22', description: '상한 마음을 가까이하시는 하나님.' },
        { id: 'theme_suffering_8', passage: '예레미야애가 3:19-33', description: '고난 중에도 끊어지지 않는 주의 사랑.' },
        { id: 'theme_suffering_9', passage: '시편 27:1-14', description: '기다리는 자에게 주시는 담대함.' },
        { id: 'theme_suffering_10', passage: '이사야 40:27-31', description: '독수리처럼 새 힘을 얻는 자.' }
      ]
    },
    {
      id: 3,
      title: '3. 죄와 실패로 인한 고통을 만날 때',
      passages: [
        { id: 'theme_suffering_11', passage: '시편 32:1-11', description: '죄를 자복하는 자의 복.' },
        { id: 'theme_suffering_12', passage: '시편 51:1-12', description: '회개하는 다윗의 기도.' },
        { id: 'theme_suffering_13', passage: '요한일서 1:5-10', description: '죄를 자백하면 깨끗하게 하신다.' },
        { id: 'theme_suffering_14', passage: '이사야 55:6-13', description: '악인은 길을 버리고 여호와께 돌아오라.' },
        { id: 'theme_suffering_15', passage: '미가 7:7-20', description: '넘어졌을지라도 다시 일어나는 믿음.' }
      ]
    },
    {
      id: 4,
      title: '4. 시험과 유혹을 이길 때',
      passages: [
        { id: 'theme_suffering_16', passage: '야고보서 1:2-12', description: '시험을 기쁘게 여기라.' },
        { id: 'theme_suffering_17', passage: '에베소서 6:10-18', description: '하나님의 전신갑주.' },
        { id: 'theme_suffering_18', passage: '마태복음 4:1-11', description: '예수님의 광야 시험.' },
        { id: 'theme_suffering_19', passage: '베드로전서 5:6-11', description: '마귀를 대적하라.' },
        { id: 'theme_suffering_20', passage: '히브리서 2:14-18', description: '시험받는 자를 능히 도우시는 주님.' }
      ]
    },
    {
      id: 5,
      title: '5. 고난의 의미를 깨닫게 하는 말씀',
      passages: [
        { id: 'theme_suffering_21', passage: '로마서 5:1-11', description: '환난은 인내를 이루고.' },
        { id: 'theme_suffering_22', passage: '야고보서 1:2-18', description: '연단을 통해 성숙하게 하시는 하나님.' },
        { id: 'theme_suffering_23', passage: '베드로전서 1:3-9', description: '불로 연단한 금보다 귀한 믿음.' },
        { id: 'theme_suffering_24', passage: '히브리서 12:1-13', description: '징계와 연단의 유익.' },
        { id: 'theme_suffering_25', passage: '고린도후서 4:7-18', description: '겉사람은 후패하나 속사람은 새로워진다.' }
      ]
    },
    {
      id: 6,
      title: '6. 끝까지 견디게 하는 말씀',
      passages: [
        { id: 'theme_suffering_26', passage: '로마서 8:18-39', description: '고난보다 큰 하나님의 사랑.' },
        { id: 'theme_suffering_27', passage: '히브리서 10:32-39', description: '뒤로 물러가지 말라.' },
        { id: 'theme_suffering_28', passage: '히브리서 12:1-3', description: '인내로 경주를 완주하라.' },
        { id: 'theme_suffering_29', passage: '갈라디아서 6:7-10', description: '때가 이르면 거두리라.' },
        { id: 'theme_suffering_30', passage: '요한계시록 2:8-11', description: '죽도록 충성하라.' }
      ]
    },
    {
      id: 7,
      title: '7. 염려와 두려움을 이길 때',
      passages: [
        { id: 'theme_suffering_31', passage: '마태복음 6:25-34', description: '무엇을 먹을까 염려하지 말라.' },
        { id: 'theme_suffering_32', passage: '빌립보서 4:4-9', description: '아무 것도 염려하지 말고.' },
        { id: 'theme_suffering_33', passage: '시편 121:1-8', description: '나의 도움은 여호와께로부터.' },
        { id: 'theme_suffering_34', passage: '이사야 26:1-4', description: '심지가 견고한 자를 평강으로 지키신다.' },
        { id: 'theme_suffering_35', passage: '시편 91:1-16', description: '전능자의 그늘 아래 거하는 자.' }
      ]
    },
    {
      id: 8,
      title: '8. 소망으로 고난을 통과하라',
      passages: [
        { id: 'theme_suffering_36', passage: '요한복음 16:16-33', description: '세상에서는 환난을 당하나 담대하라.' },
        { id: 'theme_suffering_37', passage: '베드로전서 5:6-10', description: '잠깐 고난 후에 온전하게 하신다.' },
        { id: 'theme_suffering_38', passage: '로마서 15:4-13', description: '소망의 하나님이 주시는 위로.' },
        { id: 'theme_suffering_39', passage: '요엘 2:21-27', description: '잃어버린 세월을 회복시키시는 하나님.' },
        { id: 'theme_suffering_40', passage: '계시록 21:1-7', description: '다시는 눈물도 고통도 없다.' }
      ]
    },
    {
      id: 9,
      title: '예비 본문 10선',
      passages: [
        { id: 'theme_suffering_41', passage: '시편 73:21-28', description: '하나님은 내 마음의 반석.' },
        { id: 'theme_suffering_42', passage: '하박국 3:16-19', description: '비록 무화과나무가 무성하지 못할지라도.' },
        { id: 'theme_suffering_43', passage: '이사야 30:15-21', description: '잠잠히 신뢰하라.' },
        { id: 'theme_suffering_44', passage: '시편 62:1-12', description: '나의 구원은 하나님께만.' },
        { id: 'theme_suffering_45', passage: '고린도전서 10:1-13', description: '감당할 시험만 허락하신다.' },
        { id: 'theme_suffering_46', passage: '데살로니가전서 5:16-24', description: '항상 기뻐하고 쉬지 말고 기도하라.' },
        { id: 'theme_suffering_47', passage: '시편 40:1-10', description: '웅덩이에서 건지시는 하나님.' },
        { id: 'theme_suffering_48', passage: '마가복음 4:35-41', description: '풍랑 가운데 주무시는 예수님.' },
        { id: 'theme_suffering_49', passage: '열왕기상 19:1-18', description: '로뎀나무 아래 엘리야.' },
        { id: 'theme_suffering_50', passage: '창세기 50:15-21', description: '악을 선으로 바꾸시는 하나님.' }
      ]
    }
  ]
};

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
    const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
    const [expandedSubTheme, setExpandedSubTheme] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const segmentsQuery = useMemoFirebase(() => 
        query(collection(firestore, 'bibleSegments'), where('language', '==', lang)), 
        [firestore, lang]
    );
    const { data: globalSegments } = useCollection<GlobalBibleSegment>(segmentsQuery);

    const activeSegmentIds = useMemo(() => {
        return new Set(globalSegments?.map(s => s.id.replace(`${lang}_`, '')) || []);
    }, [globalSegments, lang]);

    const searchPlaceholder = useMemo(() => {
        switch (activeCategory) {
            case 'book': return '성경 책 이름 검색...';
            case 'theme': return '주제 또는 본문 검색...';
            default: return '검색...';
        }
    }, [activeCategory]);

    const themeProgress = useMemo(() => {
        if (!globalSegments) return { completedCount: 0, total: 50, percent: 0 };
        let completedCount = 0;
        SUFFERING_THEME.subThemes.forEach(sub => {
            sub.passages.forEach(p => {
                if (activeSegmentIds.has(p.id)) {
                    completedCount++;
                }
            });
        });
        return {
            completedCount,
            total: 50,
            percent: Math.round((completedCount / 50) * 100)
        };
    }, [activeSegmentIds, globalSegments]);

    const getSubThemeProgress = (subThemeId: number) => {
        const sub = SUFFERING_THEME.subThemes.find(s => s.id === subThemeId);
        if (!sub) return { completed: 0, total: 0, percent: 0 };
        let completed = 0;
        sub.passages.forEach(p => {
            if (activeSegmentIds.has(p.id)) {
                completed++;
            }
        });
        return {
            completed,
            total: sub.passages.length,
            percent: Math.round((completed / sub.passages.length) * 100)
        };
    };

    const handleSelectThemeSegment = (passage: string, segmentId: string) => {
      const params = new URLSearchParams();
      if (date) {
        params.append('date', date);
      }
      params.append('passage', passage);
      params.append('segmentId', segmentId);
      router.push(`/journal?${params.toString()}`);
    };

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

    const renderThemeList = () => {
        const filteredThemes = [SUFFERING_THEME].filter(theme => 
            theme.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
            theme.description.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (filteredThemes.length === 0 && searchTerm) {
            return <p className="text-muted-foreground text-center col-span-full py-10">검색 결과가 없습니다.</p>;
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredThemes.map((theme) => (
                    <Card 
                        key={theme.id} 
                        className="flex flex-col p-6 transition-all hover:shadow-lg hover:-translate-y-1 cursor-pointer bg-card border border-muted"
                        onClick={() => setSelectedTheme(theme.id)}
                    >
                        <div className="flex items-start gap-4 mb-4">
                            <div className="p-3 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
                                <ShieldCheck className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-foreground mb-1">{theme.title}</h3>
                                <p className="text-sm text-muted-foreground line-clamp-2">{theme.description}</p>
                            </div>
                        </div>
                        
                        <div className="mt-auto pt-4 border-t border-muted/50">
                            <div className="flex justify-between items-center text-xs mb-2">
                                <span className="text-muted-foreground font-medium">전체 진행도</span>
                                <span className="font-semibold text-foreground">{themeProgress.completedCount} / {themeProgress.total} 완료 ({themeProgress.percent}%)</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                <div 
                                    className="bg-orange-500 h-2 rounded-full transition-all duration-500" 
                                    style={{ width: `${themeProgress.percent}%` }}
                                />
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        );
    };

    const renderThemeDetail = () => {
        if (selectedTheme !== 'suffering') return null;

        return (
            <div>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                    <div className="flex items-center">
                        <Button variant="ghost" size="icon" onClick={() => setSelectedTheme(null)} className="mr-4">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 text-xs">주제별 시리즈</Badge>
                                <span className="text-xs text-muted-foreground">50일 코스</span>
                            </div>
                            <h2 className="text-2xl font-bold text-foreground">{SUFFERING_THEME.title}</h2>
                        </div>
                    </div>
                    
                    <div className="flex flex-col justify-end min-w-[200px]">
                        <div className="flex justify-between text-xs font-semibold mb-1">
                            <span className="text-muted-foreground">시리즈 완료도</span>
                            <span className="text-foreground">{themeProgress.completedCount} / {themeProgress.total} ({themeProgress.percent}%)</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                            <div 
                                className="bg-orange-500 h-2 rounded-full transition-all duration-500" 
                                style={{ width: `${themeProgress.percent}%` }}
                            />
                        </div>
                    </div>
                </div>

                <p className="text-muted-foreground mb-8 text-sm md:text-base bg-muted/30 p-4 rounded-xl border border-muted/50">
                    {SUFFERING_THEME.description}
                </p>

                <div className="space-y-4">
                    {SUFFERING_THEME.subThemes.map((sub, idx) => {
                        const isExpanded = expandedSubTheme === sub.id;
                        const subProgress = getSubThemeProgress(sub.id);
                        
                        const filteredPassages = sub.passages.filter(p => 
                            !searchTerm || 
                            p.passage.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            p.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            sub.title.toLowerCase().includes(searchTerm.toLowerCase())
                        );

                        if (filteredPassages.length === 0) return null;

                        const isAutoExpanded = isExpanded || (searchTerm ? true : false);

                        return (
                            <Card key={sub.id} className="border border-muted overflow-hidden">
                                <div 
                                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                                    onClick={() => setExpandedSubTheme(isExpanded ? null : sub.id)}
                                >
                                    <div className="flex-1 pr-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                            <span className="font-semibold text-base text-foreground">{sub.title}</span>
                                            <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full whitespace-nowrap">
                                                진행률 {subProgress.completed} / {subProgress.total}
                                            </span>
                                        </div>
                                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                            <div 
                                                className="bg-orange-500 h-1.5 rounded-full transition-all duration-500" 
                                                style={{ width: `${subProgress.percent}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="text-muted-foreground ml-2">
                                        {isAutoExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                    </div>
                                </div>

                                {isAutoExpanded && (
                                    <div className="p-4 pt-0 border-t border-muted bg-muted/10 space-y-2">
                                        {filteredPassages.map((p) => {
                                            const isMeditated = activeSegmentIds.has(p.id);
                                            const originalPIdx = sub.passages.findIndex(origP => origP.id === p.id);
                                            const seqNum = idx < 8 ? (idx * 5) + originalPIdx + 1 : 40 + originalPIdx + 1;
                                            const displaySeqNum = seqNum < 10 ? `0${seqNum}` : `${seqNum}`;
                                            
                                            return (
                                                <div 
                                                    key={p.id} 
                                                    className={cn(
                                                        "p-3 rounded-lg border flex items-center justify-between hover:bg-muted/50 cursor-pointer transition-all",
                                                        isMeditated ? "border-orange-500/30 bg-orange-500/5" : "border-muted bg-card"
                                                    )}
                                                    onClick={() => handleSelectThemeSegment(p.passage, p.id)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className={cn(
                                                            "text-xs font-mono font-bold px-2 py-1 rounded",
                                                            isMeditated ? "bg-orange-500/20 text-orange-600 dark:text-orange-400" : "bg-muted text-muted-foreground"
                                                        )}>
                                                            {displaySeqNum}
                                                        </span>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-semibold text-foreground text-sm sm:text-base">{p.passage}</p>
                                                                {isMeditated && (
                                                                    <TooltipProvider>
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <CheckCircle2 className="h-4 w-4 text-orange-500" />
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>
                                                                                <p>이미 생성된 묵상 자료가 있습니다.</p>
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    </TooltipProvider>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {isMeditated && (
                                                            <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-600 border-orange-500/20 whitespace-nowrap">
                                                                공유됨
                                                            </Badge>
                                                        )}
                                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
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
        if (activeCategory === 'theme' && selectedTheme) {
            return renderThemeDetail();
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
            case 'theme':
                return renderThemeList();
            case 'season':
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
                                setSelectedTheme(null);
                                setExpandedSubTheme(null);
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
                            placeholder={searchPlaceholder} 
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
