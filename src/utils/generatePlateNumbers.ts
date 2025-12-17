/**
 * 產生 CAT-00001 ~ CAT-99999，排除含有數字 4 的號碼
 */
export function generatePlateNumbers(): string[] {
  const plates: string[] = [];
  for (let i = 896; i <= 9999; i++) {
    const numStr = i.toString().padStart(4, '0');
    if (numStr.includes('4')) continue;
    plates.push(`CAT-${numStr}`);
  }
  return plates;
}
