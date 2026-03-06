'use client';

import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { useSyncManager } from '@/providers/sync-provider';

export function SyncIndicator() {
  const { isOnline, isSyncing, pendingItems, triggerSync } = useSyncManager();

  if (isSyncing) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="text-primary animate-spin" disabled>
              <RefreshCw className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>جاري المزامنة... ({pendingItems})</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (!isOnline) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="text-destructive" disabled>
              <WifiOff className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>أنت غير متصل بالإنترنت. سيتم حفظ أي تغييرات محليًا.</p>
            {pendingItems > 0 && <p>يوجد {pendingItems} عناصر في انتظار المزامنة.</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (pendingItems > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="text-amber-500" onClick={triggerSync}>
              <RefreshCw className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white text-xs">{pendingItems}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>يوجد {pendingItems} عناصر للمزامنة. اضغط للمزامنة الآن.</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  return (
       <TooltipProvider>
          <Tooltip>
              <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-green-500" disabled>
                      <Wifi className="h-5 w-5" />
                  </Button>
              </TooltipTrigger>
              <TooltipContent><p>متصل ومُزامن.</p></TooltipContent>
          </Tooltip>
      </TooltipProvider>
  );
}
