
'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { Person, UserProfile } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User as UserIcon, Save, LoaderCircle, Upload, Image as ImageIcon, Camera, Star } from 'lucide-react';
import ImageCropperDialog from '@/app/profile-setup/components/ImageCropperDialog';
import IllustrationDialog from '@/app/profile-setup/components/IllustrationDialog';
import CameraCaptureDialog from '@/app/profile-setup/components/CameraCaptureDialog';
import { useUser, useDoc, useMemoFirebase, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';

const INITIAL_PERSON_STATE: Partial<Person> = {
  name: '',
  birthDate: '',
  birthDateIsLunar: false,
  relationship: 'other',
  comment: '',
  showBirthdayOnCalendar: true,
  birthdayNotifications: [],
  isFavorite: false,
};

const relationshipCategoryValues = ['family', 'church', 'friend', 'colleague', 'neighbor', 'heart_held_friend', 'organization', 'other'];


interface PersonFormDialogProps {
  person: Person | null;
  onSave: (data: Partial<Person> & { id?: string }) => void;
  onClose: () => void;
  isSaving: boolean;
}

export default function PersonFormDialog({ person, onSave, onClose, isSaving }: PersonFormDialogProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Partial<Person> & { id?: string }>(INITIAL_PERSON_STATE);

  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showIllustrations, setShowIllustrations] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  
  const { user } = useUser();
  const firestore = useFirestore();
  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  useEffect(() => {
    if (person) {
      setFormData({
        ...INITIAL_PERSON_STATE,
        ...person,
        birthdayNotifications: person.birthdayNotifications || (person.notifyOnBirthday ? ['1day'] : [])
      });
    } else {
      setFormData(INITIAL_PERSON_STATE);
    }
  }, [person]);

  const handleFieldChange = (field: keyof Person, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleNotification = (type: '2weeks' | '1week' | '1day') => {
    const current = formData.birthdayNotifications || [];
    const updated = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type];
    handleFieldChange('birthdayNotifications', updated);
  };

  const handleSaveClick = () => {
    onSave(formData);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onloadend = () => {
            setImageToCrop(reader.result as string);
        };
        reader.readAsDataURL(file);
         e.target.value = '';
    }
  };

  const handleCropComplete = (croppedImageUrl: string) => {
    handleFieldChange('avatarUrl', croppedImageUrl);
    setImageToCrop(null);
  };

  const handleCaptureComplete = (imageDataUrl: string) => {
    setImageToCrop(imageDataUrl);
    setShowCamera(false);
  };

  const handleIllustrationSelect = (imageUrl: string) => {
    handleFieldChange('avatarUrl', imageUrl);
    setShowIllustrations(false);
  };


  return (
    <>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{person ? t('peoples_editTitle') : t('peoples_addTitle')}</DialogTitle>
            <DialogDescription>{t('peoples_editDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center gap-2">
                <Avatar className="h-24 w-24 border-2 border-primary/50 shadow-md">
                    <AvatarImage src={formData.avatarUrl} />
                    <AvatarFallback><UserIcon className="h-12 w-12 text-muted-foreground" /></AvatarFallback>
                </Avatar>
                <div className="grid grid-cols-3 gap-2 w-full max-w-xs">
                    <Button variant="outline" size="sm" onClick={() => setShowIllustrations(true)} aria-label="Select Illustration">
                        <ImageIcon className="h-4 w-4 mr-2" /> {t('peoples_illustration')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} aria-label="Upload from Device">
                        <Upload className="h-4 w-4 mr-2" /> {t('peoples_upload')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowCamera(true)} aria-label="Take Photo">
                        <Camera className="h-4 w-4 mr-2" /> {t('peoples_camera')}
                    </Button>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="person-name">{t('peoples_nameLabel')}</Label>
                <Input id="person-name" value={formData.name || ''} onChange={(e) => handleFieldChange('name', e.target.value)} placeholder={t('peoples_namePlaceholder')} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="person-birthdate">{t('peoples_birthLabel')}</Label>
                <div className="flex items-center gap-4">
                    <Input id="person-birthdate" type="date" value={formData.birthDate || ''} onChange={(e) => handleFieldChange('birthDate', e.target.value)} placeholder={t('peoples_birthPlaceholder')} className="flex-1"/>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="is-lunar" checked={formData.birthDateIsLunar} onCheckedChange={(checked) => handleFieldChange('birthDateIsLunar', !!checked)} />
                        <label htmlFor="is-lunar" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            {t('peoples_lunar')}
                        </label>
                    </div>
                </div>
            </div>
            <div className="space-y-3 pt-2">
                <div className="flex items-center space-x-2">
                    <Checkbox id="show-on-calendar" checked={formData.showBirthdayOnCalendar} onCheckedChange={(checked) => handleFieldChange('showBirthdayOnCalendar', !!checked)} />
                    <label htmlFor="show-on-calendar" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        {t('peoples_showOnCalendar')}
                    </label>
                </div>
                
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">{t('peoples_notifyBirthday')}</Label>
                    <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                            <Checkbox 
                                id="notify-2weeks" 
                                checked={formData.birthdayNotifications?.includes('2weeks')} 
                                onCheckedChange={() => toggleNotification('2weeks')} 
                            />
                            <label htmlFor="notify-2weeks" className="text-xs font-medium">{t('peoples_notify_2weeks')}</label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox 
                                id="notify-1week" 
                                checked={formData.birthdayNotifications?.includes('1week')} 
                                onCheckedChange={() => toggleNotification('1week')} 
                            />
                            <label htmlFor="notify-1week" className="text-xs font-medium">{t('peoples_notify_1week')}</label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox 
                                id="notify-1day" 
                                checked={formData.birthdayNotifications?.includes('1day')} 
                                onCheckedChange={() => toggleNotification('1day')} 
                            />
                            <label htmlFor="notify-1day" className="text-xs font-medium">{t('peoples_notify_1day')}</label>
                        </div>
                    </div>
                </div>

                <div className="flex items-center space-x-2 pt-1">
                    <Checkbox id="is-favorite" checked={formData.isFavorite} onCheckedChange={(checked) => handleFieldChange('isFavorite', !!checked)} />
                    <label htmlFor="is-favorite" className="text-sm font-bold text-primary flex items-center gap-1 cursor-pointer">
                        <Star className={cn("h-3.5 w-3.5", formData.isFavorite && "fill-current")} />
                        {t('peoples_favoriteLabel')}
                    </label>
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="person-relationship">{t('peoples_relationshipLabel')}</Label>
                <Select value={formData.relationship || ''} onValueChange={(value) => handleFieldChange('relationship', value)}>
                    <SelectTrigger id="person-relationship">
                        <SelectValue placeholder={t('peoples_relationshipPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                        {relationshipCategoryValues.map(val => (
                            <SelectItem key={val} value={val}>{t(`relationship_${val}`)}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label htmlFor="person-comment">{t('peoples_commentLabel')}</Label>
                <Textarea id="person-comment" value={formData.comment || ''} onChange={(e) => handleFieldChange('comment', e.target.value)} placeholder={t('peoples_commentPlaceholder')} rows={3}/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
            <Button onClick={handleSaveClick} disabled={isSaving || !formData.name?.trim()}>
              {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {userProfile && showIllustrations && (
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
    </>
  );
}
