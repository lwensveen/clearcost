import * as React from 'react';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  /** Right-aligned actions (buttons/links) */
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, actions, className = '' }: PageHeaderProps) {
  return (
    <div
      className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
