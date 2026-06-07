
'use client';

import { useState } from 'react';
import { useUser, useFirestore, useMemoFirebase, useCollection, setDocumentNonBlocking } from '@/firebase';
import { collection, query, doc, limit, serverTimestamp, orderBy } from 'firebase/firestore';
import type { UserProfile, Organization, InvitationCode, UserMembership } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { 
    Search, ShieldCheck, Users, Building2, Ticket, 
    RefreshCw, UserPlus, Plus, Hash, Globe, Crown
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
import { format } from 'date-fns';

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

  const [activeTab, setActiveTab] = useState('users');
  const [userSearch, setUserSearch] = useState('');
  const [orgSearch, setOrgSearch] = useState('');
  const [codeSearch, setCodeSearch] = useState('');
  
  const [isAddingMembership, setIsAddingMembership] = useState(false);
  const [targetUserForMembership, setTargetUserForMembership] = useState<UserProfile | null>(null);
  const [selectedOrgIdForUser, setSelectedOrgIdForUser] = useState('');

  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [newOrg, setNewOrg] = useState({ name: '', type: 'Church' as 'Church' | 'Group', address: '', phone: '' });

  const [isCreatingCode, setIsCreatingCode] = useState(false);
  const [newCodeData, setNewCodeData] = useState({ organizationId: '', usageLimit: 0 });

  const ROOT_ADMIN_EMAIL = 'darak303@naver.com';
  const ADMIN_UID = '4PYWOqRk1dXhVt5NXe5DZq7Fa4Q2';
  const isSuperAdmin = user?.email === ROOT_ADMIN_EMAIL || user?.uid === ADMIN_UID || profile?.isAdmin;

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

  const filteredUsers = (allUsers || []).filter(u => 
    u.email?.toLowerCase().includes(userSearch.toLowerCase()) || 
    u.displayName?.toLowerCase().includes(userSearch.toLowerCase())
  );

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
                <TabsList className="grid grid-cols-3 w-full max-w-xl mb-8 bg-white shadow-sm border p-1 rounded-xl">
                    <TabsTrigger value="users" className="rounded-lg"><Users className="mr-2 h-4 w-4"/>회원 및 권한</TabsTrigger>
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
