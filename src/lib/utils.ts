export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const DEALER_COLORS: Record<string, { bg: string; text: string; border: string; light: string }> = {};

const COLOR_PALETTE = [
  { bg: 'bg-blue-500', text: 'text-blue-700', border: 'border-blue-400', light: 'bg-blue-50' },
  { bg: 'bg-emerald-500', text: 'text-emerald-700', border: 'border-emerald-400', light: 'bg-emerald-50' },
  { bg: 'bg-amber-500', text: 'text-amber-700', border: 'border-amber-400', light: 'bg-amber-50' },
  { bg: 'bg-rose-500', text: 'text-rose-700', border: 'border-rose-400', light: 'bg-rose-50' },
  { bg: 'bg-cyan-500', text: 'text-cyan-700', border: 'border-cyan-400', light: 'bg-cyan-50' },
  { bg: 'bg-orange-500', text: 'text-orange-700', border: 'border-orange-400', light: 'bg-orange-50' },
  { bg: 'bg-teal-500', text: 'text-teal-700', border: 'border-teal-400', light: 'bg-teal-50' },
  { bg: 'bg-red-500', text: 'text-red-700', border: 'border-red-400', light: 'bg-red-50' },
  { bg: 'bg-sky-500', text: 'text-sky-700', border: 'border-sky-400', light: 'bg-sky-50' },
  { bg: 'bg-lime-500', text: 'text-lime-700', border: 'border-lime-400', light: 'bg-lime-50' },
  { bg: 'bg-fuchsia-500', text: 'text-fuchsia-700', border: 'border-fuchsia-400', light: 'bg-fuchsia-50' },
  { bg: 'bg-yellow-500', text: 'text-yellow-700', border: 'border-yellow-400', light: 'bg-yellow-50' },
];

let colorIndex = 0;
export function getDealerColor(dealerId: string) {
  if (!DEALER_COLORS[dealerId]) {
    DEALER_COLORS[dealerId] = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
    colorIndex++;
  }
  return DEALER_COLORS[dealerId];
}

export function assignDealerColors(dealerIds: string[]) {
  dealerIds.forEach((id, i) => {
    if (!DEALER_COLORS[id]) {
      DEALER_COLORS[id] = COLOR_PALETTE[i % COLOR_PALETTE.length];
    }
  });
}

export function formatTime(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function getWeekDates(weekOffset = 0): string[] {
  const today = new Date();
  const dayOfWeek = today.getDay();
  // Adjust so Monday = 0
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset + weekOffset * 7);

  const dates: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

export function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  // Convert: Sun=0,Mon=1...Sat=6 -> Mon=0,Tue=1...Sat=5
  return day === 0 ? 6 : day - 1;
}

export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

export function timeDiffMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

export function calculateCapacity(settings: {
  fill_speed_per_hour: number;
  morning_break_start: string;
  morning_break_duration: number;
  lunch_break_start: string;
  lunch_break_duration: number;
  day_start: string;
  day_end: string;
}): number {
  const totalMinutes = timeDiffMinutes(settings.day_start, settings.day_end);
  const breakMinutes = settings.morning_break_duration + settings.lunch_break_duration;
  const workMinutes = totalMinutes - breakMinutes;
  return Math.floor((workMinutes / 60) * settings.fill_speed_per_hour);
}

export function getEffectiveCapacity(settings: {
  fill_speed_per_hour: number;
  morning_break_start: string;
  morning_break_duration: number;
  lunch_break_start: string;
  lunch_break_duration: number;
  day_start: string;
  day_end: string;
  daily_capacity_override: number | null;
}): number {
  if (settings.daily_capacity_override != null && settings.daily_capacity_override > 0) {
    return settings.daily_capacity_override;
  }
  return calculateCapacity(settings);
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'Pending',
    arrived: 'Arrived',
    completed: 'Completed',
    no_show: 'No Show',
    scheduled: 'Scheduled',
    moved_out: 'Moved Out',
    cancelled: 'Cancelled',
    extra: 'Extra Slot',
  };
  return map[status] || status;
}

export function getChangeLabel(changeType: string | null, originalDate?: string | null, swappedWith?: string | null): string {
  if (!changeType) return '';
  if (changeType === 'moved_in' && originalDate) return `Moved from ${DAY_NAMES[getDayOfWeek(originalDate)]}`;
  if (changeType === 'moved_out') return 'Moved to another day';
  if (changeType === 'swapped' && swappedWith) return `Swapped with ${swappedWith}`;
  if (changeType === 'cancelled') return 'Cancelled';
  if (changeType === 'extra') return 'Extra Slot';
  return '';
}

export function getCurrentTimeStr(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}
