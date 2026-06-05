'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, doc } from 'firebase/firestore';
import type { FeedbackItem, FeedbackReply, UserProfile } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { Star, Send, ArrowLeft, Trash2, CornerDownRight, Edit, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';

type WithId<T> = T & { id: string };

const StarRating = ({ rating, setRating }: { rating: number, setRating: (r: number) => void }) => {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button" onClick={() => setRating(star)}>
          <Star className={cn('h-8 w-8', star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300')} />
        </button>
      ))}
    </div>
  );
};

const ReplyItem = ({ reply, isAdmin, onUpdate, onDelete }: { reply: WithId<FeedbackReply>, isAdmin: boolean, onUpdate: (newText: string) => void, onDelete: () => void }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(reply.text);

    const handleSave = () => {
        if (editText.trim() && editText.trim() !== reply.text) {
            onUpdate(editText.trim());
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditText(reply.text); // Reset text
    };

    return (
        <div className="flex items-start gap-3">
            <CornerDownRight className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
            <div className="p-3 rounded-md bg-primary/10 group flex-1">
                {isEditing ? (
                    <div className="space-y-2">
                        <Textarea 
                            value={editText} 
                            onChange={(e) => setEditText(e.target.value)} 
                            className="text-sm bg-background"
                            rows={3}
                            autoFocus
                        />
                        <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={handleCancel}><X className="h-4 w-4 mr-1"/>Cancel</Button>
                            <Button size="sm" onClick={handleSave} disabled={!editText.trim()}><Save className="h-4 w-4 mr-1"/>Save</Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-primary">{reply.userDisplayName} (Admin)</span>
                            <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">
                                    {reply.createdAt && (reply.createdAt as any).toDate
                                        ? formatDistanceToNow((reply.createdAt as any).toDate(), { addSuffix: true, locale: ko })
                                        : '방금 전'}
                                </span>
                                {isAdmin && (
                                    <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsEditing(true)}>
                                            <Edit className="h-3 w-3" />
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0">
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This action will permanently delete this reply.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                )}
                            </div>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{reply.text}</p>
                    </>
                )}
            </div>
        </div>
    );
};


const FeedbackItemCard = ({ item, isAdmin, currentUser }: { item: WithId<FeedbackItem>, isAdmin: boolean, currentUser: UserProfile }) => {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [replyText, setReplyText] = useState('');

  const repliesRef = useMemoFirebase(
    () => collection(firestore, 'feedback', item.id, 'replies'),
    [firestore, item.id]
  );
  const repliesQuery = useMemoFirebase(() => query(repliesRef, orderBy('createdAt', 'asc')), [repliesRef]);
  const { data: replies } = useCollection<FeedbackReply>(repliesQuery);

  const handleReplySubmit = () => {
    if (!replyText.trim()) return;
    addDocumentNonBlocking(repliesRef, {
      text: replyText,
      userId: currentUser.id,
      userDisplayName: currentUser.displayName,
      createdAt: serverTimestamp(),
    });
    setReplyText('');
  };
  
  const handleDeleteFeedback = () => {
    const feedbackDocRef = doc(firestore, 'feedback', item.id);
    deleteDocumentNonBlocking(feedbackDocRef);
    toast({
        title: 'Feedback Deleted',
        description: 'The feedback item has been successfully removed.',
    });
  };

  const handleUpdateReply = (replyId: string, newText: string) => {
    const replyDocRef = doc(firestore, 'feedback', item.id, 'replies', replyId);
    updateDocumentNonBlocking(replyDocRef, { text: newText });
    toast({
        title: 'Reply Updated',
    });
  };

  const handleDeleteReply = (replyId: string) => {
    const replyDocRef = doc(firestore, 'feedback', item.id, 'replies', replyId);
    deleteDocumentNonBlocking(replyDocRef);
    toast({
        title: 'Reply Deleted',
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-4">
          <Avatar>
            <AvatarImage src={item.userProfilePictureUrl} />
            <AvatarFallback>{item.userDisplayName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{item.userDisplayName}</CardTitle>
                    {isAdmin && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                               <Button variant="outline" size="icon" className="h-7 w-7 text-destructive border-destructive/50 hover:bg-destructive/10">
                                   <Trash2 className="h-4 w-4" />
                               </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete this feedback item and all its replies.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteFeedback}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>
              <span className="text-xs text-muted-foreground">
                {item.createdAt && (item.createdAt as any).toDate
                  ? formatDistanceToNow((item.createdAt as any).toDate(), { addSuffix: true, locale: ko })
                  : '방금 전'}
              </span>
            </div>
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={cn('h-5 w-5', i < item.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300')} />
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap">{item.comment}</p>
      </CardContent>
      {(replies && replies.length > 0 || isAdmin) && (
        <CardFooter className="flex-col items-start gap-3 bg-muted/50 pt-4">
          {replies && replies.length > 0 && (
            <div className="w-full space-y-3">
              {replies.map(reply => <ReplyItem key={reply.id} reply={reply} isAdmin={isAdmin} onUpdate={(newText) => handleUpdateReply(reply.id, newText)} onDelete={() => handleDeleteReply(reply.id)} />)}
            </div>
          )}
          {isAdmin && (
            <div className="w-full flex items-center gap-2">
              <Textarea
                placeholder="답변을 작성하세요..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="flex-1 text-sm h-12"
              />
              <Button size="icon" onClick={handleReplySubmit} disabled={!replyText.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardFooter>
      )}
    </Card>
  );
};

export default function FeedbackPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: currentUserProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const feedbackRef = useMemoFirebase(() => collection(firestore, 'feedback'), [firestore]);
  const feedbackQuery = useMemoFirebase(() => query(feedbackRef, orderBy('createdAt', 'desc')), [feedbackRef]);
  const { data: feedbackItems, isLoading: feedbackLoading } = useCollection<FeedbackItem>(feedbackQuery);

  const handleSubmit = async () => {
    if (rating === 0 || !comment.trim() || !currentUserProfile) return;
    setIsSubmitting(true);

    try {
      addDocumentNonBlocking(feedbackRef, {
        userId: currentUserProfile.id,
        userDisplayName: currentUserProfile.displayName,
        userProfilePictureUrl: currentUserProfile.profilePictureUrl,
        rating,
        comment,
        createdAt: serverTimestamp(),
      });
      toast({ title: '피드백 주셔서 감사합니다!' });
      setRating(0);
      setComment('');
    } catch (error) {
      toast({ variant: 'destructive', title: '오류', description: '피드백 제출에 실패했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isProfileLoading || feedbackLoading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <div className="h-screen w-screen flex flex-col">
      <header className="p-4 border-b flex items-center bg-background z-10">
        <Button variant="ghost" size="icon" className="mr-2" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">피드백 게시판</h1>
      </header>

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        <div className="md:w-1/3 lg:w-1/4 p-6 border-r flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>피드백 남기기</CardTitle>
              <CardDescription>앱 사용 경험을 공유해주세요.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">별점</label>
                <StarRating rating={rating} setRating={setRating} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">의견</label>
                <Textarea
                  placeholder="자유롭게 의견을 남겨주세요."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="min-h-[150px]"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSubmit} disabled={isSubmitting || rating === 0 || !comment.trim()} className="w-full">
                {isSubmitting ? '제출 중...' : '제출하기'}
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6">
              {feedbackItems && feedbackItems.length > 0 ? (
                feedbackItems.map(item => (
                  <FeedbackItemCard key={item.id} item={item} isAdmin={currentUserProfile?.isAdmin || false} currentUser={currentUserProfile!} />
                ))
              ) : (
                <div className="text-center text-muted-foreground py-20">
                  아직 작성된 피드백이 없습니다.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
