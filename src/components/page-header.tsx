'use client';

import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

type PageHeaderProps = {
  title: string;
  className?: string;
  children?: React.ReactNode;
  showBackButton?: boolean;
};

export function PageHeader({ title, className, children, showBackButton = false }: PageHeaderProps) {
  const router = useRouter();

  return (
    <div
      className={cn(
        'flex flex-col gap-4 md:flex-row md:items-center md:justify-between',
        className
      )}
    >
      <div className="flex items-center gap-3">
        {showBackButton && (
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => router.back()}
          >
            <ArrowRight className="h-4 w-4" />
            <span className="sr-only">الرجوع</span>
          </Button>
        )}
        <h1 className="font-headline text-2xl font-bold tracking-tight md:text-3xl">
          {title}
        </h1>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
