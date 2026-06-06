'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { 
  MessageCircle, 
  LogIn, 
  Sparkles, 
  BookOpen, 
  Users, 
  Heart, 
  Hand, 
  CalendarDays, 
  FilePenLine, 
  Target, 
  Globe,
  Waves,
  GraduationCap,
  Database,
  ShieldCheck,
} from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import LanguageSelect from '@/components/language-select';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { placeholderImages } from '@/app/lib/placeholder-images.json';

export default function HomePage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/journal');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading) {
    return <LoadingSpinner fullScreen />;
  }

  const FeatureSection = ({ 
    icon: Icon, 
    title, 
    description, 
    detail, 
    imageUrl,
    index, 
    badge 
  }: { 
    icon: any, 
    title: string, 
    description: string, 
    detail: string, 
    imageUrl: string,
    index: number, 
    badge?: string 
  }) => {
    return (
        <section className={cn(
            "py-24 px-6 md:px-12 flex flex-col items-center",
            index % 2 === 0 ? "bg-white" : "bg-slate-50"
        )}>
            <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div className={cn("space-y-6", index % 2 !== 0 && "md:order-2")}>
                    <div className="inline-flex items-center gap-3">
                        <div className="h-14 w-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                            <Icon className="h-7 w-7" />
                        </div>
                        {badge && <span className="bg-primary/20 text-primary text-[10px] font-black px-2.5 py-1 rounded-full tracking-wider">{badge}</span>}
                    </div>
                    <h3 className="text-3xl md:text-4xl font-black text-slate-900 leading-tight">
                        {title}
                    </h3>
                    <p className="text-xl text-primary font-semibold leading-relaxed">
                        {description}
                    </p>
                    <div className="h-1 w-20 bg-primary/30 rounded-full" />
                    <p className="text-lg text-slate-600 leading-relaxed font-light whitespace-pre-wrap">
                        {detail}
                    </p>
                </div>
                <div className={cn(
                    "relative aspect-square bg-muted rounded-[40px] overflow-hidden shadow-2xl transform transition-transform hover:scale-[1.02]",
                    index % 2 !== 0 && "md:order-1"
                )}>
                    <img 
                        src={imageUrl} 
                        alt={title}
                        className="object-cover w-full h-full opacity-90 mix-blend-multiply"
                    />
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent pointer-events-none" />
                </div>
            </div>
        </section>
    );
  };

  return (
    <main className="min-h-screen bg-[#2e2848] text-white flex flex-col overflow-x-hidden font-sans">
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 py-4 px-6 md:px-10 flex justify-center">
        <div className="max-w-7xl w-full bg-white/90 backdrop-blur-md border border-white/20 rounded-2xl p-2 flex justify-between items-center shadow-2xl">
            <div className="flex items-center gap-2 pl-4">
                <MessageCircle className="h-6 w-6 text-primary" />
                <span className="text-xl font-black tracking-tighter text-slate-900">Word N Walks</span>
            </div>
            <div className="flex items-center gap-3">
                <LanguageSelect />
                <Button variant="ghost" className="text-slate-600 hover:bg-slate-100 hidden sm:flex" asChild>
                    <Link href="/login">
                        <LogIn className="mr-2 h-4 w-4" />
                        {t('loginButton')}
                    </Link>
                </Button>
                <Button size="sm" className="font-bold rounded-xl shadow-lg" asChild>
                    <Link href="/signup">{t('landing_cta_start')}</Link>
                </Button>
            </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-0 pt-40 pb-20 px-6 text-center flex flex-col items-center">
        <div 
          className="absolute inset-0 -z-20 bg-cover bg-center bg-no-repeat opacity-30 pointer-events-none"
          style={{ 
            backgroundImage: "url('/ancient-bible.png')",
            maskImage: 'radial-gradient(circle, rgba(0,0,0,1) 20%, rgba(0,0,0,0) 70%)',
            WebkitMaskImage: 'radial-gradient(circle, rgba(0,0,0,1) 20%, rgba(0,0,0,0) 70%)'
          }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-primary/20 rounded-full blur-[120px] -z-10" />
        
        <div className="inline-block px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-primary text-xs font-black tracking-[0.2em] mb-8 animate-pulse">
            {t('landing_hero_badge')}
        </div>

        <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-5xl flex flex-col items-center">
            <span className="text-2xl md:text-3xl font-bold text-slate-300 mb-2">기록할수록 깊어지는</span>
            <h1 className="text-5xl md:text-7xl font-black leading-tight text-white tracking-tight">
                나만의 말씀행전
            </h1>
        </div>

        <p className="text-lg md:text-xl text-slate-300 max-w-3xl mb-12 font-light leading-relaxed px-4 whitespace-pre-wrap">
          {t('landing_hero_desc')}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 mb-20">
            <Button size="lg" className="h-16 px-10 text-lg font-black rounded-2xl shadow-2xl shadow-primary/40" asChild>
                <Link href="/signup">{t('landing_cta_start')}</Link>
            </Button>
            <Button size="lg" variant="outline" className="h-16 px-10 text-lg font-bold rounded-2xl bg-white/5 border-white/20 text-white" asChild>
                <Link href="/login">{t('loginButton')}</Link>
            </Button>
        </div>

        {/* Integrated Intro Section */}
        <div className="max-w-4xl w-full mx-auto px-4 mb-32">
            <div className="bg-white/5 border border-white/10 p-8 md:p-16 rounded-[60px] backdrop-blur-md text-slate-200 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform duration-500">
                    <Database className="h-32 w-32 text-primary" />
                </div>
                <div className="relative z-10 text-left space-y-8">
                    <div className="flex items-center gap-3 text-primary">
                        <Sparkles className="h-6 w-6" />
                        <span className="font-black text-sm tracking-widest uppercase">The Spirit of Records</span>
                    </div>
                    <div className="space-y-6 text-lg md:text-xl leading-relaxed font-light whitespace-pre-wrap">
                        {t('landing_intro_text').split('\n\n').map((para, i) => (
                            <p key={i} className={cn(i === 0 && "text-2xl md:text-3xl font-black text-white leading-tight")}>
                                {para}
                            </p>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* Feature Sections */}
      <FeatureSection index={0} icon={BookOpen} title={t('landing_feature_1_title')} description={t('landing_feature_1_desc')} detail={t('landing_feature_1_detail')} imageUrl="/landing/bible_reading.png" />
      <FeatureSection index={1} icon={CalendarDays} title={t('landing_feature_life_title')} description={t('landing_feature_life_desc')} detail={t('landing_feature_life_detail')} imageUrl="/landing/calendar.png" />
      <FeatureSection index={2} icon={GraduationCap} title={t('landing_feature_retired_title')} description={t('landing_feature_retired_desc')} detail={t('landing_feature_retired_detail')} imageUrl="/landing/scholar.png" badge="VERIFIED" />
      <FeatureSection index={3} icon={Users} title={t('landing_feature_2b_title')} description={t('landing_feature_2b_desc')} detail={t('landing_feature_2b_detail')} imageUrl="/landing/community_admin.png" badge="COMMUNITY ADMIN" />
      <FeatureSection index={4} icon={Users} title={t('landing_feature_3_title')} description={t('landing_feature_3_desc')} detail={t('landing_feature_3_detail')} imageUrl="/landing/connection.png" badge="PEOPLE" />
      <FeatureSection index={5} icon={Hand} title={t('landing_feature_4_title')} description={t('landing_feature_4_desc')} detail={t('landing_feature_4_detail')} imageUrl="/landing/prayer.png" badge="PRAYER" />
      <FeatureSection index={6} icon={Database} title={t('landing_feature_5_title')} description={t('landing_feature_5_desc')} detail={t('landing_feature_5_detail')} imageUrl="/landing/steward.png" badge="STEWARDSHIP" />
      <FeatureSection index={7} icon={Globe} title={t('landing_feature_8_title')} description={t('landing_feature_8_desc')} detail={t('landing_feature_8_detail')} imageUrl="/landing/forum.png" badge="GLOBAL" />

      {/* Philosophy & Pricing -> Simplified Beta Section */}
      <section className="bg-white py-32 px-6 md:px-12 relative overflow-hidden border-t">
        <div className="max-w-5xl mx-auto text-center">
            <div className="inline-block p-4 bg-primary/10 rounded-3xl text-primary mb-8"><Target className="h-10 w-10" /></div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 mb-12 leading-tight">{t('landing_philosophy_title')}</h2>
            <div className="space-y-8 text-xl md:text-2xl text-slate-600 leading-relaxed font-light px-4 whitespace-pre-wrap">
                <p>{t('landing_philosophy_desc')}</p>
            </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t border-white/10 text-center text-slate-500 text-sm bg-[#2e2848]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12 px-10">
            <div className="flex items-center gap-3"><MessageCircle className="h-7 w-7 text-primary" /><span className="font-black text-white text-2xl tracking-tighter">Word N Walks</span></div>
            <p className="font-light text-lg">{t('landing_footer_rights')}</p>
            <div className="flex gap-10">
                <Link href="/feedback" className="text-lg hover:text-white transition-colors">{t('feedback')}</Link>
                <Link href="/login" className="text-lg hover:text-white transition-colors">{t('loginButton')}</Link>
            </div>
        </div>
      </footer>
    </main>
  );
}
