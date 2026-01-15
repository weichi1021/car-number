/**
 * 通用時段排程工具
 * 提供：在指定時段 (含起訖小時) 內每隔 intervalMs 執行 taskFn，
 * 時段外會排程到下一個可執行的時刻。
 */
import { formatDate } from './formatDate';

export interface WindowScheduleOptions {
  startHour: number; // 包含，24 小時制
  endHour: number;   // 包含，24 小時制
  intervalMs: number;
  immediate?: boolean; // 進入時段是否立即執行一次，預設 true
  alignToTop?: boolean; // 是否對齊到下一個整點開始（整點執行），預設 false
}

export function msUntil(date: Date): number {
  return Math.max(0, date.getTime() - Date.now());
}

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [] as string[];
  if (h) parts.push(`${h} 小時`);
  if (m) parts.push(`${m} 分鐘`);
  if (sec || parts.length === 0) parts.push(`${sec} 秒`);
  return parts.join(' ');
}

function getNextWindowStart(startHour: number, endHour: number): Date {
  const now = new Date();
  const candidate = new Date(now);
  candidate.setMinutes(0, 0, 0);
  candidate.setHours(now.getHours() + 1);

  if (candidate.getHours() < startHour) {
    const d = new Date(candidate);
    d.setHours(startHour, 0, 0, 0);
    return d;
  }

  if (candidate.getHours() > endHour) {
    const d = new Date(candidate);
    d.setDate(d.getDate() + 1);
    d.setHours(startHour, 0, 0, 0);
    return d;
  }

  return candidate;
}

export function scheduleTaskWithWindow(taskFn: () => Promise<void>, opts: WindowScheduleOptions) {
  const { startHour, endHour, intervalMs, immediate = true, alignToTop = false } = opts;

  async function runTaskSafe() {
    try {
      await taskFn();
    } catch (err) {
      console.error('排程任務執行失敗:', err);
    }
  }

  async function startWindow() {
    const now = new Date();
    const hour = now.getHours();
    if (hour < startHour || hour > endHour) {
      const next = getNextWindowStart(startHour, endHour);
      console.log(`目前 ${formatDate(now)} 不在執行時段，排程在 ${formatDate(next)}`);
      setTimeout(startWindow, msUntil(next));
      return;
    }

    console.log(`進入時段 ${startHour}:00-${endHour}:00，開始每 ${Math.round(intervalMs/60000)} 分鐘執行`);

    // 預設行為：若未要求對齊整點，維持傳統間隔行為
    let iv: NodeJS.Timeout | null = null;

    const startInterval = () => {
      if (iv) clearInterval(iv as NodeJS.Timeout);
      iv = setInterval(() => {
        const h = new Date().getHours();
        if (h < startHour || h > endHour) {
          if (iv) clearInterval(iv);
          // 時段結束：排程下一次啟動
          startWindow();
          return;
        }
        runTaskSafe();
      }, intervalMs);
      const nextExec = new Date(Date.now() + intervalMs);
      console.log(`已啟動排程，每 ${Math.round(intervalMs/60000)} 分鐘執行；下一次在 ${formatDate(nextExec)}（${formatDuration(msUntil(nextExec))} 後）`);
    };

    if (!alignToTop) {
      // 原本行為：依 immediate 決定是否立即或在 interval 後開始
      if (immediate) {
        await runTaskSafe();
        startInterval();
      } else {
        startInterval();
      }
      return;
    }

    // 以下為 alignToTop === true 的行為：對齊下一個整點開始執行
    const nextTop = new Date(now);
    nextTop.setMinutes(0, 0, 0);
    if (nextTop.getTime() <= now.getTime()) {
      nextTop.setHours(nextTop.getHours() + 1);
    }
    const msToNextTop = Math.max(0, nextTop.getTime() - now.getTime());

    console.log(`距離下一次執行還有 ${formatDuration(msToNextTop)}，預定時間: ${formatDate(nextTop)}`);

    if (immediate) {
      // 立即執行一次，並排程下一個整點開始後的定時
      await runTaskSafe();
      console.log(`已立即執行一次；下一次執行預定在 ${formatDate(nextTop)}（${formatDuration(msToNextTop)} 後）`);
      setTimeout(() => {
        runTaskSafe();
        startInterval();
      }, msToNextTop);
    } else {
      // 不立即執行：在下一個整點執行一次，然後啟動定時
      console.log(`尚未立即執行，將於 ${formatDate(nextTop)}（${formatDuration(msToNextTop)} 後）開始執行`);
      setTimeout(() => {
        runTaskSafe();
        startInterval();
      }, msToNextTop);
    }
  }

  // 啟動排程管理
  startWindow();
}
