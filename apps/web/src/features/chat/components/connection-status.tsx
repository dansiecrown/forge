import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import type { ChatConnectionStatus } from '../hooks/use-chat-socket';
import { cn } from '@/utils';

const CONFIG: Record<ChatConnectionStatus, { label: string; icon: typeof Wifi; tone: string }> = {
  connected: { label: 'Live', icon: Wifi, tone: 'text-success' },
  connecting: { label: 'Connecting…', icon: RefreshCw, tone: 'text-muted-foreground' },
  reconnecting: { label: 'Reconnecting…', icon: RefreshCw, tone: 'text-warning' },
  disconnected: { label: 'Offline', icon: WifiOff, tone: 'text-danger' },
};

/** Never color alone — always paired with an icon and text label (Phase 10
 * accessibility: "no color-only signals"). */
export function ConnectionStatus({ status }: { status: ChatConnectionStatus }) {
  const { label, icon: Icon, tone } = CONFIG[status];
  const spinning = status === 'connecting' || status === 'reconnecting';
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-xs font-medium', tone)}
      role="status"
      aria-live="polite"
    >
      <Icon className={cn('size-3.5', spinning && 'animate-spin')} aria-hidden="true" />
      {label}
    </span>
  );
}
