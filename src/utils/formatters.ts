/** 格式化金额为人民币字符串 */
export function formatCurrency(amount: number): string {
  if (amount > 0 && amount < 0.01) return '< ¥0.01';
  return `¥${amount.toFixed(2)}`;
}

/** 格式化 ISO 日期为 YYYY-MM-DD */
export function formatDate(dateString: string): string {
  // 绝大多数场景里，我们存的就是 YYYY-MM-DD；直接返回可避免时区解析导致的“日期偏移一天”。
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;

  // 兜底：如果传入的是其他可被 Date 解析的格式，则标准化输出。
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return dateString;

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 获取今天的 YYYY-MM-DD 字符串 */
export function getTodayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
