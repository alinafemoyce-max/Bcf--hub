import { DatabaseZap } from 'lucide-react';
import { Card, CardContent } from './ui/card';

export function DatabaseUnavailable({ message }: { message: string }) {
  return (
    <Card className="mx-auto max-w-xl">
      <CardContent className="flex gap-4">
        <DatabaseZap className="size-8 shrink-0 text-warn" aria-hidden />
        <div>
          <h2 className="font-semibold text-navy">The order database is not available</h2>
          <p className="mt-1 text-sm text-muted">{message}</p>
          <p className="mt-2 text-sm text-muted">See “Deployment” in the README for set-up steps.</p>
        </div>
      </CardContent>
    </Card>
  );
}
