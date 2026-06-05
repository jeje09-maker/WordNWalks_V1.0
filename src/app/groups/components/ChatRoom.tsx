
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, limit, where, doc, getDocs, deleteDoc } from 'firebase/firestore';
import type { ChatMessage } from '@/lib/types';
import { 
    X, Send, Paperclip, ImageIcon, LoaderCircle, Download, 
    FileText, FileArchive, PlayCircle, MessageCircle, Sparkles, Trash2, Eraser
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxDim = 1200;
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height *= maxDim / width;
                        width = maxDim;
                    } else {
                        width *= maxDim / height;
                        height = maxDim;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
};

const MessageItem = ({ msg, isMine, isAdmin, onDelete }: { msg: ChatMessage, isMine: boolean, isAdmin: boolean, onDelete: () => void }) => {
    const youtubeId = msg.type === 'youtube' ? getYouTubeId(msg.text) : null;

    return (
        <div className={cn("flex items-start gap-2 mb-4 group/msg", isMine && "flex-row-reverse")}>
            {!isMine && (
                <Avatar className="h-8 w-8 border shrink-0">
                    <AvatarImage src={msg.senderAvatar}/>
                    <AvatarFallback>{msg.senderName?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
            )}
            <div className={cn("flex flex-col max-w-[70%]", isMine && "items-end")}>
                <div className={cn("flex items-center gap-2 mb-1 px-1", isMine && "flex-row-reverse")}>
                    {!isMine && <span className="text-[10px] font-bold text-muted-foreground">{msg.senderName}</span>}
                    {(isMine || isAdmin) && (
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                            className="opacity-0 group-hover/msg:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-0.5"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                
                <div className={cn(
                    "p-3 rounded-[10px] shadow-sm relative",
                    isMine ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-white border-[0.5px] border-slate-200 rounded-tl-none text-slate-800"
                )}>
                    {msg.type === 'text' && <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>}
                    
                    {msg.type === 'image' && msg.fileUrl && (
                        <div className="space-y-2 h-auto">
                            <img 
                                src={msg.fileUrl} 
                                alt="shared" 
                                className="max-w-full rounded-[10px] h-auto border-[0.5px] border-slate-200/40 bg-slate-50"
                            />
                            {msg.text && <p className="text-xs opacity-90">{msg.text}</p>}
                        </div>
                    )}

                    {msg.type === 'file' && (
                        <div className="flex items-center gap-3 p-2 bg-black/5 rounded-lg border-[0.5px] border-black/10">
                            {msg.fileType?.includes('zip') ? <FileArchive className="h-8 w-8"/> : <FileText className="h-8 w-8"/>}
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold truncate">{msg.fileName}</p>
                                <p className="text-[9px] opacity-70 uppercase">{msg.fileType?.split('/')[1] || 'FILE'}</p>
                            </div>
                            <a href={msg.fileUrl} download={msg.fileName} target="_blank" rel="noreferrer" className="shrink-0 h-8 w-8 flex items-center justify-center hover:bg-black/10 rounded-full transition-colors">
                                <Download className="h-4 w-4"/>
                            </a>
                        </div>
                    )}

                    {msg.type === 'youtube' && youtubeId && (
                        <div className="space-y-3 min-w-[240px] h-auto">
                            <div className="aspect-video rounded-lg overflow-hidden border-[0.5px] border-black/5 bg-black shadow-inner">
                                <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${youtubeId}`} frameBorder="0" allowFullScreen />
                            </div>
                            <p className="text-xs italic underline flex items-center gap-1">
                                <PlayCircle className="h-3 w-3"/> YouTube Link
                            </p>
                            <p className="text-sm">{msg.text}</p>
                        </div>
                    )}
                </div>
                
                <span className="text-[9px] text-muted-foreground mt-1 px-1">
                    {msg.createdAt?.toDate ? format(msg.createdAt.toDate(), 'HH:mm') : '...'}
                </span>
            </div>
        </div>
    );
};

export function SmallGroupChat({ orgId, groupId, onClose }: { orgId: string; groupId: string; onClose: () => void }) {
    const { user, profile } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [inputText, setInputText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isSuperAdmin = useMemo(() => 
        user?.email === 'darak303@naver.com' || 
        user?.uid === 'aRCEGOfj0lgkOES0KLywQwbsjLX2' || 
        user?.uid === '4PYWOqRk1dXhVt5NXe5DZq7Fa4Q2' ||
        profile?.isAdmin === true, 
    [user, profile]);

    const isOrgAdmin = useMemo(() => {
        if (!user || !profile) return false;
        if (isSuperAdmin) return true;
        const hasAdminRole = profile.memberships?.some(m => m.organizationId === orgId && m.role === 'admin');
        const hasGroupAdminFlag = profile.isGroupAdmin && profile.membershipIds?.includes(orgId);
        return hasAdminRole || hasGroupAdminFlag;
    }, [profile, user, orgId, isSuperAdmin]);

    const thirtyDaysAgo = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d;
    }, []);

    const messagesQuery = useMemoFirebase(() => 
        query(
            collection(firestore, 'organizations', orgId, 'smallGroups', groupId, 'messages'),
            where('createdAt', '>=', thirtyDaysAgo),
            orderBy('createdAt', 'asc'),
            limit(100)
        ),
        [firestore, orgId, groupId, thirtyDaysAgo]
    );
    const { data: messages } = useCollection<ChatMessage>(messagesQuery);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = async (type: ChatMessage['type'] = 'text', fileData?: any) => {
        if (!user || !profile || (!inputText.trim() && !fileData)) return;
        
        let finalType = type;
        if (type === 'text' && getYouTubeId(inputText)) {
            finalType = 'youtube';
        }

        const now = new Date();
        const expiresAt = addDays(now, 30);

        const newMessage: Omit<ChatMessage, 'id'> = {
            senderId: user.uid,
            senderName: profile.displayName,
            senderAvatar: profile.profilePictureUrl || '',
            text: inputText.trim(),
            type: finalType,
            createdAt: serverTimestamp(),
            expiresAt: expiresAt,
            ...fileData
        };

        try {
            await addDocumentNonBlocking(collection(firestore, 'organizations', orgId, 'smallGroups', groupId, 'messages'), newMessage);
            setInputText('');
        } catch (e) {
            toast({ title: "메시지 전송 실패", variant: "destructive" });
        }
    };

    const handleDeleteMessage = async (messageId: string) => {
        if (!firestore || !orgId || !groupId) return;
        
        try {
            const msgRef = doc(firestore, 'organizations', orgId, 'smallGroups', groupId, 'messages', messageId);
            await deleteDoc(msgRef);
            toast({ title: "메시지가 삭제되었습니다." });
        } catch (error) {
            console.error("삭제 오류:", error);
            toast({ title: "삭제 실패", description: "권한이 없거나 오류가 발생했습니다.", variant: "destructive" });
        }
    };

    const handleClearAllMessages = async () => {
        if (!isSuperAdmin) return;
        
        setIsSubmitting(true);
        try {
            const msgsRef = collection(firestore, 'organizations', orgId, 'smallGroups', groupId, 'messages');
            const snapshot = await getDocs(msgsRef);
            const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
            await Promise.all(deletePromises);
            toast({ title: "채팅방이 성공적으로 초기화되었습니다." });
        } catch (e) {
            toast({ title: "초기화 실패", description: "권한이 없거나 오류가 발생했습니다.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > MAX_FILE_SIZE) {
            toast({ title: "파일 크기 제한 (10MB)", description: "10MB 이하의 파일만 업로드 가능합니다.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            if (file.type.startsWith('image/')) {
                const compressedBase64 = await compressImage(file);
                await handleSendMessage('image', { 
                    fileUrl: compressedBase64, 
                    fileName: file.name,
                    fileType: file.type 
                });
            } else {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    await handleSendMessage('file', {
                        fileUrl: event.target?.result as string,
                        fileName: file.name,
                        fileType: file.type
                    });
                };
                reader.readAsDataURL(file);
            }
            toast({ title: "파일이 전송되었습니다." });
        } catch (error) {
            toast({ title: "업로드 실패", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <Card className="w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 rounded-[10px]">
                <header className="p-4 border-b flex items-center justify-between bg-primary text-primary-foreground">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-white/20 rounded-full flex items-center justify-center text-primary">
                            <MessageCircle className="h-6 w-6"/>
                        </div>
                        <div>
                            <h2 className="font-bold">소그룹 채팅방</h2>
                            <p className="text-[10px] opacity-80">파일/사진은 30일 후 자동 삭제됩니다.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {isSuperAdmin && (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="hover:bg-red-500/20 text-white" 
                                onClick={handleClearAllMessages}
                                disabled={isSubmitting}
                                title="전체 삭제 (초기화)"
                            >
                                <Eraser className="h-5 w-5"/>
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" className="hover:bg-white/10 text-white" onClick={onClose}><X/></Button>
                    </div>
                </header>

                <ScrollArea className="flex-1 bg-slate-50 p-6" ref={scrollRef}>
                    {messages && messages.length > 0 ? (
                        messages.map(msg => (
                            <MessageItem 
                                key={msg.id} 
                                msg={msg} 
                                isMine={msg.senderId === user?.uid} 
                                isAdmin={isOrgAdmin}
                                onDelete={() => handleDeleteMessage(msg.id)}
                            />
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full py-20 text-muted-foreground opacity-40">
                            <Sparkles className="h-12 w-12 mb-2"/>
                            <p className="text-sm">소그룹 지체들과 은혜를 나눠보세요.</p>
                        </div>
                    )}
                </ScrollArea>

                <footer className="p-4 border-t bg-white">
                    <div className="flex items-end gap-2">
                        <div className="flex flex-col gap-1">
                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                            <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 text-primary" disabled={isSubmitting} onClick={() => fileInputRef.current?.click()}>
                                {isSubmitting ? <LoaderCircle className="h-5 w-5 animate-spin"/> : <Paperclip className="h-5 w-5"/>}
                            </Button>
                        </div>
                        
                        <div className="flex-1 relative">
                            <Input 
                                value={inputText} 
                                onChange={e => setInputText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                                placeholder="메시지를 입력하거나 유튜브 링크를 붙여넣으세요..."
                                className="pr-12 min-h-[44px] rounded-[10px] bg-slate-100 border-none focus-visible:ring-primary"
                            />
                            <Button 
                                size="icon" 
                                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full h-8 w-8"
                                disabled={!inputText.trim() || isSubmitting}
                                onClick={() => handleSendMessage()}
                            >
                                <Send className="h-4 w-4"/>
                            </Button>
                        </div>
                    </div>
                </footer>
            </Card>
        </div>
    );
}
