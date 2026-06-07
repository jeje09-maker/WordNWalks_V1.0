
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useMemoFirebase, useCollection, setDocumentNonBlocking } from '@/firebase';
import { collection, query, doc, limit, serverTimestamp, orderBy, collectionGroup, getDocs } from 'firebase/firestore';
import type { UserProfile, Organization, InvitationCode, UserMembership } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { 
    Search, ShieldCheck, Users, Building2, Ticket, 
    RefreshCw, UserPlus, Plus, Hash, Globe, Crown,
    Mail, BarChart3, ArrowUpDown
} from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
    Tooltip, 
    TooltipProvider, 
    TooltipContent, 
    TooltipTrigger 
} from '@/components/ui/tooltip';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { format, subDays } from 'date-fns';

const formatUserCreatedAt = (createdAt: any) => {
  if (!createdAt) return '-';
  try {
    const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    if (isNaN(d.getTime())) return '-';
    return format(d, 'yyyy-MM-dd HH:mm');
  } catch (e) {
    return '-';
  }
};

export default function SuperAdminPage() {
  const { user, profile } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const ROOT_ADMIN_EMAIL = 'darak303@naver.com';
  const ADMIN_UID = '4PYWOqRk1dXhVt5NXe5DZq7Fa4Q2';
  const isSuperAdmin = user?.email === ROOT_ADMIN_EMAIL || user?.uid === ADMIN_UID || profile?.isAdmin;

  const [activeTab, setActiveTab] = useState('users');
  const [userSearch, setUserSearch] = useState('');
  const [orgSearch, setOrgSearch] = useState('');
  const [codeSearch, setCodeSearch] = useState('');

  // Stats & Leaderboard states
  const [journals, setJournals] = useState<any[]>([]);
  const [isJournalsLoading, setIsJournalsLoading] = useState(true);
  const [sortField, setSortField] = useState<string>('lastActive');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [inactivePeriod, setInactivePeriod] = useState<'7days' | '30days'>('7days');
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('[Word N Walks] 소식 전해드립니다');
  const [emailBody, setEmailBody] = useState(
    '안녕하세요, 말씀과 동행하는 Word N Walks입니다.\n\n최근 묵상과 동행 기록이 뜸하셨는데, 다시 한 번 말씀과 함께 걷는 은혜를 누려보시는 것은 어떨까요?\n\n오늘도 말씀으로 승리하시길 기도합니다!'
  );
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);

  useEffect(() => {
    if (!firestore || !isSuperAdmin) return;
    const fetchAllJournals = async () => {
        setIsJournalsLoading(true);
        try {
            const q = collectionGroup(firestore, 'journal');
            const snap = await getDocs(q);
            const list: any[] = [];
            snap.forEach(doc => {
                const data = doc.data();
                const userId = doc.ref.parent.parent?.id;
                list.push({
                    id: doc.id,
                    userId,
                    completed: !!data.completed,
                    diaryCompleted: !!data.diaryCompleted,
                    date: data.date || doc.id, // e.g. "2026-06-07"
                });
            });
            setJournals(list);
        } catch (e) {
            console.error("Failed to fetch journals:", e);
        } finally {
            setIsJournalsLoading(false);
        }
    };
    fetchAllJournals();
  }, [firestore, isSuperAdmin]);
  
  const [isAddingMembership, setIsAddingMembership] = useState(false);
  const [targetUserForMembership, setTargetUserForMembership] = useState<UserProfile | null>(null);
  const [selectedOrgIdForUser, setSelectedOrgIdForUser] = useState('');

  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [newOrg, setNewOrg] = useState({ name: '', type: 'Church' as 'Church' | 'Group', address: '', phone: '' });

  const [isCreatingCode, setIsCreatingCode] = useState(false);
  const [newCodeData, setNewCodeData] = useState({ organizationId: '', usageLimit: 0 });

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !user || !isSuperAdmin) return null;
    return query(collection(firestore, 'users'), limit(1000));
  }, [firestore, user, isSuperAdmin]);
  const { data: allUsers, isLoading: isUsersLoading } = useCollection<UserProfile>(usersQuery);

  const orgsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !isSuperAdmin) return null;
    return query(collection(firestore, 'organizations'), orderBy('name', 'asc'));
  }, [firestore, user, isSuperAdmin]);
  const { data: organizations, isLoading: isOrgsLoading } = useCollection<Organization>(orgsQuery);

  const codesQuery = useMemoFirebase(() => {
    if (!firestore || !user || !isSuperAdmin) return null;
    return query(collection(firestore, 'invitationCodes'), orderBy('createdAt', 'desc'));
  }, [firestore, user, isSuperAdmin]);
  const { data: invitationCodes, isLoading: isCodesLoading } = useCollection<InvitationCode>(codesQuery);

  const handleToggleGroupAdmin = (targetUser: UserProfile, orgId: string) => {
      if (targetUser.email === ROOT_ADMIN_EMAIL) {
          toast({ title: "슈퍼 관리자의 권한은 변경할 수 없습니다.", variant: "destructive" });
          return;
      }

      const currentMemberships = targetUser.memberships || [];
      const updatedMemberships = currentMemberships.map(m => {
          if (m.organizationId === orgId) {
              return { ...m, role: m.role === 'admin' ? 'member' : 'admin' };
          }
          return m;
      });

      const hasAdminRole = updatedMemberships.some(m => m.role === 'admin');
      const membershipIds = updatedMemberships.map(m => m.organizationId);

      setDocumentNonBlocking(doc(firestore, 'users', targetUser.id), { 
          memberships: updatedMemberships,
          isGroupAdmin: hasAdminRole,
          membershipIds: membershipIds,
          updatedAt: serverTimestamp(),
          id: targetUser.id, 
          email: targetUser.email || '',
          displayName: targetUser.displayName || 'Unnamed User',
          status: targetUser.status || 'active'
      }, { merge: true });

      if (hasAdminRole) {
          setDocumentNonBlocking(doc(firestore, 'organizations', orgId), {
              mainAdminId: targetUser.id,
              mainAdminEmail: targetUser.email,
              updatedAt: serverTimestamp()
          }, { merge: true });
      }

      toast({ title: "권한 변경 및 계층 데이터 동기화 완료" });
  };

  const handleManualAddMembership = async () => {
      if (!targetUserForMembership || !selectedOrgIdForUser) return;

      const org = organizations?.find(o => o.id === selectedOrgIdForUser);
      if (!org) return;

      const currentMemberships = targetUserForMembership.memberships || [];
      if (currentMemberships.some(m => m.organizationId === selectedOrgIdForUser)) {
          toast({ title: "이미 소속된 단체입니다.", variant: "destructive" });
          return;
      }

      const newMembership: UserMembership = {
          organizationId: org.id,
          organizationName: org.name,
          role: 'member',
          joinedAt: new Date() 
      };

      const updatedMemberships = [...currentMemberships, newMembership];
      const membershipIds = updatedMemberships.map(m => m.organizationId);
      const hasAdminRole = updatedMemberships.some(m => m.role === 'admin');
      
      setDocumentNonBlocking(doc(firestore, 'users', targetUserForMembership.id), {
          memberships: updatedMemberships,
          membershipIds: membershipIds,
          isGroupAdmin: hasAdminRole,
          group: org.name, 
          updatedAt: serverTimestamp(),
          id: targetUserForMembership.id,
          email: targetUserForMembership.email || '',
          displayName: targetUserForMembership.displayName || 'Unnamed User',
          status: targetUserForMembership.status || 'active'
      }, { merge: true });

      toast({ title: "소속이 추가되었습니다." });
      setIsAddingMembership(false);
      setTargetUserForMembership(null);
      setSelectedOrgIdForUser('');
  };

  const handleSyncUserData = (targetUser: UserProfile) => {
      const currentMemberships = targetUser.memberships || [];
      const hasAdminRole = currentMemberships.some(m => m.role === 'admin');
      const membershipIds = currentMemberships.map(m => m.organizationId);

      setDocumentNonBlocking(doc(firestore, 'users', targetUser.id), { 
          membershipIds: membershipIds,
          isGroupAdmin: hasAdminRole,
          updatedAt: serverTimestamp(),
          id: targetUser.id, 
          email: targetUser.email || '',
          displayName: targetUser.displayName || 'Unnamed User',
          isAdmin: targetUser.isAdmin || targetUser.email === ROOT_ADMIN_EMAIL,
          status: targetUser.status || 'active'
      }, { merge: true });

      if (hasAdminRole) {
          const adminOrg = currentMemberships.find(m => m.role === 'admin');
          if (adminOrg) {
              setDocumentNonBlocking(doc(firestore, 'organizations', adminOrg.organizationId), {
                  mainAdminId: targetUser.id,
                  mainAdminEmail: targetUser.email,
                  updatedAt: serverTimestamp()
              }, { merge: true });
          }
      }

      toast({ title: "데이터 강제 동기화가 완료되었습니다." });
  };

  const handleCreateOrg = async () => {
      if (!newOrg.name.trim()) return;
      
      const orgId = newOrg.name.toLowerCase().replace(/\s+/g, '-');
      setDocumentNonBlocking(doc(firestore, 'organizations', orgId), {
          id: orgId,
          name: newOrg.name,
          type: newOrg.type,
          address: newOrg.address,
          orgPhone: newOrg.phone,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
      }, { merge: true });

      toast({ title: "단체가 생성되었습니다." });
      setIsCreatingOrg(false);
      setNewOrg({ name: '', type: 'Church', address: '', phone: '' });
  };

  const handleCreateCode = async () => {
      if (!newCodeData.organizationId) {
          toast({ title: "대상을 선택해주세요.", variant: "destructive" });
          return;
      }
      
      const generatedCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const codeId = generatedCode;

      setDocumentNonBlocking(doc(firestore, 'invitationCodes', codeId), {
          id: codeId,
          code: generatedCode,
          organizationId: newCodeData.organizationId,
          usageLimit: Number(newCodeData.usageLimit),
          timesUsed: 0,
          status: 'active',
          creatorId: user?.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
      }, { merge: true });

      toast({ title: `초대 코드가 생성되었습니다: ${generatedCode}` });
      setIsCreatingCode(false);
      setNewCodeData({ organizationId: '', usageLimit: 0 });
  };

  if (isUsersLoading || isOrgsLoading || isCodesLoading) {
    return <LoadingSpinner fullScreen />;
  }

  const usersWithStats = useMemo(() => {
    if (!allUsers) return [];
    
    const today = new Date();
    const date7DaysAgoStr = format(subDays(today, 7), 'yyyy-MM-dd');
    const date30DaysAgoStr = format(subDays(today, 30), 'yyyy-MM-dd');
    const todayStr = format(today, 'yyyy-MM-dd');

    return allUsers.map(u => {
      const userJournals = journals.filter(j => j.userId === u.id);
      
      const qtCount = userJournals.filter(j => j.completed).length;
      const diaryCount = userJournals.filter(j => j.diaryCompleted).length;
      
      const weekly = userJournals.filter(j => 
        j.date >= date7DaysAgoStr && 
        j.date <= todayStr && 
        (j.completed || j.diaryCompleted)
      ).length;

      const monthly = userJournals.filter(j => 
        j.date >= date30DaysAgoStr && 
        j.date <= todayStr && 
        (j.completed || j.diaryCompleted)
      ).length;

      const completedJournals = userJournals.filter(j => j.completed || j.diaryCompleted);
      const lastActiveDate = completedJournals.length > 0 
        ? completedJournals.reduce((max, curr) => curr.date > max ? curr.date : max, '') 
        : '-';

      return {
        ...u,
        qtCount,
        diaryCount,
        weekly,
        monthly,
        lastActiveDate
      };
    });
  }, [allUsers, journals]);

  const sortedAndFilteredUsers = useMemo(() => {
    const searchFiltered = usersWithStats.filter(u => 
      u.email?.toLowerCase().includes(userSearch.toLowerCase()) || 
      u.displayName?.toLowerCase().includes(userSearch.toLowerCase())
    );

    return [...searchFiltered].sort((a: any, b: any) => {
      let valA = a[sortField];
      let valB = b[sortField];

      // Handle custom comparisons for date strings
      if (sortField === 'lastActiveDate') {
        if (valA === '-') valA = '';
        if (valB === '-') valB = '';
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [usersWithStats, userSearch, sortField, sortOrder]);

  const inactiveUsers = useMemo(() => {
    return usersWithStats.filter(u => {
      if (inactivePeriod === '7days') {
        return u.weekly === 0;
      } else {
        return u.monthly === 0;
      }
    });
  }, [usersWithStats, inactivePeriod]);

  const filteredUsers = sortedAndFilteredUsers;

  const filteredOrgs = (organizations || []).filter(o => 
    o.name.toLowerCase().includes(orgSearch.toLowerCase())
  );

  const filteredCodes = (invitationCodes || []).filter(c => 
    c.code.toLowerCase().includes(codeSearch.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-muted/10">
      <header className="bg-white border-b p-6 shrink-0 flex justify-between items-center shadow-sm">
        <div>
            <h1 className="text-3xl font-black tracking-tighter flex items-center gap-2">
                <ShieldCheck className="text-primary h-8 w-8" />
                Super Admin Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">시스템 전체 관리 및 계층적 권한 조정</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}><Globe className="mr-2 h-4 w-4"/>새로고침</Button>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden p-8">
        <TooltipProvider>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                <TabsList className="grid grid-cols-4 w-full max-w-2xl mb-8 bg-white shadow-sm border p-1 rounded-xl">
                    <TabsTrigger value="users" className="rounded-lg"><Users className="mr-2 h-4 w-4"/>회원 및 권한</TabsTrigger>
                    <TabsTrigger value="stats" className="rounded-lg"><BarChart3 className="mr-2 h-4 w-4"/>통계 및 활동현황</TabsTrigger>
                    <TabsTrigger value="orgs" className="rounded-lg"><Building2 className="mr-2 h-4 w-4"/>단체 관리</TabsTrigger>
                    <TabsTrigger value="codes" className="rounded-lg"><Ticket className="mr-2 h-4 w-4"/>초대 코드</TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1">
                    <div className="max-w-7xl mx-auto pb-20">
                        <TabsContent value="users" className="mt-0 space-y-6">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                                    <div>
                                        <CardTitle>전체 회원 관리</CardTitle>
                                        <CardDescription>권한을 수정하거나 소속 단체를 지정합니다.</CardDescription>
                                    </div>
                                    <div className="relative w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input placeholder="이름 또는 이메일 검색..." value={userSearch} onChange={e => setUserSearch(e.target.value)} className="pl-9" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>사용자</TableHead>
                                                <TableHead>소속 및 권한</TableHead>
                                                <TableHead>가입일</TableHead>
                                                <TableHead>상태</TableHead>
                                                <TableHead className="text-right">작업</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredUsers.map(u => {
                                                const isRootAdmin = u.email === ROOT_ADMIN_EMAIL || u.id === ADMIN_UID || u.isAdmin;
                                                return (
                                                    <TableRow key={u.id}>
                                                        <TableCell className="flex items-center gap-3 py-4">
                                                            <Avatar className="h-10 w-10">
                                                                <AvatarImage src={u.profilePictureUrl}/>
                                                                <AvatarFallback>{u.displayName?.charAt(0) || 'U'}</AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <p className="font-bold text-sm">{u.displayName}</p>
                                                                    {isRootAdmin && (
                                                                        <Badge className="bg-red-600 hover:bg-red-700 text-[10px] h-5 px-1.5 font-bold uppercase flex items-center gap-1">
                                                                            <Crown className="h-2.5 w-2.5" /> Super Admin
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-muted-foreground">{u.email}</p>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-wrap gap-2 py-2">
                                                                {(u.memberships || []).map((m, idx) => (
                                                                    <Badge key={idx} variant={m.role === 'admin' ? "default" : "secondary"} className={cn(m.role === 'admin' && "bg-orange-500 hover:bg-orange-600")}>
                                                                        {m.organizationName} ({m.role})
                                                                        <button onClick={() => handleToggleGroupAdmin(u, m.organizationId)} className="ml-2 hover:text-white">
                                                                            <RefreshCw className="h-3 w-3" />
                                                                        </button>
                                                                    </Badge>
                                                                ))}
                                                                {(!u.memberships || u.memberships.length === 0) && <span className="text-xs text-muted-foreground italic">소속 없음</span>}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                            {formatUserCreatedAt(u.createdAt)}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant={u.status === 'active' ? 'default' : 'destructive'}>{u.status}</Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right space-x-1">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button size="icon" variant="ghost" onClick={() => handleSyncUserData(u)}><RefreshCw className="h-4 w-4" /></Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent><p>데이터 강제 동기화 (Upsert)</p></TooltipContent>
                                                            </Tooltip>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button size="icon" variant="ghost" onClick={() => { setTargetUserForMembership(u); setIsAddingMembership(true); }}><UserPlus className="h-4 w-4" /></Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent><p>단체 수동 추가</p></TooltipContent>
                                                            </Tooltip>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="stats" className="mt-0 space-y-6">
                            {/* Summary Metrics Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <Card className="bg-white shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                                    <CardContent className="p-6 flex items-center justify-between">
                                        <div className="space-y-1">
                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">전체 회원 수</p>
                                            <h3 className="text-3xl font-black tracking-tight text-slate-800">{allUsers?.length || 0}명</h3>
                                        </div>
                                        <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                                            <Users className="h-6 w-6" />
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="bg-white shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                                    <CardContent className="p-6 flex items-center justify-between">
                                        <div className="space-y-1">
                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">총 묵상(QT) 수</p>
                                            <h3 className="text-3xl font-black tracking-tight text-slate-800">
                                                {journals.filter(j => j.completed).length}회
                                            </h3>
                                        </div>
                                        <div className="h-12 w-12 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">
                                            <Crown className="h-6 w-6" />
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="bg-white shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                                    <CardContent className="p-6 flex items-center justify-between">
                                        <div className="space-y-1">
                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">주간 참여자 수</p>
                                            <h3 className="text-3xl font-black tracking-tight text-slate-800">
                                                {usersWithStats.filter(u => u.weekly > 0).length}명
                                            </h3>
                                        </div>
                                        <div className="h-12 w-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600">
                                            <BarChart3 className="h-6 w-6" />
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="bg-white shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                                    <CardContent className="p-6 flex items-center justify-between">
                                        <div className="space-y-1">
                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">월간 참여자 수</p>
                                            <h3 className="text-3xl font-black tracking-tight text-slate-800">
                                                {usersWithStats.filter(u => u.monthly > 0).length}명
                                            </h3>
                                        </div>
                                        <div className="h-12 w-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
                                            <Globe className="h-6 w-6" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
                                {/* Leaderboard / Activity table */}
                                <Card className="bg-white shadow-sm border">
                                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                                        <div>
                                            <CardTitle>회원별 활동 분석 현황</CardTitle>
                                            <CardDescription>전체 회원의 큐티/일기 작성 수 및 최근 참여 내역을 모니터링합니다. 각 열 머리글을 클릭해 정렬하세요.</CardDescription>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        {isJournalsLoading ? (
                                            <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground text-sm">
                                                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                                                활동 내역 데이터를 불러오는 중...
                                            </div>
                                        ) : (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>사용자</TableHead>
                                                        <TableHead>
                                                            <button 
                                                                onClick={() => {
                                                                    setSortField('qtCount');
                                                                    setSortOrder(prev => sortField === 'qtCount' && prev === 'desc' ? 'asc' : 'desc');
                                                                }}
                                                                className="flex items-center gap-1 hover:text-slate-800 font-bold"
                                                            >
                                                                총 큐티 <ArrowUpDown className="h-3.5 w-3.5" />
                                                            </button>
                                                        </TableHead>
                                                        <TableHead>
                                                            <button 
                                                                onClick={() => {
                                                                    setSortField('diaryCount');
                                                                    setSortOrder(prev => sortField === 'diaryCount' && prev === 'desc' ? 'asc' : 'desc');
                                                                }}
                                                                className="flex items-center gap-1 hover:text-slate-800 font-bold"
                                                            >
                                                                총 일기 <ArrowUpDown className="h-3.5 w-3.5" />
                                                            </button>
                                                        </TableHead>
                                                        <TableHead>
                                                            <button 
                                                                onClick={() => {
                                                                    setSortField('weekly');
                                                                    setSortOrder(prev => sortField === 'weekly' && prev === 'desc' ? 'asc' : 'desc');
                                                                }}
                                                                className="flex items-center gap-1 hover:text-slate-800 font-bold"
                                                            >
                                                                최근 1주 <ArrowUpDown className="h-3.5 w-3.5" />
                                                            </button>
                                                        </TableHead>
                                                        <TableHead>
                                                            <button 
                                                                onClick={() => {
                                                                    setSortField('monthly');
                                                                    setSortOrder(prev => sortField === 'monthly' && prev === 'desc' ? 'asc' : 'desc');
                                                                }}
                                                                className="flex items-center gap-1 hover:text-slate-800 font-bold"
                                                            >
                                                                최근 1달 <ArrowUpDown className="h-3.5 w-3.5" />
                                                            </button>
                                                        </TableHead>
                                                        <TableHead>
                                                            <button 
                                                                onClick={() => {
                                                                    setSortField('lastActiveDate');
                                                                    setSortOrder(prev => sortField === 'lastActiveDate' && prev === 'desc' ? 'asc' : 'desc');
                                                                }}
                                                                className="flex items-center gap-1 hover:text-slate-800 font-bold"
                                                            >
                                                                최근 활동일 <ArrowUpDown className="h-3.5 w-3.5" />
                                                            </button>
                                                        </TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {sortedAndFilteredUsers.map(u => (
                                                        <TableRow key={u.id}>
                                                            <TableCell className="flex items-center gap-3 py-3">
                                                                <Avatar className="h-9 w-9">
                                                                    <AvatarImage src={u.profilePictureUrl}/>
                                                                    <AvatarFallback>{u.displayName?.charAt(0) || 'U'}</AvatarFallback>
                                                                </Avatar>
                                                                <div>
                                                                    <p className="font-bold text-sm leading-none">{u.displayName}</p>
                                                                    <p className="text-[10px] text-muted-foreground mt-1">{u.email}</p>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="font-semibold text-sm text-slate-700">{u.qtCount}회</TableCell>
                                                            <TableCell className="font-semibold text-sm text-slate-700">{u.diaryCount}회</TableCell>
                                                            <TableCell className="font-semibold text-sm text-slate-700">{u.weekly}회</TableCell>
                                                            <TableCell className="font-semibold text-sm text-slate-700">{u.monthly}회</TableCell>
                                                            <TableCell className="text-xs text-muted-foreground">{u.lastActiveDate}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Inactive Users & Group Email */}
                                <Card className="bg-white shadow-sm border flex flex-col h-[600px]">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <Mail className="h-5 w-5 text-primary" />
                                                최근 미참여자 관리
                                            </CardTitle>
                                            <div className="flex border rounded-lg overflow-hidden text-xs">
                                                <button 
                                                    onClick={() => setInactivePeriod('7days')}
                                                    className={cn("px-2.5 py-1.5 font-medium transition-colors", inactivePeriod === '7days' ? "bg-primary text-white" : "bg-transparent text-slate-600 hover:bg-slate-50")}
                                                >
                                                    7일
                                                </button>
                                                <button 
                                                    onClick={() => setInactivePeriod('30days')}
                                                    className={cn("px-2.5 py-1.5 font-medium transition-colors", inactivePeriod === '30days' ? "bg-primary text-white" : "bg-transparent text-slate-600 hover:bg-slate-50")}
                                                >
                                                    30일
                                                </button>
                                            </div>
                                        </div>
                                        <CardDescription className="text-xs">
                                            지정한 기간 동안 한 번도 기록하지 않은 회원을 필터링하고 단체 메일을 보냅니다.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-1 min-h-0 flex flex-col justify-between pt-0 pb-4">
                                        <div className="flex-1 overflow-y-auto pr-1 border rounded-lg p-2 bg-slate-50/50 space-y-2 max-h-[350px]">
                                            {inactiveUsers.length === 0 ? (
                                                <p className="text-xs text-muted-foreground italic text-center py-8">해당 기간의 미참여자가 없습니다.</p>
                                            ) : (
                                                inactiveUsers.map(u => (
                                                    <div key={u.id} className="flex items-center justify-between p-2 bg-white rounded border border-slate-100 text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <Avatar className="h-7 w-7">
                                                                <AvatarImage src={u.profilePictureUrl}/>
                                                                <AvatarFallback>{u.displayName?.charAt(0) || 'U'}</AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <p className="font-bold">{u.displayName}</p>
                                                                <p className="text-[9px] text-muted-foreground">{u.email}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[9px] text-muted-foreground">마지막 활동</p>
                                                            <p className="font-medium text-slate-600">{u.lastActiveDate}</p>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                        <div className="pt-4 shrink-0">
                                            <Button 
                                                className="w-full bg-slate-800 hover:bg-slate-900 text-white flex items-center justify-center gap-2"
                                                disabled={inactiveUsers.length === 0}
                                                onClick={() => {
                                                    const emails = inactiveUsers.map(u => u.email).filter(e => !!e);
                                                    setEmailRecipients(emails);
                                                    setIsEmailModalOpen(true);
                                                }}
                                            >
                                                <Mail className="h-4 w-4" />
                                                미참여자 ({inactiveUsers.length}명) 단체 메일 쓰기
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        <TabsContent value="orgs" className="mt-0 space-y-6">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle>공동체(단체) 목록</CardTitle>
                                        <CardDescription>단체별 설정 및 관리자 정보를 확인합니다.</CardDescription>
                                    </div>
                                    <Button onClick={() => setIsCreatingOrg(true)}><Plus className="mr-2 h-4 w-4" /> 신규 단체 추가</Button>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {filteredOrgs.map(org => (
                                            <Card key={org.id} className="hover:shadow-md transition-all">
                                                <CardHeader className="pb-2">
                                                    <div className="flex justify-between items-start">
                                                        <CardTitle className="text-xl">{org.name}</CardTitle>
                                                        <Badge variant={org.type === 'Church' ? 'default' : 'secondary'}>{org.type}</Badge>
                                                    </div>
                                                    <CardDescription>{org.address || '주소 정보 없음'}</CardDescription>
                                                </CardHeader>
                                                <CardContent className="text-sm">
                                                    <p>연락처: {org.orgPhone || '-'}</p>
                                                    <p>메인 관리자: <span className="font-mono text-xs text-orange-600">{org.mainAdminEmail || '미지정'}</span></p>
                                                    <p className="text-muted-foreground text-[10px] mt-2">ID: {org.id}</p>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="codes" className="mt-0 space-y-6">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle>초대 코드 관리</CardTitle>
                                        <CardDescription>발행된 모든 초대 코드의 현황을 확인합니다.</CardDescription>
                                    </div>
                                    <Button onClick={() => setIsCreatingCode(true)}><Plus className="mr-2 h-4 w-4" /> 코드 생성</Button>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>코드</TableHead>
                                                <TableHead>대상 단체</TableHead>
                                                <TableHead>사용 현황</TableHead>
                                                <TableHead>생성일</TableHead>
                                                <TableHead className="text-right">상태</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredCodes.map(code => {
                                                const org = organizations?.find(o => o.id === code.organizationId);
                                                return (
                                                    <TableRow key={code.id}>
                                                        <TableCell className="font-mono font-bold text-primary py-4">
                                                            <div className="flex items-center gap-2">
                                                                <Hash className="h-3 w-3" />
                                                                {code.code}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>{org?.name || '알 수 없음'}</TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold">{code.timesUsed}</span>
                                                                <span className="text-muted-foreground">/</span>
                                                                <span className="text-muted-foreground">{code.usageLimit === 0 ? '무제한' : code.usageLimit}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-xs text-muted-foreground">
                                                            {code.createdAt?.toDate ? format(code.createdAt.toDate(), 'yyyy-MM-dd') : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Badge variant={code.status === 'active' ? 'default' : 'secondary'}>{code.status}</Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </div>
                </ScrollArea>
            </Tabs>

            <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Mail className="h-5 w-5 text-primary" />
                            미참여자 단체 메일 발송 (BCC)
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            수신자의 이메일 주소는 개인정보 보호를 위해 숨은참조(BCC)로 자동 지정됩니다.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4 text-sm">
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">수신자 ({emailRecipients.length}명)</Label>
                            <div className="p-2 border rounded bg-slate-50 text-[10px] text-muted-foreground font-mono max-h-20 overflow-y-auto leading-relaxed">
                                {emailRecipients.join(', ')}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">메일 제목</Label>
                            <Input 
                                value={emailSubject} 
                                onChange={e => setEmailSubject(e.target.value)} 
                                placeholder="메일 제목을 입력하세요" 
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">메일 본문</Label>
                            <Textarea 
                                value={emailBody} 
                                onChange={e => setEmailBody(e.target.value)} 
                                placeholder="메일 내용을 작성하세요" 
                                className="min-h-[150px] resize-none leading-relaxed"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEmailModalOpen(false)}>취소</Button>
                        <Button 
                            className="bg-primary text-white hover:bg-primary/90 flex items-center gap-2"
                            onClick={() => {
                                const bccList = emailRecipients.join(',');
                                const mailto = `mailto:?bcc=${encodeURIComponent(bccList)}&subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
                                window.location.href = mailto;
                                setIsEmailModalOpen(false);
                                toast({ title: "메일 클라이언트를 실행했습니다." });
                            }}
                        >
                            <Mail className="h-4 w-4" />
                            메일 클라이언트 열기
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isAddingMembership} onOpenChange={setIsAddingMembership}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>성도 소속 수동 추가</DialogTitle>
                        <DialogDescription>
                            <strong>{targetUserForMembership?.displayName}</strong> 성도를 특정 단체에 가입시킵니다.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label>단체 선택</Label>
                            <Select value={selectedOrgIdForUser} onValueChange={setSelectedOrgIdForUser}>
                                <SelectTrigger>
                                    <SelectValue placeholder="가입시킬 단체를 선택하세요" />
                                </SelectTrigger>
                                <SelectContent>
                                    {organizations?.map(org => (
                                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddingMembership(false)}>취소</Button>
                        <Button onClick={handleManualAddMembership} disabled={!selectedOrgIdForUser}>
                            소속 확정 및 가입 처리
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isCreatingOrg} onOpenChange={setIsCreatingOrg}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>새로운 교회/단체 등록</DialogTitle>
                        <DialogDescription>시스템에 새로운 공동체를 등록합니다.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>단체 이름</Label>
                            <Input value={newOrg.name} onChange={e => setNewOrg(p => ({...p, name: e.target.value}))} placeholder="예: 에덴정원교회" />
                        </div>
                        <div className="space-y-2">
                            <Label>유형</Label>
                            <Select value={newOrg.type} onValueChange={v => setNewOrg(p => ({...p, type: v as any}))}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Church">Church</SelectItem>
                                    <SelectItem value="Group">Group</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>주소</Label>
                            <Input value={newOrg.address} onChange={e => setNewOrg(p => ({...p, address: e.target.value}))} placeholder="단체 주소" />
                        </div>
                        <div className="space-y-2">
                            <Label>연락처</Label>
                            <Input value={newOrg.phone} onChange={e => setNewOrg(p => ({...p, phone: e.target.value}))} placeholder="전화번호" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreatingOrg(false)}>취소</Button>
                        <Button onClick={handleCreateOrg} disabled={!newOrg.name.trim()}>단체 등록</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isCreatingCode} onOpenChange={setIsCreatingCode}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>새로운 초대 코드 생성</DialogTitle>
                        <DialogDescription>성도들이 특정 단체에 가입할 수 있는 8자리 랜덤 코드를 생성합니다.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>대상 단체</Label>
                            <Select value={newCodeData.organizationId} onValueChange={v => setNewCodeData(p => ({...p, organizationId: v}))}>
                                <SelectTrigger><SelectValue placeholder="가입시킬 단체를 선택하세요" /></SelectTrigger>
                                <SelectContent>
                                    {organizations?.map(org => (
                                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>사용 횟수 제한 (0은 무제한)</Label>
                            <Input type="number" value={newCodeData.usageLimit} onChange={e => setNewCodeData(p => ({...p, usageLimit: parseInt(e.target.value)}))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreatingCode(false)}>취소</Button>
                        <Button onClick={handleCreateCode} disabled={!newCodeData.organizationId}>코드 생성 및 발행</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </TooltipProvider>
      </main>
    </div>
  );
}
