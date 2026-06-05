'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, isValid } from 'date-fns';
import { Plus, Trash2, Edit, Save, X } from 'lucide-react';
import type { PrayerItem, PrayerFeedback } from '@/lib/types';
import { useTranslation } from '@/hooks/use-translation';

interface PrayerFeedbackDialogProps {
  prayer: PrayerItem;
  onClose: () => void;
  onUpdateFeedbacks: (feedbacks: PrayerFeedback[]) => void;
}

export default function PrayerFeedbackDialog({ prayer, onClose, onUpdateFeedbacks }: PrayerFeedbackDialogProps) {
  const { t } = useTranslation();
  const [newFeedback, setNewFeedback] = useState('');
  const [editingFeedback, setEditingFeedback] = useState<PrayerFeedback | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const handleAddFeedback = () => {
    if (!newFeedback.trim()) return;
    const feedback: PrayerFeedback = {
      id: Date.now().toString(),
      content: newFeedback,
      createdAt: new Date(),
    };
    onUpdateFeedbacks([...(prayer.feedbacks || []), feedback]);
    setNewFeedback('');
  };

  const handleDeleteFeedback = (feedbackId: string) => {
    onUpdateFeedbacks((prayer.feedbacks || []).filter(f => f.id !== feedbackId));
  };
  
  const startEditing = (feedback: PrayerFeedback) => {
    setEditingFeedback(feedback);
    setEditingContent(feedback.content);
  };

  const handleUpdateFeedback = () => {
    if (!editingFeedback || !editingContent.trim()) return;
    onUpdateFeedbacks((prayer.feedbacks || []).map(f => f.id === editingFeedback.id ? { ...f, content: editingContent } : f));
    setEditingFeedback(null);
    setEditingContent('');
  };
  
  const cancelEditing = () => {
    setEditingFeedback(null);
    setEditingContent('');
  };

  const getDisplayDate = (date: any) => {
    if (!date) return '';
    try {
        const d = date.toDate ? date.toDate() : new Date(date);
        return isValid(d) ? format(d, 'yyyy.MM.dd HH:mm') : '';
    } catch (e) {
        return '';
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('dialog_prayer_title').replace('{title}', prayer.title)}</DialogTitle>
          <DialogDescription>
            {t('dialog_prayer_desc')}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 my-4 -mx-6 px-6 border-y">
          <div className="space-y-4 py-4 pr-2">
            {(prayer.feedbacks || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('dialog_noRecords')}</p>
            ) : (
              [...(prayer.feedbacks || [])].map(feedback => (
                <div key={feedback.id} className="p-3 rounded-lg bg-muted/50 group">
                  {editingFeedback?.id === feedback.id ? (
                     <div className="space-y-2">
                        <Textarea value={editingContent} onChange={(e) => setEditingContent(e.target.value)} className="text-sm"/>
                        <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={cancelEditing}><X className="h-4 w-4 mr-1"/>{t('cancel')}</Button>
                            <Button size="sm" onClick={handleUpdateFeedback} disabled={!editingContent.trim()}><Save className="h-4 w-4 mr-1"/>{t('save')}</Button>
                        </div>
                     </div>
                  ) : (
                    <>
                      <p className="text-sm whitespace-pre-wrap">{feedback.content}</p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-muted-foreground">
                          {getDisplayDate(feedback.createdAt)}
                        </p>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditing(feedback)}><Edit className="h-4 w-4"/></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteFeedback(feedback.id)}><Trash2 className="h-4 w-4"/></Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="mt-auto space-y-2">
            <Textarea 
                value={newFeedback} 
                onChange={(e) => setNewFeedback(e.target.value)}
                placeholder={t('dialog_addNewRecordPlaceholder')}
            />
            <div className="flex justify-end">
                <Button onClick={handleAddFeedback} disabled={!newFeedback.trim()}>
                    <Plus className="h-4 w-4 mr-2"/> {t('dialog_addRecord')}
                </Button>
            </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}