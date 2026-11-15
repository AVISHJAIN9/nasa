import React from 'react';

export interface PanelProps {
  title?: string;
  subtitle?: string;
  badge?: React.ReactNode;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  brackets?: boolean;
}

export function Panel({title, subtitle, badge, rightAction, children, className = '', brackets = false}: PanelProps) {
  return (
    <div
      className={`relative rounded-lg bg-void-2/70 border border-white/10 p-5 ${
        brackets ? 'brackets border-white/20' : ''
      } ${className}`}
    >
      {(title || subtitle || rightAction || badge) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
          <div className="flex items-center gap-2.5">
            {title && (
              <h3 className="font-mono text-xs uppercase tracking-wider text-regolith font-semibold">
                {title}
              </h3>
            )}
            {badge}
            {subtitle && <span className="font-mono text-[11px] text-regolith/50">{subtitle}</span>}
          </div>
          {rightAction && <div>{rightAction}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
