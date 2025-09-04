import Link from 'next/link';
import { Button } from '@/components/ui/button';

type LinkButtonProps = Omit<any, 'asChild'> & { href: string };

export function LinkButton({ href, children, ...btn }: LinkButtonProps) {
  return (
    <Button asChild {...btn}>
      <Link href={href}>{children}</Link>
    </Button>
  );
}
