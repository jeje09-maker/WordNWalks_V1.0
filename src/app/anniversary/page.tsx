
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import type { UserProfile, Anniversary } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/LoadingSpinner';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AnniversaryPage() {
    const router = useRouter();
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [newAnniversary, setNewAnniversary] = useState({ title: '', date: '', repeat: false, isLunar: false, notification: 'none' as Anniversary['notification'] });
    
    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
    const { data: userProfile, isLoading } = useDoc<UserProfile>(userDocRef);

    const anniversaries = useMemo(() => {
        return (userProfile?.anniversaries || []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [userProfile]);

    const handleAnniversaryUpdate = async (newAnniversaries: Anniversary[]) => {
        if (!userDocRef) return;
        try {
            await updateDoc(userDocRef, { anniversaries: newAnniversaries });
        } catch (error) {
            console.error("Error updating anniversaries:", error);
            toast({
                title: "Error",
                description: "Failed to update anniversaries.",
                variant: "destructive"
            });
        }
    };
    
    const addAnniversary = async () => {
        if (!newAnniversary.title.trim() || !newAnniversary.date) {
            toast({
                title: "Missing fields",
                description: "Please provide a title and date for the anniversary.",
                variant: "destructive"
            });
            return;
        }

        const newAnniversaryItem: Anniversary = {
            id: Date.now().toString(),
            title: newAnniversary.title.trim(),
            date: newAnniversary.date,
            isLunar: newAnniversary.isLunar,
            repeat: newAnniversary.repeat,
            notification: newAnniversary.notification,
        };
        const currentAnniversaries = userProfile?.anniversaries || [];
        await handleAnniversaryUpdate([...currentAnniversaries, newAnniversaryItem]);
        toast({ title: "기념일이 추가되었습니다." });
        setNewAnniversary({ title: '', date: '', repeat: false, isLunar: false, notification: 'none' });
    };
    
    const deleteAnniversary = async (anniversaryId: string) => {
        const currentAnniversaries = userProfile?.anniversaries || [];
        const newAnniversaries = currentAnniversaries.filter(item => item.id !== anniversaryId);
        await handleAnniversaryUpdate(newAnniversaries);
        toast({ title: "기념일이 삭제되었습니다.", variant: "destructive" });
    };

    if (isLoading) {
        return <LoadingSpinner fullScreen />;
    }

    return (
        <div className="h-screen w-screen flex flex-col bg-muted/20">
            <header className="p-4 border-b flex items-center bg-background z-10 shrink-0">
                <Button variant="ghost" size="icon" className="mr-4" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-2xl font-bold">기념일 관리</h1>
            </header>
            
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 p-6 min-h-0">
                {/* Left Column: Add Form */}
                <div className="md:col-span-1">
                    <Card>
                        <CardHeader>
                            <CardTitle>새 기념일 추가</CardTitle>
                            <CardDescription>중요한 날을 기록하고 D-Day를 확인하세요.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="anniv-title">기념일 제목</Label>
                                <Input id="anniv-title" value={newAnniversary.title} onChange={(e) => setNewAnniversary(p => ({ ...p, title: e.target.value }))} placeholder="예: 결혼기념일" />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="anniv-date">날짜</Label>
                                <Input id="anniv-date" type="date" value={newAnniversary.date} onChange={(e) => setNewAnniversary(p => ({ ...p, date: e.target.value }))} />
                            </div>
                             <div className="space-y-4 pt-2">
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="is-lunar-anniv" checked={newAnniversary.isLunar} onCheckedChange={(checked) => setNewAnniversary(p => ({ ...p, isLunar: !!checked }))} />
                                    <Label htmlFor="is-lunar-anniv" className="text-sm font-medium leading-none cursor-pointer">음력 날짜</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="repeat-anniversary" checked={newAnniversary.repeat} onCheckedChange={(checked) => setNewAnniversary(p => ({ ...p, repeat: !!checked }))} />
                                    <Label htmlFor="repeat-anniversary" className="text-sm font-medium leading-none cursor-pointer">매년 반복</Label>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="anniv-notification">알림 설정</Label>
                                <Select value={newAnniversary.notification} onValueChange={(value) => setNewAnniversary(p => ({ ...p, notification: value as any }))}>
                                    <SelectTrigger id="anniv-notification">
                                        <SelectValue placeholder="알림 설정" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">알림 없음</SelectItem>
                                        <SelectItem value="one_week_before">1주일 전</SelectItem>
                                        <SelectItem value="one_month_before">1달 전</SelectItem>
                                        <SelectItem value="always">항상 표시 (D-Day 지난 후에도)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button onClick={addAnniversary} className="w-full">
                                <Plus className="mr-2 h-4 w-4" /> 기념일 추가
                            </Button>
                        </CardContent>
                    </Card>
                </div>
                
                {/* Right Column: List */}
                <div className="md:col-span-2 min-h-0">
                    <ScrollArea className="h-full pr-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                             {anniversaries.length > 0 ? (
                                anniversaries.map(item => {
                                    const notificationMap = { none: '알림 없음', one_week_before: '1주일 전', one_month_before: '1달 전', always: '항상 표시' };
                                    return (
                                        <Card key={item.id} className="group">
                                            <CardHeader>
                                                <CardTitle className="flex justify-between items-start">
                                                    {item.title}
                                                    <Button onClick={() => deleteAnniversary(item.id)} size="icon" variant="ghost" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 shrink-0">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </CardTitle>
                                                <CardDescription>{item.date} {item.isLunar && <Badge variant="outline" className="ml-2 bg-yellow-50 text-yellow-700 border-yellow-200">음력</Badge>}</CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="flex flex-wrap gap-2">
                                                    {item.repeat && <Badge variant="secondary">매년 반복</Badge>}
                                                    {item.notification && item.notification !== 'none' && <Badge variant="outline">{notificationMap[item.notification]}</Badge>}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )
                                })
                            ) : (
                                <div className="lg:col-span-2 flex items-center justify-center h-64 text-muted-foreground bg-card rounded-lg border border-dashed">
                                    <p>저장된 기념일이 없습니다.</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </div>
    );
}
