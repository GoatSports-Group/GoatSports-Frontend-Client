export function formatRelativeTime(dateInput: string | Date | null | undefined, now = new Date()): string {
  if (!dateInput) return '';

  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 60_000) return 'Vừa xong';

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;

  const diffDays = Math.floor(diffHours / 24);
  return diffDays === 1 ? 'Hôm qua' : `${diffDays} ngày trước`;
}
