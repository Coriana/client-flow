import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as a destructive action (e.g. delete/remove). */
  destructive?: boolean;
}

interface QueuedConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Renders a single shadcn AlertDialog and exposes a promise-based `confirm()`
 * function via context. Requests made while a dialog is already open are
 * queued and shown one after another.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState<QueuedConfirm | null>(null);
  const queueRef = useRef<QueuedConfirm[]>([]);
  const activeRef = useRef<QueuedConfirm | null>(null);
  const confirmedRef = useRef(false);

  const showNext = useCallback(() => {
    const next = queueRef.current.shift() ?? null;
    activeRef.current = next;
    confirmedRef.current = false;
    setRequest(next);
    setOpen(next !== null);
  }, []);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      queueRef.current.push({ ...options, resolve });
      if (!activeRef.current) {
        showNext();
      }
    });
  }, [showNext]);

  const handleOpenChange = useCallback((next: boolean) => {
    if (next) {
      setOpen(true);
      return;
    }
    const finished = activeRef.current;
    activeRef.current = null;
    finished?.resolve(confirmedRef.current);
    setOpen(false);
    // Let the close animation finish before presenting the next dialog.
    window.setTimeout(showNext, 150);
  }, [showNext]);

  const handleConfirmClick = useCallback(() => {
    confirmedRef.current = true;
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{request?.title}</AlertDialogTitle>
            {request?.description && (
              <AlertDialogDescription className="whitespace-pre-line">
                {request.description}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{request?.cancelLabel ?? 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmClick}
              className={cn(request?.destructive && buttonVariants({ variant: 'destructive' }))}
            >
              {request?.confirmLabel ?? 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

/**
 * Returns a function to open a confirm dialog: `await confirm({ title, ... })`.
 * Resolves `true` when the user confirms, `false` on cancel or dismiss
 * (Escape key, etc). Must be called from within a `ConfirmProvider`.
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return ctx;
}
