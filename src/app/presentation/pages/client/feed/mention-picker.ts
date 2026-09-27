import { computed, signal } from '@angular/core';
import { Mention } from '@application/dto/social-feed/social-feed.dto';
import { CommunityStore } from './community.store';
import { foldText } from './rich-text';

/** Doan dang go ngay truoc con tro: "@" o dau dong hoac sau khoang trang, toi da 30 ky tu, chua xuong dong. */
const MENTION_QUERY = /(^|\s)@([^@\n]{0,30})$/u;
const MAX_MENTIONS = 20;

export interface MentionOption {
  userId: string;
  name: string;
  avatar: string;
}

/**
 * Goi y @nhac ten cho mot o nhap (bai viet, binh luan). Nguon: ban be + nguoi dang theo doi, so khop
 * khong dau. Luu userId → dung ten da chen, de server giu duoc link ke ca khi nguoi do doi ten sau nay.
 */
export class MentionPicker {
  readonly query = signal<string | null>(null);
  readonly index = signal(0);
  private readonly picked = signal<ReadonlyMap<string, string>>(new Map());
  private start = 0;
  private namesLoaded = false;

  readonly options = computed<MentionOption[]>(() => {
    const query = this.query();
    if (query === null) return [];
    const me = this.selfId();
    const folded = foldText(query.trim());
    const pool = new Set([...this.store.friendIds(), ...this.store.followingIds()]);
    return [...pool]
      .filter(id => id !== me)
      .map(userId => ({ userId, name: this.store.authorName(userId), avatar: this.store.avatar(userId) }))
      .filter(person => !folded || foldText(person.name).includes(folded))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
      .slice(0, 6);
  });

  /** @param listId id cua listbox (duy nhat tren trang) cho aria-controls / aria-activedescendant. */
  constructor(
    private readonly store: CommunityStore,
    private readonly selfId: () => string | null,
    readonly listId: string
  ) {}

  optionId(index: number): string {
    return `${this.listId}-${index}`;
  }

  /** Nap lai danh sach da nhac (sua bai / binh luan co san). */
  reset(initial: readonly Mention[] = []): void {
    this.picked.set(new Map(initial.map(item => [item.userId, item.name])));
    this.query.set(null);
  }

  /** Goi sau moi lan go / di chuyen con tro: mo hoac dong goi y. */
  track(area: HTMLTextAreaElement | HTMLInputElement): void {
    const before = area.value.slice(0, area.selectionStart ?? area.value.length);
    const match = before.match(MENTION_QUERY);
    if (!match || this.picked().size >= MAX_MENTIONS) {
      this.query.set(null);
      return;
    }
    if (!this.namesLoaded) {
      this.namesLoaded = true;
      this.store.hydrateAuthors([...this.store.friendIds(), ...this.store.followingIds()]);
    }
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

  pick(person: MentionOption, area: HTMLTextAreaElement | HTMLInputElement, write: (value: string) => void): void {
    const caret = area.selectionStart ?? area.value.length;
    const inserted = `@${person.name} `;
    write(area.value.slice(0, this.start) + inserted + area.value.slice(caret));
    this.picked.update(current => new Map(current).set(person.userId, person.name));
    this.query.set(null);
    const position = this.start + inserted.length;
    queueMicrotask(() => {
      area.focus();
      area.setSelectionRange(position, position);
    });
  }

  /** Chi nguoi con "@Ten" trong noi dung (xoa chu thi bo nhac). */
  mentionsFor(text: string): Mention[] {
    return [...this.picked()].filter(([, name]) => text.includes(`@${name}`)).map(([userId, name]) => ({ userId, name }));
  }
}
