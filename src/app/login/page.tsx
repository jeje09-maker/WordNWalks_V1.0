
'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { MessageCircle, LoaderCircle, ArrowLeft, AlertCircle } from 'lucide-react';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendEmailVerification, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/use-translation';
import LanguageSelect from '@/components/language-select';
import LoadingSpinner from '@/components/LoadingSpinner';
import type { UserProfile } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function LoginPage() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [unverifiedUser, setUnverifiedUser] = useState<any>(null);
  const { t, lang } = useTranslation();

  useEffect(() => {
    if (!isUserLoading && user && user.emailVerified) {
      router.push('/journal');
    }
  }, [user, isUserLoading, router]);

  const formSchema = useMemo(() => z.object({
    email: z.string().email(t('validationEmail') || "Invalid email"),
    password: z.string().min(1, t('validationPassword') || "Password is required"),
  }), [t]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!auth) return;
    setIsLoggingIn(true);
    setUnverifiedUser(null);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;

      if (!user.emailVerified) {
        setUnverifiedUser(user);
        await signOut(auth);
        toast({
          variant: "destructive",
          title: "이메일 인증 필요",
          description: "이메일 인증이 완료되지 않았습니다. 메일을 확인해 주세요.",
        });
      } else {
        router.push('/journal');
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('loginFailedTitle') || "Login Failed",
        description: t('loginFailedDesc') || "Invalid email or password.",
      });
    } finally {
      setIsLoggingIn(false);
    }
  }

  const handleResendVerification = async () => {
    if (!unverifiedUser) return;
    setIsResending(true);
    try {
      await sendEmailVerification(unverifiedUser);
      toast({ title: "인증 메일 재발송", description: "메일을 다시 보냈습니다. 확인해 주세요." });
    } catch (e) {
      toast({ variant: "destructive", title: "발송 실패", description: "잠시 후 다시 시도해 주세요." });
    } finally {
      setIsResending(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!auth || !firestore) return;
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const googleUser = result.user;
      
      const userDocRef = doc(firestore, 'users', googleUser.uid);
      const docSnap = await getDoc(userDocRef);
      
      if (!docSnap.exists()) {
        const userProfile: UserProfile = {
          id: googleUser.uid,
          username: googleUser.email?.split('@')[0] || googleUser.uid,
          displayName: googleUser.displayName || 'User',
          realName: googleUser.displayName || '',
          nickname: googleUser.displayName || '',
          useNicknameAsDisplay: false,
          email: googleUser.email || '',
          birthDate: '',
          gender: 'male',
          language: lang,
          profilePictureUrl: googleUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${googleUser.uid}`,
          createdAt: serverTimestamp(),
          lastSeenAt: serverTimestamp(),
          status: 'active',
          isAdmin: googleUser.email?.toLowerCase() === 'darak303@naver.com',
          memberships: [],
          membershipIds: [],
          anniversaries: [],
        };
        await setDoc(userDocRef, userProfile);
        if (googleUser.email) {
            await setDoc(doc(firestore, 'users_lookup', googleUser.email.replace(/\./g, '_')), { uid: googleUser.uid });
        }
        toast({ title: "환영합니다!", description: "프로필이 생성되었습니다. 추가 정보를 설정해주세요." });
        router.push('/profile-setup');
      } else {
        router.push('/journal');
      }
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        console.error("Google sign-in error:", error);
        toast({ 
          variant: "destructive", 
          title: "구글 로그인 실패", 
          description: "로그인 중 오류가 발생했습니다. 다시 시도해주세요." 
        });
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (isUserLoading || (user && user.emailVerified)) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-muted/20 p-4 relative">
       <div className="absolute top-4 left-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')}><ArrowLeft/></Button>
      </div>
       <div className="absolute top-4 right-4">
        <LanguageSelect />
      </div>
      <div className="flex items-center gap-3 mb-6">
        <MessageCircle className="h-10 w-10 text-primary" />
        <h1 className="text-3xl font-black tracking-tighter text-foreground">Word N Walks</h1>
      </div>
      <Card className="w-full max-w-md shadow-xl bg-background">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t('welcomeBack')}</CardTitle>
          <CardDescription>{t('loginPrompt')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {unverifiedUser && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>이메일 인증이 필요합니다</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>가입 시 입력한 이메일({unverifiedUser.email})로 인증 메일이 발송되었습니다. 메일의 링크를 클릭하여 인증을 완료해 주세요.</p>
                <Button variant="outline" size="sm" onClick={handleResendVerification} disabled={isResending} className="w-full text-xs h-8">
                  {isResending ? "발송 중..." : "인증 메일 다시 받기"}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <Button variant="outline" className="w-full h-12 gap-2" onClick={handleGoogleLogin} disabled={isLoggingIn}>
            <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google로 계속하기
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t"></span></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">또는 이메일로 로그인</span></div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('emailLabel')}</FormLabel>
                    <FormControl><Input type="email" placeholder={t('emailPlaceholder')} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('passwordLabel')}</FormLabel>
                    <FormControl><Input type="password" placeholder={t('passwordPlaceholder')} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full h-12 text-base" disabled={isLoggingIn}>
                {isLoggingIn && <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />}
                {t('loginButton')}
              </Button>
            </form>
          </Form>
          <div className="mt-6 p-4 rounded-lg bg-primary/5 text-center">
            <p className="text-sm text-muted-foreground mb-2">아직 계정이 없으신가요?</p>
            <Button variant="outline" className="w-full" asChild>
                <Link href="/signup">지금 바로 가입하기</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
