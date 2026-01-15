import 'dotenv/config';
import fs from 'fs';
import { sendLineNotify } from './utils/lineNotify';
import { formatDate } from './utils/formatDate';
import { scheduleTaskWithWindow } from './utils/scheduler';

async function scheduleSendLineNotify() {
  const notfoundPlates = JSON.parse(fs.readFileSync('notfound/notfound-all.json', 'utf-8'));
  const latestPlates = JSON.parse(fs.readFileSync('latest_plates.json', 'utf-8'));
  // 找到最新車牌在 notfound/notfound-all.json 的 index
  const lastPlate = latestPlates[latestPlates.length - 1];
  const lastIndex = notfoundPlates.indexOf(lastPlate.latest);
  const targetIdx = notfoundPlates.indexOf('CAT-2533');
  if (lastIndex !== -1 && targetIdx !== -1) {
    console.log(`目前最新: ${lastPlate.latest} (第 ${lastIndex + 1} 個)，時間: ${lastPlate.timestamp}`);
    console.log(`目標: CAT-2533，距離目標剩餘: ${targetIdx - lastIndex} 個`);
  } else {
    console.log('最新車牌號不在有效清單內，無法計算距離');
  }

  // 發送 LINE Notify 推播（若有設定 token），若訊息與上一則相同則不發送
  const notifyMsg = `【車牌通知】\n目前最新: ${lastPlate.latest} (第 ${lastIndex + 1} 個)\n時間: ${lastPlate.timestamp}\n目標: CAT-2533\n距離目標剩餘: ${targetIdx - lastIndex} 個`;
  const lastMsgPath = 'result/line_last_message.txt';
  let lastMsg = '';
  if (fs.existsSync(lastMsgPath)) {
    lastMsg = fs.readFileSync(lastMsgPath, 'utf-8').trim();
  }
  if (notifyMsg === lastMsg) {
    console.log('通知內容與上一則相同，已跳過發送');
    return;
  }
  try {
    await sendLineNotify(notifyMsg);
    // console.log('[模擬] 已發送通知，內容如下：\n', notifyMsg);
    fs.writeFileSync(lastMsgPath, notifyMsg, 'utf-8');
    console.log('已發送通知，時間:', formatDate(new Date()));
  } catch (e) {
    console.log('LINE 推播失敗:', e);
  }
}

// 使用共用 scheduler，時段 09:00-18:00，每 1 小時執行
scheduleTaskWithWindow(scheduleSendLineNotify, { startHour: 9, endHour: 23, intervalMs: 1 * 60 * 1000, immediate: true, alignToTop: false });
