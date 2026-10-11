import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

const ConfirmContext = createContext(null);

/**
 * App-wide confirmation dialog.
 *   const confirm = useConfirm();
 *   if (await confirm({ title: 'Delete product?', tone: 'danger' })) { … }
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((opts) => {
    setState({ confirmText: 'Confirm', cancelText: 'Cancel', tone: 'default', ...opts });
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (value) => {
    resolver.current?.(value);
    resolver.current = null;
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={Boolean(state)} onClose={() => close(false)} size="sm" hideClose>
        {state && (
          <div className="pt-2 text-center sm:text-left">
            <div className={`mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl sm:mx-0 ${state.tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-brand-soft text-brand'}`}>
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </div>
            <h2 className="text-lg font-bold tracking-tight">{state.title}</h2>
            {state.description && <p className="mt-1.5 text-sm leading-6 text-muted">{state.description}</p>}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" size="sm" onClick={() => close(false)}>
                {state.cancelText}
              </Button>
              <Button variant={state.tone === 'danger' ? 'danger' : 'primary'} size="sm" onClick={() => close(true)} data-autofocus>
                {state.confirmText}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
