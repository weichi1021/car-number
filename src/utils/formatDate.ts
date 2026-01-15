// utils/formatDate.ts
// 將日期格式化為 YYYY/MM/DD hh:mm:ss（24 小時制）
export function formatDate(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}/${mm}/${dd} ${hh}:${min}:${ss}`;
}
