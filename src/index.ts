import { generatePlateNumbers } from './utils/generatePlateNumbers';

const plates = generatePlateNumbers();
console.log('合法車牌號碼數量:', plates.length);
console.log('前 10 筆:', plates.slice(0, 10));
