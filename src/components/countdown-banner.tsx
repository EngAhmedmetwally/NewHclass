'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Settings } from 'lucide-react';
import { useSettings } from '@/hooks/use-settings';
import { useUser } from '@/firebase';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { addDays } from 'date-fns';

/**
 * نافذة تحكم الـ Admin في العداد
 */
function CountdownSettingsDialog() {
    const { settings, updateSettings } = useSettings();
    const [open, setOpen] = useState(false);
    const [expiry, setExpiry] = useState(settings.countdown_expiry || '');
    const [show, setShow] = useState(settings.countdown_show ?? true);

    useEffect(() => {
        if (open) {
            setExpiry(settings.countdown_expiry || '');
            setShow(settings.countdown_show ?? true);
        }
    }, [open, settings.countdown_expiry, settings.countdown_show]);

    const handleSave = async () => {
        await updateSettings({
            countdown_expiry: expiry,
            countdown_show: show
        });
        setOpen(false);
    };

    const resetToThreeDays = () => {
        const date = addDays(new Date(), 3).toISOString();
        setExpiry(date);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-orange-500 hover:text-orange-600 hover:bg-orange-100">
                    <Settings className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md text-right" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right">إعدادات عداد الاشتراك</DialogTitle>
                    <DialogDescription className="text-right">تحكم في موعد انتهاء الاشتراك وظهور العداد لجميع المستخدمين.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                        <Label htmlFor="show-timer" className="font-bold">إظهار العداد للموظفين</Label>
                        <Switch id="show-timer" checked={show} onCheckedChange={setShow} />
                    </div>
                    <div className="space-y-2">
                        <Label>تاريخ ووقت انتهاء الاشتراك</Label>
                        <Input 
                            type="datetime-local" 
                            value={expiry ? expiry.slice(0, 16) : ''} 
                            onChange={(e) => setExpiry(new Date(e.target.value).toISOString())}
                            className="text-left font-mono"
                        />
                    </div>
                    <Button variant="outline" onClick={resetToThreeDays} className="w-full gap-2 border-orange-200 text-orange-600">
                        <Clock className="h-4 w-4" />
                        ضبط لـ 3 أيام من الآن
                    </Button>
                </div>
                <DialogFooter>
                    <Button onClick={handleSave} className="w-full h-12 bg-orange-600 hover:bg-orange-700">حفظ الإعدادات للجميع</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * مكون العداد التنازلي - يسحب البيانات من قاعدة البيانات المركزية
 */
export function CountdownBanner() {
    const { settings } = useSettings();
    const { appUser } = useUser();
    const [timeLeft, setTimeLeft] = useState<{d:number, h:number, m:number, s:number, ms:number} | null>(null);
    
    const isAdmin = appUser?.username === 'admin';
    const isVisible = settings.countdown_show;

    useEffect(() => {
        if (!settings.countdown_expiry) return;

        const targetTime = new Date(settings.countdown_expiry).getTime();

        const timer = setInterval(() => {
            const now = new Date().getTime();
            const diff = targetTime - now;

            if (diff <= 0) {
                setTimeLeft({ d: 0, h: 0, m: 0, s: 0, ms: 0 });
                clearInterval(timer);
                return;
            }

            setTimeLeft({
                d: Math.floor(diff / (1000 * 60 * 60 * 24)),
                h: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                m: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
                s: Math.floor((diff % (1000 * 60)) / 1000),
                ms: Math.floor((diff % 1000) / 10)
            });
        }, 33);

        return () => clearInterval(timer);
    }, [settings.countdown_expiry]);

    // إذا كان العداد مخفي وليس المستخدم admin، لا تظهر شيئاً
    if (!isVisible && !isAdmin) return null;
    if (!timeLeft) return null;

    return (
        <Card className={cn(
            "border-orange-500 bg-orange-500/5 mb-6 overflow-hidden shadow-sm relative transition-opacity",
            !isVisible && "opacity-40 grayscale-[0.5]"
        )}>
            <CardContent className="py-4 flex flex-col items-center justify-center gap-3">
                {isAdmin && (
                    <div className="absolute top-2 right-2">
                        <CountdownSettingsDialog />
                    </div>
                )}
                
                <div className="flex flex-col items-center gap-1 text-center">
                    <div className="flex items-center gap-2 text-orange-600 animate-pulse">
                        <Clock className="h-5 w-5" />
                        <span className="text-sm font-bold font-headline">الاشتراك السنوي للبرنامج</span>
                    </div>
                    <p className="text-xs text-orange-500/80 font-medium">
                        {!isVisible && isAdmin ? "(مخفي عن الموظفين) " : ""}
                        يجب دفع الاشتراك السنوي للبرنامج في غضون:
                    </p>
                </div>
                
                <div className="flex items-center gap-2 md:gap-5 text-orange-500 font-mono tabular-nums" dir="ltr">
                    <div className="flex flex-col items-center">
                        <span className="text-2xl md:text-4xl font-black">{timeLeft.d.toString().padStart(2, '0')}</span>
                        <span className="text-[10px] font-bold text-orange-400 uppercase">Days</span>
                    </div>
                    <span className="text-xl md:text-3xl font-bold mb-4">:</span>
                    <div className="flex flex-col items-center">
                        <span className="text-2xl md:text-4xl font-black">{timeLeft.h.toString().padStart(2, '0')}</span>
                        <span className="text-[10px] font-bold text-orange-400 uppercase">Hrs</span>
                    </div>
                    <span className="text-xl md:text-3xl font-bold mb-4">:</span>
                    <div className="flex flex-col items-center">
                        <span className="text-2xl md:text-4xl font-black">{timeLeft.m.toString().padStart(2, '0')}</span>
                        <span className="text-[10px] font-bold text-orange-400 uppercase">Min</span>
                    </div>
                    <span className="text-xl md:text-3xl font-bold mb-4">:</span>
                    <div className="flex flex-col items-center">
                        <span className="text-2xl md:text-4xl font-black">{timeLeft.s.toString().padStart(2, '0')}</span>
                        <span className="text-[10px] font-bold text-orange-400 uppercase">Sec</span>
                    </div>
                    <span className="text-xl md:text-3xl font-bold mb-4">.</span>
                    <div className="flex flex-col items-center">
                        <span className="text-xl md:text-2xl font-black text-orange-400/80">{timeLeft.ms.toString().padStart(2, '0')}</span>
                        <span className="text-[8px] font-bold text-orange-400 uppercase">Ms</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
