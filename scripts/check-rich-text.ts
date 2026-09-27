// Tu kiem tra bo tach hashtag / nhac ten cua bang tin: `node scripts/check-rich-text.ts`
import assert from 'node:assert/strict';
import { foldText, richText } from '../src/app/presentation/pages/client/feed/rich-text.ts';

const people = [
  { userId: 'a', name: 'Minh Anh' },
  { userId: 'b', name: 'Minh Anh Tuấn' }
];

assert.deepEqual(richText('Cảm ơn @Minh Anh Tuấn và @Minh Anh! #BóngĐá', people).map(s => [s.kind, s.value]), [
  ['text', 'Cảm ơn '],
  ['mention', '@Minh Anh Tuấn'],
  ['text', ' và '],
  ['mention', '@Minh Anh'],
  ['text', '! '],
  ['tag', '#BóngĐá']
]);
assert.equal((richText('#BóngĐá', [])[0] as { tag: string }).tag, 'bóngđá');
// Khong phai hashtag: dinh sau chu, ma thuc the HTML, qua ngan.
assert.deepEqual(richText('abc#def &#123; #a', []).map(s => s.kind), ['text']);
// Ten chi la tien to cua mot tu dai hon thi khong phai nhac ten.
assert.deepEqual(richText('@Minh Anhh', people).map(s => s.kind), ['text']);
assert.deepEqual(richText('', people), []);
assert.equal(foldText('Đặng Tuấn'), 'dang tuan');
console.log('rich-text: ok');
