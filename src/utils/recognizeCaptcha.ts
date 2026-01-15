import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import FormData from 'form-data';

/**
 * OCR API 回傳格式
 */
interface OcrResponse {
  ocr_text: string;
  min_confidence: number;
  skipped: boolean;
}

/**
 * 呼叫 OCR API 辨識驗證碼
 * @param inputPath 驗證碼原始圖片路徑
 * @param outputPath 處理後圖片路徑（保留參數以保持介面一致性，實際未使用）
 * @returns 辨識後的驗證碼字串
 * @throws 當 OCR API 回傳結果不可信或發生錯誤時拋出例外
 */
export async function recognizeCaptcha(inputPath: string, outputPath: string): Promise<string> {
  const OCR_API_URL = process.env.OCR_API_URL || 'http://127.0.0.1:2533/ocr';
  const MIN_CONFIDENCE_THRESHOLD = parseFloat(process.env.OCR_MIN_CONFIDENCE || '0.7');
  const EXPECTED_LENGTH = 4; // 驗證碼固定為 4 個字元

  try {
    // 準備 FormData
    const formData = new FormData();
    formData.append('file', fs.createReadStream(inputPath));

    // 使用原生 http/https 模組呼叫 API
    const data = await new Promise<OcrResponse>((resolve, reject) => {
      const url = new URL(OCR_API_URL);
      const protocol = url.protocol === 'https:' ? https : http;

      const req = protocol.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: 'POST',
          headers: formData.getHeaders(),
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            if (res.statusCode !== 200) {
              reject(new Error(`OCR API 錯誤: HTTP ${res.statusCode}`));
            } else {
              try {
                resolve(JSON.parse(body));
              } catch (e) {
                reject(new Error('OCR API 回應格式錯誤'));
              }
            }
          });
        }
      );

      req.on('error', reject);
      formData.pipe(req);
    });

    console.log(`OCR 結果: ${data.ocr_text}, 信心分數: ${data.min_confidence}, 跳過: ${data.skipped}`);

    // 檢查 1: 後端標記為 skipped
    if (data.skipped) {
      throw new Error(`OCR 結果不可信 (skipped=true)`);
    }

    // 檢查 2: 信心分數低於自訂閾值
    if (data.min_confidence < MIN_CONFIDENCE_THRESHOLD) {
      throw new Error(`OCR 信心分數過低: ${data.min_confidence} < ${MIN_CONFIDENCE_THRESHOLD}`);
    }

    // 檢查 3: 固定字數檢查（驗證碼應為 4 個字元）
    if (data.ocr_text.length !== EXPECTED_LENGTH) {
      throw new Error(`OCR 結果長度錯誤: ${data.ocr_text.length} ≠ ${EXPECTED_LENGTH}`);
    }

    // 確保結果為大寫
    const result = data.ocr_text.toUpperCase();

    return result;

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`驗證碼辨識失敗: ${error.message}`);
    }
    throw error;
  }
}
