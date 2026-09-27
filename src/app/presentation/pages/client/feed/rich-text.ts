// Khong import gi: kiem tra duoc truc tiep bang Node (scripts/check-rich-text.ts).

// ---- Hashtag + @mention rendering ---------------------------------------------------------------

export type TextSegment =
  | { kind: 'text'; value: string }
  | { kind: 'tag'; value: string; tag: string }
  | { kind: 'mention'; value: string; userId: string };

/** Cung quy tac voi PostTags.java: "#" khong dinh sau chu/so/&, 2-40 ky tu chu/so/_. */
const TAG_SOURCE = String.raw`(?<![\p{L}\p{M}\p{N}_&])#([\p{L}\p{M}\p{N}_]{2,40})`;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Tach noi dung thanh chu thuong / hashtag / nhac ten. Nguoi duoc nhac hien trong noi dung dang
 * "@Ho Ten"; ten dai hon duoc khop truoc de "@Minh Anh" khong an mat "@Minh Anh Tuan".
 */
export function richText(content: string | null | undefined, mentions: ReadonlyArray<{ userId: string; name: string }>): TextSegment[] {
  if (!content) return [];
  const named = [...mentions].filter(item => item.name).sort((a, b) => b.name.length - a.name.length);
  const mentionSource = named.map(item => `@${escapeRegExp(item.name)}` + String.raw`(?![\p{L}\p{M}\p{N}_])`).join('|');
  const pattern = new RegExp(mentionSource ? `(${mentionSource})|${TAG_SOURCE}` : TAG_SOURCE, 'gu');
  const segments: TextSegment[] = [];
  let last = 0;
  for (const match of content.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ kind: 'text', value: content.slice(last, start) });
    const value = match[0];
    if (value.startsWith('@')) {
      const person = named.find(item => value === `@${item.name}`);
      segments.push(person ? { kind: 'mention', value, userId: person.userId } : { kind: 'text', value });
    } else {
      segments.push({ kind: 'tag', value, tag: value.slice(1).toLowerCase() });
    }
    last = start + value.length;
  }
  if (last < content.length) segments.push({ kind: 'text', value: content.slice(last) });
  return segments;
}

/** So khop khong dau, khong phan biet hoa thuong: "tuan" tim ra "Tuấn". */
export function foldText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}
