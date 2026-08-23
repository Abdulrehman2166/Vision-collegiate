import { clsx } from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glass?: boolean;
  /** Click handler – renders as a button-like element with hover state */
  onClick?: () => void;
}

export function Card({ children, className, glass = false, onClick }: CardProps) {
  const base = glass ? 'glass-card' : 'card';
  return (
    <div
      className={clsx(
        base,
        'p-6 animate-fade-in',
        onClick && 'cursor-pointer hover:shadow-md transition-shadow duration-200',
        className,
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: number; label: string };
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
}

const colorMap = {
  blue:   'bg-blue-50   dark:bg-blue-900/20   text-blue-600   dark:text-blue-400',
  green:  'bg-green-50  dark:bg-green-900/20  text-green-600  dark:text-green-400',
  red:    'bg-red-50    dark:bg-red-900/20    text-red-600    dark:text-red-400',
  yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
  purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
};

export function StatCard({ title, value, icon, trend, color = 'blue' }: StatCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
          {trend && (
            <p className={clsx(
              'mt-1 text-xs font-medium',
              trend.value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
            )}>
              {trend.value >= 0 ? '▲' : '▼'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        {icon && (
          <div className={clsx('p-3 rounded-xl', colorMap[color])}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
