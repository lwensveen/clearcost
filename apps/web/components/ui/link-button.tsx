import Link from 'next/link';
import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';

type LinkButtonProps = Omit<ComponentProps<typeof Button>, 'asChild'> & { href: string };

export function LinkButton({ href, children, ...btn }: LinkButtonProps) {
  return (
    <Button asChild {...btn}>
      <Link href={href}>{children}</Link>
    </Button>
  );
}
