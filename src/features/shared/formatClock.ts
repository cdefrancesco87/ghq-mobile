/** «8:00» from `08:00`, in the way of the language. */
export function formatClock(time: string, language: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  return new Intl.DateTimeFormat(language, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2000, 0, 1, hours, minutes)));
}
