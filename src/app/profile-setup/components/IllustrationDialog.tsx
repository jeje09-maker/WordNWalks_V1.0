
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ImageIcon, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { UserProfile } from '@/lib/types';
import { placeholderImages } from '@/app/lib/placeholder-images.json';

interface IllustrationDialogProps {
    onClose: () => void;
    onSelect: (imageUrl: string) => void;
    userProfile: Partial<UserProfile>;
    onUploadClick?: () => void;
}

export default function IllustrationDialog({ onClose, onSelect, userProfile, onUploadClick }: IllustrationDialogProps) {
    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 overflow-hidden bg-slate-50 border-none shadow-2xl rounded-[32px]">
                <DialogHeader className="sr-only">
                    <DialogTitle>사진 선택</DialogTitle>
                    <DialogDescription>원하시는 사진을 클릭하면 바로 선택됩니다.</DialogDescription>
                </DialogHeader>

                <div className="p-8 pb-6 bg-white border-b shrink-0 flex flex-row items-center justify-between space-y-0">
                    <div>
                        <div className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                            <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                                <ImageIcon className="h-6 w-6" />
                            </div>
                            사진 선택
                        </div>
                        <p className="text-slate-500 mt-1 font-medium">원하시는 사진을 클릭하면 바로 선택됩니다.</p>
                    </div>
                    <Button variant="ghost" onClick={onClose} className="rounded-full h-12 w-12 p-0 hover:bg-slate-100">
                        <X className="h-6 w-6 text-slate-400" />
                    </Button>
                </div>
                
                <div className="flex-1 min-h-0 overflow-hidden relative">
                    <ScrollArea className="h-full px-8 py-6">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-10">
                            {placeholderImages.map((image) => (
                                <button 
                                    key={image.id} 
                                    onClick={() => onSelect(image.imageUrl)} 
                                    className="aspect-square relative rounded-2xl overflow-hidden bg-white border-2 border-transparent hover:border-primary/40 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
                                >
                                    <img 
                                        src={image.imageUrl} 
                                        alt={image.description} 
                                        className="object-cover w-full h-full transition-transform group-hover:scale-110 duration-500"
                                        loading="lazy"
                                        data-ai-hint={image.imageHint}
                                    />
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <div className="h-10 w-10 bg-white/90 rounded-full flex items-center justify-center text-primary shadow-lg scale-75 group-hover:scale-100 transition-transform duration-300">
                                            <Plus className="h-6 w-6" />
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
                
                <div className="p-6 bg-white border-t shrink-0 flex justify-between items-center">
                    <p className="text-sm text-slate-400 font-medium">총 {placeholderImages.length}개의 사진이 준비되어 있습니다.</p>
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" onClick={onClose} className="rounded-2xl h-11 px-6 font-bold text-slate-500 hover:bg-slate-100">닫기</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
