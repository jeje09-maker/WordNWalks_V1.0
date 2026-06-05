'use client';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';

export default function OrgAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (isUserLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    // Check permissions
    const isSuperAdmin = user.email === 'darak303@naver.com' || profile?.isAdmin;
    const hasAdminRoleInMemberships = profile?.memberships && profile.memberships.some(m => m.role === 'admin');
    const isAnyGroupAdmin = profile?.isGroupAdmin || hasAdminRoleInMemberships;

    if (!isAnyGroupAdmin && !isSuperAdmin) {
      toast({
        title: "접근 거부",
        description: "단체 관리자 권한이 없습니다.",
        variant: "destructive",
      });
      router.push('/groups');
    }
  }, [user, profile, isUserLoading, router, toast]);

  if (isUserLoading) {
    return <LoadingSpinner fullScreen={true} />;
  }

  const isSuperAdmin = user?.email === 'darak303@naver.com' || profile?.isAdmin;
  const hasAdminRoleInMemberships = profile?.memberships && profile.memberships.some(m => m.role === 'admin');
  const isAnyGroupAdmin = profile?.isGroupAdmin || hasAdminRoleInMemberships;

  if (!isAnyGroupAdmin && !isSuperAdmin) {
    return null;
  }

  return <div className="h-screen w-screen overflow-hidden bg-background">{children}</div>;
}