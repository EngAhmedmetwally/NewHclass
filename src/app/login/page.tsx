
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useDatabase } from '@/firebase';
import { signInAnonymously } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { User, Treasury } from '@/lib/definitions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useRtdbList } from '@/hooks/use-rtdb';
import { HiClassLogo } from '@/components/icons';
import { ref, set, update, get, push } from 'firebase/database';
import Link from 'next/link';

const DEFAULT_TREASURIES = [
    { id: 'treasury_cash', name: 'الخزينة النقدية (Cash)', branchId: 'all', branchName: 'كل الفروع' },
    { id: 'treasury_vodafone', name: 'خزينة فودافون كاش (Vodafone Cash)', branchId: 'all', branchName: 'كل الفروع' },
    { id: 'treasury_instapay', name: 'خزينة إنستا باي (InstaPay)', branchId: 'all', branchName: 'كل الفروع' },
];

function LoginPageContent() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: users, isLoading: usersLoading } = useRtdbList<User>('users');
  const auth = useAuth();
  const db = useDatabase();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // 1. Admin User Initialization
    if (!usersLoading && db) {
        const adminUser = users.find(u => u.username === 'admin');
        const adminUserId = adminUser?.id || 'admin-001';
        const adminRef = ref(db, `users/${adminUserId}`);

        if (!adminUser) {
            const adminData = { 
                id: 'admin-001',
                fullName: 'System Administrator',
                username: 'admin', 
                password: 'admin304050',
                isActive: true, 
                isSeller: true,
                role: 'admin' as 'admin',
                permissions: ['all'],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            set(adminRef, adminData).catch(err => console.error("Admin creation failed", err));
        }

        // 2. Default Treasuries Initialization
        const checkTreasuries = async () => {
            const treasuriesRef = ref(db, 'treasuries');
            const snapshot = await get(treasuriesRef);
            const currentTreasuries = snapshot.exists() ? Object.values(snapshot.val() as Record<string, Treasury>) : [];

            for (const def of DEFAULT_TREASURIES) {
                const exists = currentTreasuries.some(t => t.name === def.name || t.id === def.id);
                if (!exists) {
                    const newTreasuryRef = ref(db, `treasuries/${def.id}`);
                    const treasuryData: Treasury = {
                        id: def.id,
                        name: def.name,
                        branchId: def.branchId,
                        branchName: def.branchName,
                        balance: 0,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    };
                    await set(newTreasuryRef, treasuryData);
                }
            }
        };
        checkTreasuries();
    }
  }, [usersLoading, users, db]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!db) {
        setError('Database connection not available.');
        setIsLoading(false);
        return;
    }

    try {
        const usersRef = ref(db, 'users');
        const snapshot = await get(usersRef);
        
        if (!snapshot.exists()) {
            setError('No users found in the database.');
            setIsLoading(false);
            return;
        }

        const usersData = snapshot.val();
        let appUser: User | null = null;

        for (const userId in usersData) {
            const user = usersData[userId];
            if (user.username === username && user.password === password) {
                appUser = { ...user, id: userId };
                break;
            }
        }

        if (appUser && appUser.isActive) {
          localStorage.setItem('app_user_id', appUser.id);
          await signInAnonymously(auth);
          toast({ title: 'تم تسجيل الدخول بنجاح', description: `أهلاً بك، ${appUser.fullName}` });
          router.push('/home');
        } else if (appUser && !appUser.isActive) {
          setError('هذا الحساب معطل. الرجاء مراجعة المدير.');
          setIsLoading(false);
        } else {
          setError('اسم المستخدم أو كلمة المرور غير صحيحة.');
          setIsLoading(false);
        }
    } catch (dbError: any) {
        setError('حدث خطأ في الاتصال بقاعدة البيانات.');
        setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <HiClassLogo className="mx-auto h-20 w-auto" />
          <CardTitle className="mt-4 text-2xl font-headline">تسجيل الدخول</CardTitle>
          <CardDescription>أدخل اسم المستخدم وكلمة المرور للمتابعة</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="username">اسم المستخدم</Label>
              <Input id="username" type="text" required value={username} onChange={(e) => setUsername(e.target.value)} className="text-center" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <div className="relative">
                 <Input id="password" type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} className="text-center" dir="ltr" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 left-0 flex items-center px-3 text-muted-foreground">
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
             {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>خطأ في تسجيل الدخول</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            <Button type="submit" className="w-full mt-2 bg-orange-500 hover:bg-orange-600 text-white" disabled={isLoading}>
              {isLoading ? 'جاري التحميل...' : 'تسجيل الدخول'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
            <div className="text-xs text-muted-foreground text-center">
                للدعم و الأستفسار <br />
                <Link href="https://www.codlink.online" target="_blank" className="text-primary hover:underline">www.codlink.online</Link>
            </div>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function LoginPage() {
    return <LoginPageContent />
}
