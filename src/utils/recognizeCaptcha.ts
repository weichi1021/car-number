import Tesseract from 'tesseract.js';

/**
 * 前處理驗證碼圖片並自動辨識
 * @param inputPath 驗證碼原始圖片路徑
 * @param outputPath 處理後圖片路徑
 * @returns 辨識後的驗證碼字串
 */
export async function recognizeCaptcha(inputPath: string, outputPath: string): Promise<string> {

  // 圖片前處理：簡化處理避免過度失真
  const { Jimp } = require('jimp');
  let image = await Jimp.read(inputPath);

  // 1. 放大圖片 2 倍（適度提升辨識精度）
  image = image.scale(3);

  // 2. 轉灰階
  image = image.greyscale();

  // 3. 增強對比
  image = image.contrast(0.3);

  // 4. 正規化
  image = image.normalize();

  // 5. 去除干擾線（8 鄰域像素過濾法，偵測較粗線條）
  const w = image.bitmap.width;
  const h = image.bitmap.height;
  // 只針對灰階圖像，將疑似粗線（深色且周圍多為亮色）設為白色
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (w * y + x) << 2;
      const thisPixel = image.bitmap.data[idx];
      // 取得 8 鄰域像素灰階值
      const neighbors = [
        image.bitmap.data[((w * (y - 1) + x) << 2)],     // 上
        image.bitmap.data[((w * (y + 1) + x) << 2)],     // 下
        image.bitmap.data[((w * y + (x - 1)) << 2)],     // 左
        image.bitmap.data[((w * y + (x + 1)) << 2)],     // 右
        image.bitmap.data[((w * (y - 1) + (x - 1)) << 2)], // 左上
        image.bitmap.data[((w * (y - 1) + (x + 1)) << 2)], // 右上
        image.bitmap.data[((w * (y + 1) + (x - 1)) << 2)], // 左下
        image.bitmap.data[((w * (y + 1) + (x + 1)) << 2)]  // 右下
      ];
      // 若該像素為深色（小於 120），且 8 鄰域有 4 個以上為亮色（大於 180），視為更粗干擾線
      const brightCount = neighbors.filter(v => v > 200).length;
      if (thisPixel < 50 && brightCount >= 4) {
        // 設為白色
        image.bitmap.data[idx] = 255;
        image.bitmap.data[idx + 1] = 255;
        image.bitmap.data[idx + 2] = 255;
      }
    }
  }

  await image.write(outputPath);

  // 自動辨識（針對 4 位大寫驗證碼優化）
  const { data: { text: rawText } } = await Tesseract.recognize(
    outputPath,
    'eng',
    ({
      logger: () => {},
      config: [
        'tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', // 只允許大寫
        'tessedit_pageseg_mode=7' // 7 = 單行文字模式
      ]
    } as any)
  );
  // 只取前 4 個字元並轉大寫
  const result = rawText.replace(/[^A-Z0-9]/g, '').trim().substring(0, 4);
  return result;
}
