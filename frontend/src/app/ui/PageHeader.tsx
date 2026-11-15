import type {ReactNode} from 'react';

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({eyebrow, title, description, actions}: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
      <div className="space-y-1 max-w-3xl">
        {eyebrow && (
          <p className="font-mono text-label text-earth uppercase tracking-widest">{eyebrow}</p>
        )}
        <h1 className="font-display font-semibold text-[clamp(1.5rem,2.4vw,2.25rem)] text-white tracking-wide leading-tight">
          {title}
        </h1>
        {description && (
          <p className="text-xs text-regolith/75 leading-relaxed pt-0.5">{description}</p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0">
          {actions}
        </div>
      )}
    </div>
  );
}
