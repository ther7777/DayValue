/**
 * 计算使用天数
 * 公式：使用天数 = (endDate || 今天) - startDate + 1
 */
export function calculateDaysUsed(startDate: string, endDate: string | null): number {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

  return Math.max(diffDays, 1);
}

/**
 * 计算一次性物品的日均成本
 * 公式：日均成本 = (购买金额 - 残值) / 使用天数
 */
export function calculateDailyCost(
  price: number,
  salvageValue: number,
  daysUsed: number,
): number {
  const effectiveCost = price - salvageValue;
  if (daysUsed <= 0) return effectiveCost;
  return effectiveCost / daysUsed;
}

import type { BillingCycle } from '../types';

/**
 * 计算周期订阅的日均成本
 * monthly → cycle_price / 30
 * quarterly → cycle_price / 90
 * yearly  → cycle_price / 365
 */
export function calculateSubscriptionDailyCost(
  cyclePrice: number,
  billingCycle: BillingCycle,
): number {
  if (billingCycle === 'monthly') return cyclePrice / 30;
  if (billingCycle === 'quarterly') return cyclePrice / 90;
  return cyclePrice / 365;
}

/**
 * 计算分期物品的“每日债务”（每日消耗口径）
 * 公式：每日债务 = 月供 / 30
 */
export function calculateDailyDebt(monthlyPayment: number): number {
  return monthlyPayment / 30;
}

/**
 * 计算沉睡卡包的真实沉淀本金
 * 公式：沉淀本金 = (实际支付 / 总面值) × 当前剩余
 */
export function calculateStoredPrincipal(
  actualPaid: number,
  faceValue: number,
  currentBalance: number,
): number {
  if (faceValue <= 0) return 0;
  return (actualPaid / faceValue) * currentBalance;
}

function parseISODate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/**
 * 计算距上次更新已过去的自然日
 * 同一天返回 0，昨天返回 1
 */
export function calculateDaysSince(dateString: string): number {
  const start = parseISODate(dateString);
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(diffDays, 0);
}

/**
 * 计算分期的额外溢价（相比全款多花的饱额）
 * 公式：溢价 = 首付 + 月供 × 期数 - 总价
 */
export function calculateInstallmentPremium(
  totalPrice: number,
  downPayment: number,
  monthlyPayment: number,
  months: number,
): number {
  return Math.max(0, downPayment + monthlyPayment * months - totalPrice);
}

/**
 * 使用牵顿迭代法计算分期的真实年化利率 (IRR)
 * 返回百分比数字（如 18.5 代表 18.5%）
 * 若无溢价（免息分期）返回 0
 */
export function calculateIRR(
  totalPrice: number,
  downPayment: number,
  monthlyPayment: number,
  months: number,
): number {
  const principal = totalPrice - downPayment;
  if (principal <= 0 || monthlyPayment <= 0 || months <= 0) return 0;

  // 检查是否真实有溢价
  const premium = calculateInstallmentPremium(totalPrice, downPayment, monthlyPayment, months);
  if (premium <= 0) return 0;

  // 牵顿迭代法求月利率 r
  // f(r)  = principal * r / (1 - (1+r)^(-n)) - monthlyPayment
  // f'(r) = 导数（用商算近似）
  let r = 0.01; // 初始猜测：1% 月利
  for (let i = 0; i < 200; i++) {
    const pow = Math.pow(1 + r, months);
    const denominator = pow - 1;
    if (Math.abs(denominator) < 1e-12) break;

    // 实际计算公式： PMT = P * r * (1+r)^n / ((1+r)^n - 1)
    const f = (principal * r * pow) / denominator - monthlyPayment;
    // 导数近似
    const fprime =
      (principal * pow * (denominator - months * r)) / (denominator * denominator) +
      (principal * r * months * pow) / (denominator * (1 + r));

    if (Math.abs(fprime) < 1e-12) break;
    const rNext = r - f / fprime;
    if (Math.abs(rNext - r) < 1e-9) {
      r = rNext;
      break;
    }
    r = Math.max(rNext, 0.0001); // 防止负利率
  }

  // 月利转年化利率
  const annualRate = (Math.pow(1 + r, 12) - 1) * 100;
  return Math.round(annualRate * 100) / 100;
}
