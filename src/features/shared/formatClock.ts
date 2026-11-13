/** «8:00» from `08:00`, in the way of the language. */
export function formatClock(time: string, language: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  return new Intl.DateTimeFormat(language, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2000, 0, 1, hours, minutes)));
}

const pad = (value: number) => String(value).padStart(2, '0');

/** `HH:MM` of the time chosen in a picker, in the time of the phone. */
export function timeOf(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
