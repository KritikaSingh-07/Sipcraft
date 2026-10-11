import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useLockBody } from '@/hooks/useLockBody';
import { cn } from '@/utils/cn';

const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input:not([disabled]),select,[tabindex]:not([tabindex="-1"])';

/** Traps focus inside `ref`, closes on Escape and restores focus on unmount. */
function useDialogA11y(open, ref, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const previously = document.activeElement;
    const node = ref.current;
    const focusFirst = () => {
      const el = node?.querySelector('[data-autofocus]') || node?.querySelector(FOCUSABLE);
      (el || node)?.focus({ preventScroll: true });
    };
    const t = setTimeout(focusFirst, 30);
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
      }
      if (e.key === 'Tab' && node) {
        const items = [...node.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      previously?.focus?.({ preventScroll: true });
    };
  }, [open, ref, onClose]);
}

export function Modal({ open, onClose, title, description, children, size = 'md', className, hideClose, footer }) {
  const ref = useRef(null);
  const titleId = useId();
  useLockBody(open);
  useDialogA11y(open, ref, onClose);
  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-3xl', xl: 'max-w-5xl' };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            className={cn('relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-surface shadow-lift outline-none sm:rounded-3xl', widths[size], className)}
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 30, stiffness: 340 }}
          >
            {(title || !hideClose) && (
              <div className="flex items-start justify-between gap-4 px-6 pt-6 sm:px-7">
                <div>
                  {title && (
                    <h2 id={titleId} className="text-xl font-bold tracking-tight">
                      {title}
                    </h2>
                  )}
                  {description && <p className="mt-1 text-sm text-muted">{description}</p>}
                </div>
                {!hideClose && (
                  <button onClick={onClose} className="-mt-1 -mr-2 rounded-full p-2 text-muted transition hover:bg-sand hover:text-ink" aria-label="Close dialog">
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}
            <div className="overflow-y-auto px-6 pt-4 pb-6 sm:px-7">{children}</div>
            {footer && <div className="flex flex-col-reverse gap-2 border-t border-line bg-canvas/60 px-6 py-4 sm:flex-row sm:justify-end sm:px-7">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, children, side = 'right', className, footer, label }) {
  const ref = useRef(null);
  useLockBody(open);
  useDialogA11y(open, ref, onClose);
  const from = side === 'right' ? { x: '100%' } : { x: '-100%' };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[65]">
          <motion.div className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-hidden />
          <motion.aside
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={label || title}
            tabIndex={-1}
            className={cn('absolute top-0 flex h-full w-[92vw] max-w-md flex-col bg-surface shadow-lift outline-none', side === 'right' ? 'right-0' : 'left-0', className)}
            initial={from}
            animate={{ x: 0 }}
            exit={from}
            transition={{ type: 'spring', damping: 34, stiffness: 320 }}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div className="text-lg font-bold tracking-tight">{title}</div>
              <button onClick={onClose} className="rounded-full p-2 text-muted transition hover:bg-sand hover:text-ink" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{children}</div>
            {footer && <div className="border-t border-line p-5">{footer}</div>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
