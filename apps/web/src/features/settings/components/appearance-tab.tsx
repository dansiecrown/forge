import { Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme, type ThemePreference } from '@/contexts/theme-context';
import { cn } from '@/utils';

const OPTIONS: { value: ThemePreference; label: string; description: string }[] = [
  { value: 'system', label: 'System', description: 'Match your device setting.' },
  { value: 'dark', label: 'Dark', description: 'Always use the dark theme.' },
  { value: 'light', label: 'Light', description: 'Always use the light theme.' },
];

export function AppearanceTab() {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Theme</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          {OPTIONS.map((option) => {
            const isActive = theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                aria-pressed={isActive}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-control border px-4 py-3 text-left transition-colors duration-150',
                  isActive ? 'border-brand bg-brand/5' : 'border-border hover:bg-surface-2',
                )}
              >
                <span className="flex w-full items-center justify-between text-sm font-medium text-foreground">
                  {option.label}
                  {isActive ? <Check className="size-4 text-brand" aria-hidden="true" /> : null}
                </span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
