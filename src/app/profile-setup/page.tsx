
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { UserProfile, VisionItem } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import ImageCropperDialog from './components/ImageCropperDialog';
import IllustrationDialog from './components/IllustrationDialog';
import CameraCaptureDialog from './components/CameraCaptureDialog';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Save, LoaderCircle, Upload, Image as ImageIcon, Camera, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';

export default function ProfileSetupPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const { t } = useTranslation();

    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);
    
    const [profileData, setProfileData] = useState<Partial<UserProfile>>({});
    const [longTermVision, setLongTermVision] = useState<VisionItem[]>([]);
    const [newVisionContent, setNewVisionContent] = useState('');
    const [newVisionTerm, setNewVisionTerm] = useState<'short' | 'mid' | 'long'>('short');
    const [isSaving, setIsSaving] = useState(false);
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showIllustrations, setShowIllustrations] = useState(false);
    const [showCamera, setShowCamera] = useState(false);

    useEffect(() => {
        if (userProfile) {
            setProfileData({
                ...userProfile,
                profilePictureUrl: userProfile.profilePictureUrl || `https://picsum.photos/seed/${userProfile.id}/200/200`,
            });
            // Handle legacy data (string[])
            if (userProfile.longTermVision && Array.isArray(userProfile.longTermVision)) {
                const normalized = (userProfile.longTermVision as any[]).map((v, i) => {
                    if (typeof v === 'string') {
                        return { id: `legacy-${i}`, term: 'short' as const, content: v };
                    }
                    return v as VisionItem;
                });
                setLongTermVision(normalized);
            } else {
                setLongTermVision([]);
            }
        }
    }, [userProfile]);

    // Auto-resize for textareas (No Scroll Logic)
    useEffect(() => {
        const textareas = document.querySelectorAll('textarea');
        textareas.forEach(ta => {
            ta.style.height = 'auto';
            ta.style.height = `${ta.scrollHeight}px`;
        });
    }, [profileData.calling, profileData.mission, isProfileLoading]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                setImageToCrop(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleCropComplete = (croppedImageUrl: string) => {
        setProfileData(prev => ({...prev, profilePictureUrl: croppedImageUrl}));
        setImageToCrop(null);
    };

    const handleCaptureComplete = (imageDataUrl: string) => {
        setImageToCrop(imageDataUrl);
        setShowCamera(false);
    };
    
    const handleIllustrationSelect = (imageUrl: string) => {
        setProfileData(prev => ({...prev, profilePictureUrl: imageUrl}));
        setShowIllustrations(false);
    };

    const handleAddVision = () => {
        if (newVisionContent.trim()) {
            const newItem: VisionItem = {
                id: Date.now().toString(),
                term: newVisionTerm,
                content: newVisionContent.trim(),
            };
            setLongTermVision(prev => [...prev, newItem]);
            setNewVisionContent('');
        }
    };

    const handleRemoveVision = (id: string) => {
        setLongTermVision(prev => prev.filter(v => v.id !== id));
    };

    const handleSaveProfile = async () => {
        if (!userDocRef || !profileData.realName || !profileData.nickname) return;
        setIsSaving(true);
        
        const finalDisplayName = profileData.useNicknameAsDisplay ? profileData.nickname : profileData.realName;
        
        const finalProfileData = {
            ...profileData,
            displayName: finalDisplayName,
            longTermVision,
            updatedAt: serverTimestamp()
        };

        try {
            await setDoc(userDocRef, finalProfileData, { merge: true });
            toast({
                title: t('profile_save_success'),
                description: t('profile_save_success_desc'),
            });
            router.push('/journal');
        } catch (error) {
            console.error("Error saving profile:", error);
            toast({
                variant: "destructive",
                title: "Save Failed",
                description: "There was an error saving your profile. Please try again.",
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (isProfileLoading || !profileData.id) {
        return <LoadingSpinner fullScreen />;
    }

    const termColors = {
        short: "bg-blue-100 text-blue-700 border-blue-200",
        mid: "bg-emerald-100 text-emerald-700 border-emerald-200",
        long: "bg-purple-100 text-purple-700 border-purple-200"
    };

    return (
        <main className="min-h-screen bg-background flex items-center justify-center p-4">
            <Card className="w-full max-w-3xl shadow-xl my-8">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-3xl">{t('profile_title')}</CardTitle>
                        <Button variant="ghost" size="icon" onClick={() => router.back()}>
                            <ArrowLeft className="h-6 w-6" />
                        </Button>
                    </div>
                    <CardDescription>{t('profile_desc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    {/* Avatar Selection */}
                    <div className="space-y-4">
                        <Label className="text-lg font-semibold">{t('profile_picture')}</Label>
                        <div className="flex flex-col items-center gap-6">
                            <Avatar className="h-40 w-40 border-4 border-primary shadow-lg">
                                <AvatarImage src={profileData.profilePictureUrl} alt={profileData.displayName} />
                                <AvatarFallback>{profileData.displayName?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex items-center gap-4">
                               <Button variant="outline" className="flex-1" onClick={() => setShowIllustrations(true)}>
                                   <ImageIcon className="mr-2 h-4 w-4" />
                                   {t('profile_illustrations')}
                               </Button>
                               <Button variant="outline" className="flex-1" onClick={() => fileInputRef.current?.click()}>
                                   <Upload className="mr-2 h-4 w-4" />
                                   {t('profile_upload')}
                               </Button>
                               <Button variant="outline" className="flex-1" onClick={() => setShowCamera(true)}>
                                   <Camera className="mr-2 h-4 w-4" />
                                   {t('profile_camera')}
                               </Button>
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileChange}
                            />
                        </div>
                    </div>
                    
                    {/* Name Settings */}
                    <Card>
                        <CardHeader><CardTitle>{t('profile_basic_info')}</CardTitle></CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>{t('profile_real_name')}</Label>
                                    <Input value={profileData.realName || ''} onChange={e => setProfileData(p => ({...p, realName: e.target.value}))} />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('profile_nickname')}</Label>
                                    <Input value={profileData.nickname || ''} onChange={e => setProfileData(p => ({...p, nickname: e.target.value}))} />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label>{t('profile_display_name_choice')}</Label>
                                <RadioGroup 
                                    onValueChange={(val) => setProfileData(p => ({...p, useNicknameAsDisplay: val === "true"}))} 
                                    value={profileData.useNicknameAsDisplay ? "true" : "false"} 
                                    className="flex gap-4"
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="false" id="edit-r1" />
                                        <Label htmlFor="edit-r1">{t('profile_real_name')}</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="true" id="edit-r2" />
                                        <Label htmlFor="edit-r2">{t('profile_nickname')}</Label>
                                    </div>
                                </RadioGroup>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Advanced Settings */}
                    <div className="space-y-6">
                        {/* Calling */}
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('profile_calling_mission')}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>{t('profile_calling')}</Label>
                                    <Textarea 
                                        value={profileData.calling || ''} 
                                        onChange={e => setProfileData(p => ({...p, calling: e.target.value}))} 
                                        placeholder={t('profile_calling_placeholder')}
                                        rows={1}
                                        className="h-auto min-h-[80px] resize-none overflow-hidden leading-relaxed"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('profile_mission')}</Label>
                                    <Textarea 
                                        value={profileData.mission || ''} 
                                        onChange={e => setProfileData(p => ({...p, mission: e.target.value}))} 
                                        placeholder={t('profile_mission_placeholder')}
                                        rows={1}
                                        className="h-auto min-h-[80px] resize-none overflow-hidden leading-relaxed"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Long-term Vision */}
                        <Card>
                            <CardHeader><CardTitle>{t('profile_5year_vision')}</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex gap-2">
                                    <div className="shrink-0 w-28">
                                        <Select value={newVisionTerm} onValueChange={(v: any) => setNewVisionTerm(v)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="short">{t('profile_term_short')}</SelectItem>
                                                <SelectItem value="mid">{t('profile_term_mid')}</SelectItem>
                                                <SelectItem value="long">{t('profile_term_long')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Input value={newVisionContent} onChange={e => setNewVisionContent(e.target.value)} placeholder={t('profile_add_goal_placeholder')} onKeyDown={e => e.key === 'Enter' && handleAddVision()} className="flex-1" />
                                    <Button onClick={handleAddVision}><Plus className="h-4 w-4 mr-2" /> {t('profile_add_goal')}</Button>
                                </div>
                                <ul className="space-y-3">
                                    {longTermVision.map((vision) => (
                                        <li key={vision.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border">
                                            <Badge variant="outline" className={cn("shrink-0 h-6", termColors[vision.term])}>
                                                {t(`profile_term_${vision.term}` as any)}
                                            </Badge>
                                            <p className="flex-1 text-sm leading-relaxed">{vision.content}</p>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => handleRemoveVision(vision.id)}><Trash2 className="h-4 w-4" /></Button>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    </div>

                    <Button className="w-full h-12 text-lg" onClick={handleSaveProfile} disabled={isSaving}>
                        {isSaving ? <LoaderCircle className="h-6 w-6 animate-spin" /> : <Save className="h-5 w-5 mr-2" />}
                        {t('profile_save_changes')}
                    </Button>

                    {process.env.NODE_ENV === 'development' && (
                        <div className="pt-4 border-t border-dashed">
                            <Button 
                                type="button"
                                variant="outline" 
                                className="w-full border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700 h-11" 
                                onClick={async () => {
                                    if (!userDocRef) return;
                                    try {
                                        await setDoc(userDocRef, { isAdmin: true, isGroupAdmin: true }, { merge: true });
                                        toast({ title: "관리자 권한 부여 완료", description: "로컬 개발용 Super Admin 권한이 Firestore에 등록되었습니다. 새로고침 후 대시보드를 확인하세요." });
                                    } catch (e: any) {
                                        toast({ title: "권한 획득 실패", description: e.message || "오류가 발생했습니다.", variant: "destructive" });
                                    }
                                }}
                            >
                                ⚡ [개발용] 관리자 권한 획득 (Set Admin: true)
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
            
            {showIllustrations && userProfile && (
                <IllustrationDialog
                    onClose={() => setShowIllustrations(false)}
                    onSelect={handleIllustrationSelect}
                    userProfile={userProfile}
                    onUploadClick={() => {
                        setShowIllustrations(false);
                        fileInputRef.current?.click();
                    }}
                />
            )}

            {showCamera && (
                <CameraCaptureDialog 
                    onClose={() => setShowCamera(false)}
                    onCapture={handleCaptureComplete}
                />
            )}

            {imageToCrop && (
                <ImageCropperDialog 
                    image={imageToCrop}
                    onClose={() => setImageToCrop(null)}
                    onCropComplete={handleCropComplete}
                />
            )}
        </main>
    );
}
