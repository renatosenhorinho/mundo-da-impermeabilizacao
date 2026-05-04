// ─── Types ────────────────────────────────────────────────────────────────────

export type DateRangeKey = 'today' | '7d' | '30d' | 'month' | 'year' | 'custom';

export interface CustomDateRange {
  startDate: Date;
  endDate: Date;
}

export interface DateRangeState {
  key: DateRangeKey;
  custom?: CustomDateRange;
}

// ─── Labels ───────────────────────────────────────────────────────────────────

export const DATE_RANGE_LABELS: Record<DateRangeKey, string> = {
  today: 'Hoje',
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  month: 'Este mês',
  year: 'Este ano',
  custom: 'Personalizado',
};

// ─── Range Calculation ────────────────────────────────────────────────────────

/**
 * Returns the [start, end] Date boundaries for a given range key.
 * For 'custom', uses the provided CustomDateRange.
 */
export function getDateBounds(range: DateRangeState): [Date, Date] {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  switch (range.key) {
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return [start, end];
    }
    case '7d': {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return [start, end];
    }
    case '30d': {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      return [start, end];
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return [start, end];
    }
    case 'year': {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      return [start, end];
    }
    case 'custom': {
      if (range.custom) {
        const s = new Date(range.custom.startDate);
        s.setHours(0, 0, 0, 0);
        const e = new Date(range.custom.endDate);
        e.setHours(23, 59, 59, 999);
        return [s, e];
      }
      // Fallback to last 30 days
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      return [start, end];
    }
  }
}

// ─── Filter Helpers ───────────────────────────────────────────────────────────

/**
 * Filters an array of analytics events by date range.
 * Events use a `timestamp` (ms number) field.
 */
export function filterEventsByDateRange<T extends { timestamp: number }>(
  events: T[],
  range: DateRangeState
): T[] {
  if (!events.length) return events;
  const [start, end] = getDateBounds(range);
  const s = start.getTime();
  const e = end.getTime();
  return events.filter((ev) => ev.timestamp >= s && ev.timestamp <= e);
}

/**
 * Generic filter for any object with an ISO string date field.
 * Defaults to 'created_at' but accepts any key name.
 */
export function filterByDateRange<T extends Record<string, any>>(
  items: T[],
  range: DateRangeState,
  dateField: keyof T = 'created_at'
): T[] {
  if (!items.length) return items;
  const [start, end] = getDateBounds(range);
  const s = start.getTime();
  const e = end.getTime();
  return items.filter((item) => {
    const raw = item[dateField];
    if (!raw) return false;
    const ts = typeof raw === 'number' ? raw : new Date(raw).getTime();
    return !isNaN(ts) && ts >= s && ts <= e;
  });
}

// ─── Formatting ───────────────────────────────────────────────────────────────

/**
 * Formats a date as a human-readable relative string:
 * - "Hoje às 11:42"
 * - "Ontem às 18:20"
 * - "12/05/2026 às 14:32"
 */
export function formatRelativeDate(date: Date | string | number | null | undefined): string {
  if (!date) return 'Nunca atualizado';

  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return 'Data inválida';

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (d >= todayStart) {
    return `Hoje às ${timeStr}`;
  }
  if (d >= yesterdayStart) {
    return `Ontem às ${timeStr}`;
  }

  const dateStr = d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return `${dateStr} às ${timeStr}`;
}

/**
 * Returns the current ISO timestamp string — for use as `updated_at`.
 */
export function nowISO(): string {
  return new Date().toISOString();
}
