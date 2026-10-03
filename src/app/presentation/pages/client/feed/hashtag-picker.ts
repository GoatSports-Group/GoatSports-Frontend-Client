import { computed, signal } from '@angular/core';
import { CommunityStore } from './community.store';
import { foldText } from './rich-text';

/** Doan dang go ngay truoc con tro: "#" khong dinh sau chu/so (giong quy tac cua server), toi da 40 ky tu. */
const TAG_QUERY = /(^|[^\p{L}\p{M}\p{N}_&])#([\p{L}\p{M}\p{N}_]{0,40})$/u;

/**
 * Goi y chu de khi go "#" trong o soan bai: chu de hay dung 30 ngay qua (CommunityStore.tagPool), so khop dau tu
 * khong dau. Moi nguoi chon cung mot cach viet nen chu de de len "Noi bat" hon.
 */
export class HashtagPicker {
  readonly query = signal<string | null>(null);
  readonly index = signal(0);
  private start = 0;

  readonly options = computed<string[]>(() => {
    const query = this.query();
    if (query === null) return [];
    const folded = foldText(query);
    // Da go dung mot chu de co san thi khong can goi y nua (Enter van xuong dong binh thuong).
    return this.store.tagPool()
      .filter(tag => foldText(tag).startsWith(folded) && foldText(tag) !== folded)
      .slice(0, 6);
  });

  constructor(private readonly store: CommunityStore, readonly listId: string) {}

  optionId(index: number): string {
    return `${this.listId}-${index}`;
  }

  track(area: HTMLTextAreaElement | HTMLInputElement): void {
    const before = area.value.slice(0, area.selectionStart ?? area.value.length);
    const match = before.match(TAG_QUERY);
    if (!match) {
      this.query.set(null);
      return;
    }
    this.store.loadTagPool();
    this.start = before.length - match[2].length - 1;
    this.query.set(match[2]);
    this.index.set(0);
  }

  /** ↑/↓ chon, Enter/Tab chen, Esc dong. Tra ve true neu da xu ly phim (khi dang mo goi y). */
  keydown(event: KeyboardEvent, area: HTMLTextAreaElement | HTMLInputElement, write: (value: string) => void): boolean {
    const options = this.options();
    if (!options.length) return false;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.index.set((this.index() + step + options.length) % options.length);
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      this.pick(options[this.index()], area, write);
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      this.query.set(null);
    } else {
      return false;
    }
    event.preventDefault();
    return true;
  }

  pick(tag: string, area: HTMLTextAreaElement | HTMLInputElement, write: (value: string) => void): void {
    const caret = area.selectionStart ?? area.value.length;
    const inserted = `#${tag} `;
    write(area.value.slice(0, this.start) + inserted + area.value.slice(caret));
    this.query.set(null);
    const position = this.start + inserted.length;
    queueMicrotask(() => {
      area.focus();
      area.setSelectionRange(position, position);
    });
  }
}
