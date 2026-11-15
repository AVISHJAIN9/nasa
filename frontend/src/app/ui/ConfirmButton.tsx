import {useState, useEffect} from 'react';

export interface ConfirmButtonProps {
  label: string;
  confirmPrompt: string;
  onConfirm: () => void;
  className?: string;
  variant?: 'danger' | 'warning' | 'primary';
}

export function ConfirmButton({
  label,
  confirmPrompt,
  onConfirm,
  className = '',
  variant = 'danger',
}: ConfirmButtonProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const variantStyles =
    variant === 'danger'
      ? 'bg-mars text-white hover:bg-mars/90 shadow-[0_0_20px_rgba(226,112,74,0.3)]'
      : variant === 'warning'
      ? 'bg-[#e0b03a] text-void hover:bg-[#e0b03a]/90'
      : 'bg-earth text-void hover:bg-earth/90';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded px-4 py-2 font-mono text-label uppercase tracking-wider font-bold transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-earth focus-visible:outline-none ${variantStyles} ${className}`}
      >
        {label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 p-4 backdrop-blur-md"
        >
          <div className="w-full max-w-md rounded-lg bg-void-2 p-6 ring-1 ring-white/15 shadow-2xl">
            <h3 className="font-display text-[1.125rem] text-white uppercase">Confirm protocol action</h3>
            <p className="mt-3 text-sm text-regolith/80 leading-relaxed">{confirmPrompt}</p>

            <div className="mt-6 flex justify-end gap-3 font-mono text-label uppercase">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded px-4 py-2 text-regolith/60 hover:text-white transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-earth focus-visible:outline-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onConfirm();
                }}
                className={`rounded px-5 py-2 font-bold min-h-[44px] focus-visible:ring-2 focus-visible:ring-earth focus-visible:outline-none ${variantStyles}`}
              >
                Confirm execution
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
