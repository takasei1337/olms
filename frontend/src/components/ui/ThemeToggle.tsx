import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/features/theme/ThemeContext';

export function ThemeToggle({
  showLabel = false,
  className = '',
}: {
  showLabel?: boolean;
  className?: string;
}) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Button
      type="button"
      variant="outline"
      size={showLabel ? 'sm' : 'icon'}
      onClick={toggleTheme}
      aria-label={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      title={isDark ? 'Giao diện sáng' : 'Giao diện tối'}
      className={`${showLabel ? 'gap-2 text-xs' : 'h-8 w-8'} ${className}`.trim()}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-semantic-warning" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4 text-text-secondary" aria-hidden="true" />
      )}
      {showLabel && <span>{isDark ? 'Giao diện sáng' : 'Giao diện tối'}</span>}
    </Button>
  );
}
