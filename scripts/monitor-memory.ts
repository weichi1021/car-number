/**
 * 記憶體監控工具
 * 用於追蹤爬蟲程式的記憶體使用狀況
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface MemoryStats {
  timestamp: string;
  rss: number; // 實體記憶體 (MB)
  heapUsed: number; // 堆積記憶體使用 (MB)
  heapTotal: number; // 堆積記憶體總量 (MB)
  external: number; // C++ 物件記憶體 (MB)
}

function formatBytes(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(2);
}

function getMemoryUsage(): MemoryStats {
  const mem = process.memoryUsage();
  const timestamp = new Date().toISOString();
  
  return {
    timestamp,
    rss: parseFloat(formatBytes(mem.rss)),
    heapUsed: parseFloat(formatBytes(mem.heapUsed)),
    heapTotal: parseFloat(formatBytes(mem.heapTotal)),
    external: parseFloat(formatBytes(mem.external)),
  };
}

function printMemoryStats(stats: MemoryStats) {
  console.log(`[${stats.timestamp}]`);
  console.log(`  RSS (實體記憶體): ${stats.rss} MB`);
  console.log(`  Heap Used: ${stats.heapUsed} MB`);
  console.log(`  Heap Total: ${stats.heapTotal} MB`);
  console.log(`  External: ${stats.external} MB`);
  console.log('---');
}

async function getProcessMemory(processName: string): Promise<number | null> {
  try {
    const { stdout } = await execAsync(`ps aux | grep "${processName}" | grep -v grep | awk '{sum+=$6} END {print sum}'`);
    const kb = parseInt(stdout.trim());
    return isNaN(kb) ? null : kb / 1024; // 轉換為 MB
  } catch (e) {
    return null;
  }
}

// 監控模式：每 10 秒記錄一次記憶體狀態
async function startMonitoring(intervalSec: number = 10) {
  console.log('開始記憶體監控...\n');
  
  const stats: MemoryStats[] = [];
  let count = 0;
  
  const interval = setInterval(async () => {
    count++;
    const stat = getMemoryUsage();
    stats.push(stat);
    
    console.log(`\n===== 第 ${count} 次記錄 =====`);
    printMemoryStats(stat);
    
    // 檢查記憶體增長趨勢
    if (stats.length >= 5) {
      const first = stats[stats.length - 5];
      const last = stats[stats.length - 1];
      const growth = last.rss - first.rss;
      const growthRate = ((growth / first.rss) * 100).toFixed(2);
      
      if (growth > 0) {
        console.log(`⚠️  過去 5 次記錄記憶體增長: +${growth.toFixed(2)} MB (${growthRate}%)`);
      } else {
        console.log(`✅ 過去 5 次記錄記憶體穩定或下降: ${growth.toFixed(2)} MB (${growthRate}%)`);
      }
    }
    
    // 檢查 Node.js 進程整體記憶體
    const totalMem = await getProcessMemory('node');
    if (totalMem) {
      console.log(`📊 所有 Node.js 進程總記憶體: ${totalMem.toFixed(2)} MB`);
    }
    
  }, intervalSec * 1000);
  
  // 優雅關閉
  process.on('SIGINT', () => {
    console.log('\n\n停止監控...');
    clearInterval(interval);
    
    // 輸出統計摘要
    if (stats.length > 0) {
      const first = stats[0];
      const last = stats[stats.length - 1];
      console.log('\n===== 記憶體監控摘要 =====');
      console.log(`監控時間: ${stats.length * intervalSec} 秒`);
      console.log(`起始 RSS: ${first.rss} MB`);
      console.log(`結束 RSS: ${last.rss} MB`);
      console.log(`總增長: ${(last.rss - first.rss).toFixed(2)} MB`);
      console.log(`平均增長率: ${(((last.rss - first.rss) / first.rss) * 100).toFixed(2)}%`);
    }
    
    process.exit(0);
  });
}

// 執行監控
const intervalSec = parseInt(process.argv[2]) || 10;
startMonitoring(intervalSec);
