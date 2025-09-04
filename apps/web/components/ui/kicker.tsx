export function Kicker({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`text-xs uppercase tracking-wide text-muted-foreground ${className}`}>
      {children}
    </div>
  );
}
