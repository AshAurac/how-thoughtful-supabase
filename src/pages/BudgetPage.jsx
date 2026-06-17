import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format, parseISO, isValid } from 'date-fns';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { daysUntil } from '@/lib/dateUtils';

export default function BudgetPage({ user }) {
  const queryClient = useQueryClient();

  const { onTouchStart, onTouchMove, onTouchEnd, indicatorRef } = usePullToRefresh(async () => {
    await queryClient.invalidateQueries({ queryKey: ['events'] });
    await queryClient.invalidateQueries({ queryKey: ['gifts'] });
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events', user?.email],
    queryFn: () => base44.entities.Event.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  const { data: gifts = [] } = useQuery({
    queryKey: ['gifts', user?.email],
    queryFn: () => base44.entities.Gift.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  const totalBudget = events.reduce((s, e) => s + (e.budget || 0), 0);
  const totalSpent = gifts.reduce((s, g) => s + (g.price || 0) + (g.shipping_cost || 0), 0);
  const remaining = Math.max(0, totalBudget - totalSpent);

  // Monthly spend
  const monthlyMap = {};
  gifts.forEach(g => {
    const date = parseISO(g.created_date);
    if (!isValid(date)) return;
    const key = format(date, 'MMM');
    monthlyMap[key] = (monthlyMap[key] || 0) + (g.price || 0);
  });
  const monthlyData = Object.entries(monthlyMap).map(([month, amount]) => ({ month, amount }));

  // Upcoming 30 days spend
  const upcoming30 = events
    .filter(e => {
      const days = daysUntil(e.event_date);
      if (days === null) return false;
      return days >= 0 && days <= 30;
    })
    .reduce((s, e) => s + (e.budget || 0), 0);

  return (
    <div
      className="space-y-5"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div ref={indicatorRef} className="flex justify-center pointer-events-none" style={{ opacity: 0, transition: 'opacity 0.2s', marginBottom: '-1.5rem' }}>
        <div className="w-6 h-6 border-2 border-terracotta/40 border-t-terracotta rounded-full animate-spin" />
      </div>
      <div>
        <p className="font-accent text-muted-foreground text-lg">where the love goes</p>
        <h1 className="font-heading font-bold text-2xl text-foreground">Budget</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-1 font-medium">Total budget</p>
          <p className="font-heading font-bold text-2xl text-foreground">${totalBudget.toFixed(0)}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-1 font-medium">Spent so far</p>
          <p className="font-heading font-bold text-2xl text-terracotta">${totalSpent.toFixed(0)}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-1 font-medium">Remaining</p>
          <p className="font-heading font-bold text-2xl text-moss">${remaining.toFixed(0)}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-1 font-medium">Next 30 days</p>
          <p className="font-heading font-bold text-2xl text-butter-dark">${upcoming30.toFixed(0)}</p>
        </div>
      </div>

      {/* Progress bar */}
      {totalBudget > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Budget used</span>
            <span className="text-foreground font-medium">{Math.round((totalSpent / totalBudget) * 100)}%</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-terracotta rounded-full transition-all"
              style={{ width: `${Math.min(100, (totalSpent / totalBudget) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Monthly chart */}
      {monthlyData.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <h2 className="font-heading font-semibold text-foreground mb-4">Monthly spend</h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6B6E85' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#6B6E85' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'white', border: '1px solid #EAE7DF', borderRadius: '12px', fontSize: 12 }}
                cursor={{ fill: '#F4EFE3' }}
              />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                {monthlyData.map((_, i) => (
                  <Cell key={i} fill="#E07A5F" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
