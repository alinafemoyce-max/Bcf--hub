'use client';

import * as RD from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const Dialog = RD.Root;
export const DialogTrigger = RD.Trigger;
export const DialogClose = RD.Close;

export function DialogContent({
  title,
  description,
  children,
  className
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <RD.Portal>
      <RD.Overlay className="fixed inset-0 z-50 bg-navy/45 backdrop-blur-[1px]" />
      <RD.Content
        className={cn(
          'fixed z-50 flex max-h-[92dvh] w-full flex-col overflow-y-auto bg-white shadow-raised focus:outline-none',
          'inset-x-0 bottom-0 rounded-t-2xl pb-safe sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <RD.Title className="text-lg font-semibold text-navy">{title}</RD.Title>
            {description ? (
              <RD.Description className="mt-1 text-sm text-muted">{description}</RD.Description>
            ) : (
              <RD.Description className="sr-only">{title}</RD.Description>
            )}
          </div>
          <RD.Close className="-mr-2 grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface" aria-label="Close">
            <X className="size-5" />
          </RD.Close>
        </div>
        <div className="px-5 py-5 sm:px-6">{children}</div>
      </RD.Content>
    </RD.Portal>
  );
}
