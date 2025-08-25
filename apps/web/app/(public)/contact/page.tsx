import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type SP = Record<string, string | string[] | undefined>;

export default async function ContactPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const sent =
    typeof sp.sent === 'string' ? sp.sent : Array.isArray(sp.sent) ? sp.sent[0] : undefined;

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold">Contact</h1>
      <p className="mt-2 text-muted-foreground">
        Questions, partnerships, or enterprise? Send us a note.
      </p>

      <Card className="mt-8">
        <CardContent className="p-6">
          {sent ? (
            <div className="text-sm">
              <div className="font-medium">Thanks — we’ll be in touch.</div>
              <div className="text-muted-foreground mt-1">
                You can also email{' '}
                <a className="underline" href="mailto:hello@clearcost.dev">
                  hello@clearcost.dev
                </a>
                .
              </div>
            </div>
          ) : (
            <form className="grid gap-4" action="/api/contact" method="post">
              <input
                type="text"
                name="company"
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
              />
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" required />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
              </div>
              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea id="message" name="message" rows={6} required />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Send</Button>
                <Button asChild variant="secondary">
                  <a href="mailto:hello@clearcost.dev">Email instead</a>
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
