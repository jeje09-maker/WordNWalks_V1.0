
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser, useAuth, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { MessageCircle, LoaderCircle, CheckCircle2, ChevronRight, ChevronLeft, Search, Check, AlertCircle, Mail } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithPopup, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile } from '@/lib/types';
import { languages } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useTranslation } from '@/hooks/use-translation';

const step1Schema = z.object({
  email: z.string().email("유효한 이메일 주소를 입력해주세요."),
  password: z.string().min(6, "비밀번호는 최소 6자 이상이어야 합니다."),
  confirmPassword: z.string().min(6, "비밀번호 확인을 입력해주세요."),
}).refine((data) => data.password === data.confirmPassword, {
  message: "비밀번호가 일치하지 않습니다.",
  path: ["confirmPassword"],
});

const step2Schema = z.object({
  realName: z.string().min(2, "이름은 최소 2자 이상이어야 합니다."),
  nickname: z.string().min(2, "별칭은 최소 2자 이상이어야 합니다."),
  useNicknameAsDisplay: z.enum(["true", "false"]),
  language: z.string().min(1, "사용 언어를 선택해주세요."),
  birthDate: z.string().length(6, "생년월일 6자리를 입력해주세요 (YYMMDD).").regex(/^\d{6}$/, "숫자 6자리로 입력해주세요."),
  gender: z.enum(["male", "female", "other"]),
});

export default function SignUpPage() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { lang } = useTranslation();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [emailChecked, setEmailChecked] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);

  const [step1Data, setStep1Data] = useState<z.infer<typeof step1Schema> | null>(null);

  const step1Form = useForm<z.infer<typeof step1Schema>>({
    resolver: zodResolver(step1Schema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  const step2Form = useForm<z.infer<typeof step2Schema>>({
    resolver: zodResolver(step2Schema),
    defaultValues: { realName: "", nickname: "", useNicknameAsDisplay: "true", language: "ko", birthDate: "", gender: "male" },
  });

  const handleGoogleSignUp = async () => {
    if (!auth || !firestore) return;
    setIsSubmitting(true);
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
        toast({ title: "환영합니다!", description: "구글 계정으로 가입되었습니다. 추가 정보를 설정해주세요." });
        router.push('/profile-setup');
      } else {
        toast({ title: "반갑습니다!", description: "이미 가입된 계정입니다." });
        router.push('/journal');
      }
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        console.error("Google sign-in error:", error);
        toast({ 
          variant: "destructive", 
          title: "구글 가입 실패", 
          description: "가입 중 오류가 발생했습니다. 다시 시도해주세요." 
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const checkEmailAvailability = async () => {
    const email = step1Form.getValues('email');
    if (!email || !email.includes('@')) {
      step1Form.setError('email', { message: '올바른 이메일을 먼저 입력해주세요.' });
      return;
    }

    setIsCheckingEmail(true);
    setErrorMessage(null);
    try {
      const userDocRef = doc(firestore, 'users_lookup', email.replace(/\./g, '_'));
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        throw { code: 'auth/email-already-in-use' };
      }
      setEmailChecked(email);
      toast({ title: "사용 가능한 이메일입니다." });
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        step1Form.setError("email", { message: "이미 가입된 이메일입니다." });
      } else if (error.code === 'permission-denied' || error.message?.includes('permission')) {
        const permissionError = new FirestorePermissionError({
          path: `users_lookup/${email.replace(/\./g, '_')}`,
          operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
      } else {
        setErrorMessage("이메일 확인 중 오류가 발생했습니다.");
      }
      setEmailChecked(null);
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const onStep1Submit = async (data: z.infer<typeof step1Schema>) => {
    if (emailChecked !== data.email) {
      step1Form.setError("email", { message: "이메일 중복 확인을 해주세요." });
      return;
    }
    setStep1Data(data);
    setStep(2);
  };

  const onCompleteSignUp = async (data: z.infer<typeof step2Schema>) => {
    if (!auth || !firestore || !step1Data) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, step1Data.email, step1Data.password);
      const newUser = userCredential.user;
      
      const isNicknameDisplay = data.useNicknameAsDisplay === "true";
      const finalDisplayName = isNicknameDisplay ? data.nickname : data.realName;
      const photoURL = `https://api.dicebear.com/7.x/avataaars/svg?seed=${newUser.uid}`;

      await updateProfile(newUser, {
        displayName: finalDisplayName,
        photoURL: photoURL
      });

      const userProfile: UserProfile = {
        id: newUser.uid,
        username: step1Data.email.split('@')[0],
        displayName: finalDisplayName,
        realName: data.realName,
        nickname: data.nickname,
        useNicknameAsDisplay: isNicknameDisplay,
        email: step1Data.email.toLowerCase(),
        birthDate: data.birthDate,
        gender: data.gender,
        language: data.language,
        profilePictureUrl: photoURL,
        createdAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
        isAdmin: step1Data.email.toLowerCase() === 'darak303@naver.com',
        status: 'active',
        memberships: [],
        membershipIds: [],
        anniversaries: [],
      };

      await setDoc(doc(firestore, 'users', newUser.uid), userProfile);
      await setDoc(doc(firestore, 'users_lookup', step1Data.email.replace(/\./g, '_')), { uid: newUser.uid });

      await sendEmailVerification(newUser);
      setVerificationSent(true);
      
      toast({ title: "인증 메일 발송!", description: "입력하신 이메일로 인증 메일을 보냈습니다. 확인 후 로그인해주세요." });
      
    } catch (error: any) {
      console.error("Sign up error:", error);
      let msg = "회원가입 처리 중 오류가 발생했습니다.";
      if (error.code === 'auth/email-already-in-use') {
        msg = "이미 사용 중인 이메일 주소입니다.";
        setStep(1);
      }
      setErrorMessage(error.message || msg);
      toast({ variant: "destructive", title: "가입 실패", description: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isUserLoading || user) {
    return <LoadingSpinner fullScreen />;
  }

  if (verificationSent) {
    return (
      <main className="min-h-screen bg-muted/20 flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl text-center p-8">
          <div className="flex justify-center mb-6">
            <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <Mail className="h-10 w-10" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold mb-4">이메일 인증이 필요합니다</CardTitle>
          <CardDescription className="text-base mb-8">
            <strong>{step1Data?.email}</strong> 주소로 인증 링크를 보냈습니다.<br/>
            메일함의 링크를 클릭하여 가입을 완료한 후 로그인해 주세요.
          </CardDescription>
          <Button className="w-full" asChild>
            <Link href="/login">로그인 페이지로 이동</Link>
          </Button>
          <p className="mt-6 text-sm text-muted-foreground">
            메일을 받지 못하셨나요? 스팸함을 확인하거나 잠시 후 다시 시도해 주세요.
          </p>
        </Card>
      </main>
    );
  }

  const renderProgressBar = () => (
    <div className="flex items-center justify-between mb-8 px-4">
      {[1, 2].map((i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors",
            step === i ? "bg-primary text-white" : step > i ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
          )}>
            {step > i ? <CheckCircle2 className="h-5 w-5" /> : i}
          </div>
          {i < 2 && <div className={cn("h-1 flex-1 mx-2 rounded-full", step > i ? "bg-green-500" : "bg-muted")} />}
        </div>
      ))}
    </div>
  );

  return (
    <main className="min-h-screen bg-muted/20 flex flex-col items-center justify-center p-4">
      <div className="flex items-center gap-2 mb-8">
        <MessageCircle className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-black tracking-tighter">Word N Walks</h1>
      </div>

      <Card className="w-full max-w-xl shadow-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            {step === 1 ? "계정 정보를 입력해주세요" : "프로필 정보를 입력해주세요"}
          </CardTitle>
          <CardDescription>
            {step === 1 ? "로그인 시 사용할 이메일과 비밀번호를 적어주세요." : "앱에서 사용할 이름과 기본 정보를 설정합니다."}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {errorMessage && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>오류 발생</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {step === 1 && (
            <>
              <Button variant="outline" className="w-full h-12 gap-2 mb-6" onClick={handleGoogleSignUp} disabled={isSubmitting}>
                <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google로 가입하기
              </Button>

              <div className="relative mb-8">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t"></span></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">또는 이메일로 가입</span></div>
              </div>
            </>
          )}

          {renderProgressBar()}

          {step === 1 && (
            <Form {...step1Form}>
              <form onSubmit={step1Form.handleSubmit(onStep1Submit)} className="space-y-4">
                <FormField control={step1Form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>이메일 (아이디)</FormLabel>
                    <div className="flex gap-2">
                      <FormControl className="flex-1">
                        <Input type="email" placeholder="example@email.com" {...field} onChange={(e) => {
                          field.onChange(e);
                          setEmailChecked(null);
                        }} />
                      </FormControl>
                      <Button type="button" variant="outline" onClick={checkEmailAvailability} disabled={isCheckingEmail || !field.value}>
                        {isCheckingEmail ? <LoaderCircle className="h-4 w-4 animate-spin" /> : emailChecked === field.value ? <Check className="h-4 w-4 text-green-500" /> : <Search className="h-4 w-4" />}
                        <span className="ml-2">중복 확인</span>
                      </Button>
                    </div>
                    {emailChecked === field.value && <p className="text-xs text-green-600 font-medium">사용 가능한 이메일입니다.</p>}
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={step1Form.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel>비밀번호</FormLabel>
                    <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={step1Form.control} name="confirmPassword" render={({ field }) => (
                  <FormItem>
                    <FormLabel>비밀번호 확인</FormLabel>
                    <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full h-12" disabled={!emailChecked || isCheckingEmail}>
                  다음 단계 <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </Form>
          )}

          {step === 2 && (
            <Form {...step2Form}>
              <form onSubmit={step2Form.handleSubmit(onCompleteSignUp)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={step2Form.control} name="realName" render={({ field }) => (
                        <FormItem><FormLabel>이름 (본명)</FormLabel><FormControl><Input placeholder="홍길동" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={step2Form.control} name="nickname" render={({ field }) => (
                        <FormItem><FormLabel>별칭 (닉네임)</FormLabel><FormControl><Input placeholder="은혜로운자" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>

                <FormField control={step2Form.control} name="useNicknameAsDisplay" render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>앱에서 어떤 이름을 사용하시겠습니까?</FormLabel>
                    <FormControl>
                      <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="false" id="r1" />
                          <Label htmlFor="r1">이름(본명)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="true" id="r2" />
                          <Label htmlFor="r2">별칭(닉네임)</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-4">
                    <FormField control={step2Form.control} name="language" render={({ field }) => (
                    <FormItem>
                        <FormLabel>사용 언어</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="언어 선택" /></SelectTrigger></FormControl>
                        <SelectContent>{languages.map(l => <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )} />
                    <FormField control={step2Form.control} name="gender" render={({ field }) => (
                    <FormItem>
                        <FormLabel>성별</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="성별" /></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="male">남성</SelectItem>
                            <SelectItem value="female">여성</SelectItem>
                            <SelectItem value="other">기타</SelectItem>
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )} />
                </div>
                <FormField control={step2Form.control} name="birthDate" render={({ field }) => (
                  <FormItem><FormLabel>생년월일 (YYMMDD)</FormLabel><FormControl><Input placeholder="900101" maxLength={6} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                
                <div className="flex gap-2 pt-4">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}><ChevronLeft className="mr-2 h-4 w-4" /> 이전</Button>
                    <Button type="submit" className="flex-[2] h-12 font-bold" disabled={isSubmitting}>
                        {isSubmitting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        가입 완료 및 인증 메일 받기
                    </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
        <CardFooter className="justify-center border-t py-4">
            <p className="text-sm text-muted-foreground">이미 계정이 있으신가요? <Link href="/login" className="text-primary font-bold hover:underline">로그인</Link></p>
        </CardFooter>
      </Card>
    </main>
  );
}
