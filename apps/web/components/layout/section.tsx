import * as React from 'react';

type SectionProps = {
  title?: string;
  description?: string;
  /** Right-aligned inline content (e.g., filters) */
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function Section({ title, description, actions, children, className = '' }: SectionProps) {
  const hasHeader = title || description || actions;
  return (
    <section className={`space-y-3 ${className}`}>
      {hasHeader && (
        <div className="flex items-end justify-between gap-3">
          <div>
            {title ? <h2 className="font-medium">{title}</h2> : null}
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
