/** 格式化金额为人民币字符串 */
export function formatCurrency(amount: number): string {
  if (amount > 0 && amount < 0.01) return '< ¥0.01';
  return `¥${amount.toFixed(2)}`;
}

/** 格式化 ISO 日期为 YYYY-MM-DD */
export function formatDate(dateString: string): string {
  const d = new Date(dateString);
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
