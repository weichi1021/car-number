import 'dotenv/config';
import { sendLineNotify } from './utils/lineNotify';

async function testLineNotify() {
  // 發送 LINE Notify 推播（若有設定 token）
  try {
    await sendLineNotify('測試訊息通知');
  } catch (e) {
    console.log('LINE 推播失敗:', e);
  }
}

testLineNotify();
