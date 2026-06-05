'use client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function SegmentsAdminPage() {
  const router = useRouter();
  return (
    <div className="p-8">
      <Button onClick={() => router.push('/admin')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Admin
      </Button>
      <h1 className="text-3xl font-bold mt-6">Bible Segment Management</h1>
      <p className="text-muted-foreground mt-2">This feature is currently under construction.</p>
    </div>
  );
}
