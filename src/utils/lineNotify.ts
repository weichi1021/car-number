import https from 'https';

type LineMessage = { type: 'text'; text: string } | { type: string; [k: string]: any };

function requestLineAPI(path: string, payload: any): Promise<void> {
  const token = process.env.CHANNEL_ACCESS_TOKEN;
  if (!token) {
    return Promise.reject(new Error('未設定 CHANNEL_ACCESS_TOKEN 或 LINE_NOTIFY_TOKEN'));
  }

  const body = JSON.stringify(payload);

  const options = {
    hostname: 'api.line.me',
    path,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  } as any;

  return new Promise<void>((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (d) => chunks.push(Buffer.from(d)));
      res.on('end', () => {
        const resp = Buffer.concat(chunks).toString('utf-8');
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`LINE API 回傳錯誤: ${res.statusCode} ${resp}`));
        }
      });
    });
    req.on('error', (err) => reject(err));
    req.write(body);
    req.end();
  });
}

/**
 * ReplyMessage
 * @param msg - messages array (LineMessage[])
 * @param token - replyToken from webhook
 */
export async function ReplyMessage(msg: LineMessage[] | LineMessage, token: string): Promise<void> {
  const messages = Array.isArray(msg) ? msg : [msg];
  const payload = {
    replyToken: token,
    messages
  };
  await requestLineAPI('/v2/bot/message/reply', payload);
}

/**
 * BroadcastMsg
 * @param msg - single message object or array of messages
 */
export async function BroadcastMsg(msg: LineMessage[] | LineMessage): Promise<void> {
  const messages = Array.isArray(msg) ? msg : [msg];
  const payload = { messages };
  await requestLineAPI('/v2/bot/message/broadcast', payload);
}

/**
 * 兼容舊 sendLineNotify(message: string) 用法 — 會 broadcast 一則文字訊息
 */
export async function sendLineNotify(message: string): Promise<void> {
  const textMsg: LineMessage = { type: 'text', text: message };
  try {
    await BroadcastMsg(textMsg);
  } catch (err) {
    // 若有憑證過期或 TLS 問題，錯誤會被傳出，呼叫端可自行處理
    throw err;
  }
}
