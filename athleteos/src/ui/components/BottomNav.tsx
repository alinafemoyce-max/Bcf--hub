import { LayoutDashboard, Dumbbell, ChartLine, History, User } from 'lucide-react';
import { useRoute } from '../router';
import { cn } from '@/lib/utils';
import { useAppData } from '../hooks/useAppData';
import { activeSession } from '../hooks/derived';

const ITEMS = [
  { to: '/', match: [undefined], label: 'Dashboard', icon: LayoutDashboard },
  { to: '/train', match: ['train', 'library'], label: 'Train', icon: Dumbbell },
  { to: '/progress', match: ['progress', 'review'], label: 'Progress', icon: ChartLine },
  { to: '/history', match: ['history'], label: 'History', icon: History },
  { to: '/profile', match: ['profile'], label: 'Profile', icon: User }
];

export function BottomNav() {
  const { segments } = useRoute();
  const data = useAppData();
  const live = activeSession(data);
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 backdrop-blur-xl pb-safe">
      {live && (
        <a href="#/train/live" className="flex h-10 items-center justify-center gap-2 bg-primary text-sm font-semibold text-primary-foreground">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> {live.name} in progress — tap to resume
        </a>
      )}
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {ITEMS.map(({ to, match, label, icon: Icon }) => {
          const active = match.includes(segments[0] as never);
          return (
            <li key={to}>
              <a
                href={`#${to}`}
                aria-current={active ? 'page' : undefined}
                className={cn('flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors', active ? 'text-accent' : 'text-muted-foreground hover:text-foreground')}
              >
                <Icon className={cn('h-6 w-6', active && 'drop-shadow-[0_0_8px_hsl(var(--accent))]')} strokeWidth={active ? 2.4 : 2} />
                {label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
