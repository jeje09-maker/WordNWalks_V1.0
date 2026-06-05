
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Send, LoaderCircle } from 'lucide-react';
import { getAiCounselAction } from '../actions';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';

interface Message {
    id: string;
    role: 'user' | 'ai';
    text: string;
}

const SimpleRobotIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Simple Upper Body Robot */}
    <path d="M12 8V4m0 0H9m3 0h3" />
    <rect x="7" y="8" width="10" height="8" rx="2" />
    <path d="M9 13h.01M15 13h.01" />
    <path d="M12 16v3m-4 0h8" />
  </svg>
);

export default function AIFloatingChat({ journalContext }: { journalContext?: string }) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    const handleSend = async () => {
        const trimmedInput = input.trim();
        if (!trimmedInput || isLoading) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', text: trimmedInput };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const result = await getAiCounselAction({ 
                message: trimmedInput, 
                journalContext: journalContext || ''
            });
            
            if (result.response) {
                const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'ai', text: result.response };
                setMessages(prev => [...prev, aiMsg]);
            } else if (result.error) {
                const errorMsg: Message = { id: (Date.now() + 1).toString(), role: 'ai', text: "미안해요, 답변을 생성하지 못했어요. 다시 시도해 주시겠어요?" };
                setMessages(prev => [...prev, errorMsg]);
            }
        } catch (error) {
            console.error('AI Chat Error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end">
            {isOpen && (
                <Card className="w-80 sm:w-96 h-[450px] mb-4 shadow-2xl flex flex-col border-primary/20 animate-in slide-in-from-bottom-4 duration-300">
                    <CardHeader className="p-4 border-b bg-primary text-primary-foreground rounded-t-lg flex flex-row items-center justify-between space-y-0">
                        <div className="flex items-center gap-2">
                            <SimpleRobotIcon className="h-6 w-6" />
                            <CardTitle className="text-sm font-bold">묵상도우미</CardTitle>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => setIsOpen(false)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </CardHeader>
                    
                    <ScrollArea className="flex-1 p-4 bg-muted/5" ref={scrollRef}>
                        <div className="space-y-4">
                            {messages.length === 0 && (
                                <div className="text-center py-10">
                                    <SimpleRobotIcon className="h-12 w-12 mx-auto text-muted-foreground/30 mb-2" />
                                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">성경에 대해서 궁금한 점이나 알고 싶은 정보를 물어보세요.</p>
                                </div>
                            )}
                            {messages.map((m) => (
                                <div key={m.id} className={cn("flex", m.role === 'user' ? "justify-end" : "justify-start")}>
                                    <div className={cn(
                                        "max-w-[85%] p-3 rounded-2xl text-sm shadow-sm",
                                        m.role === 'user' ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-white border rounded-tl-none text-slate-800"
                                    )}>
                                        {m.text}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-white border p-3 rounded-2xl rounded-tl-none shadow-sm">
                                        <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    <CardFooter className="p-3 border-t bg-white rounded-b-lg">
                        <div className="flex w-full gap-2">
                            <Input 
                                value={input} 
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                placeholder="질문을 입력하세요..."
                                className="text-xs h-10 border-muted-foreground/20 focus-visible:ring-primary"
                            />
                            <Button size="icon" onClick={handleSend} disabled={!input.trim() || isLoading} className="h-10 w-10 rounded-full">
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardFooter>
                </Card>
            )}

            <Button 
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "h-14 w-14 rounded-full shadow-xl transition-all duration-300 hover:scale-110 p-0 overflow-hidden",
                    isOpen ? "bg-slate-200 text-slate-600" : "bg-primary text-white"
                )}
            >
                {isOpen ? <X className="h-6 w-6" /> : <SimpleRobotIcon className="h-8 w-8" />}
            </Button>
        </div>
    );
}
