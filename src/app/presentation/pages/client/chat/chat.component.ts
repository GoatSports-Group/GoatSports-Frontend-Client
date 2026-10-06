import { PAGE_SIZE } from '@shared/constants/page-size';
import { AfterViewChecked, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subscription, finalize, map, of, switchMap, tap } from 'rxjs';
import { CHAT_REPOSITORY_TOKEN } from '@application/ports/persistence/chat.repository';
import { FRIEND_REPOSITORY_TOKEN } from '@application/ports/persistence/friend.repository';
import { WEBSOCKET_SERVICE_TOKEN } from '@application/ports/websocket.service';
import { CURRENT_USER_PROVIDER_TOKEN } from '@application/ports/current-user.provider';
import {
  ChatMessage,
  ChatMessageAttachment,
  ChatParticipant,
  ChatPresenceEvent,
  ChatRoom,
  ChatRoomType,
  ChatTypingEvent,
  MessageType
} from '@application/dto/chat/chat.dto';
import { Friendship } from '@application/dto/friend/friend.dto';
import { User } from '@application/dto/user/user.dto';
import { PLAYER_SPORT_PROFILE_REPOSITORY_TOKEN } from '@application/ports/persistence/player-sport-profile.repository';
import { STORAGE_REPOSITORY_TOKEN } from '@application/ports/persistence/storage.repository';
import { LightboxItem } from '@presentation/pages/client/feed/media-lightbox.component';
import { CHAT_MAX_BYTES, CHAT_MAX_IMAGES, CHAT_IMAGE_TYPES, prepareImage } from './image-prep';
import { NotifyService } from '@shared/components/notify/notify.service';
import { PlayerDirectoryService } from '@presentation/services/player-directory.service';
import { ClubRepositoryPort } from '@application/ports/club.repository.port';
import { ClubRole } from '@domain/models/club.model';

const SPORT_LABELS: Record<string, string> = {
  FOOTBALL: 'Bóng đá',
  BADMINTON: 'Cầu lông',
  TENNIS: 'Tennis',
  PICKLEBALL: 'Pickleball',
  BASKETBALL: 'Bóng rổ',
  VOLLEYBALL: 'Bóng chuyền'
};

type RoomFilter = 'ALL' | 'UNREAD' | 'GROUP' | 'CLUB';

const MESSAGE_PAGE = PAGE_SIZE.chat;
const ROOM_PAGE = PAGE_SIZE.streamLight;
/** So thanh vien hien san trong khung thong tin; con lai mo popup "Xem tat ca". */
const MEMBER_PREVIEW = 5;
const CLUB_ROLE_LABEL: Record<ClubRole, string> = { OWNER: 'Chủ CLB', ADMIN: 'Quản trị viên', MEMBER: 'Thành viên' };
const CLUB_ROLE_ORDER: Record<ClubRole, number> = { OWNER: 0, ADMIN: 1, MEMBER: 2 };

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
  standalone: false
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesScroll') private scrollContainer?: ElementRef<HTMLElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly chatRepo = inject(CHAT_REPOSITORY_TOKEN);
  private readonly friendRepo = inject(FRIEND_REPOSITORY_TOKEN);
  private readonly wsService = inject(WEBSOCKET_SERVICE_TOKEN);
  private readonly userProvider = inject(CURRENT_USER_PROVIDER_TOKEN);
  private readonly notifyService = inject(NotifyService);
  private readonly playerDirectory = inject(PlayerDirectoryService);
  private readonly sportProfileRepo = inject(PLAYER_SPORT_PROFILE_REPOSITORY_TOKEN);
  private readonly clubRepo = inject(ClubRepositoryPort);
  private readonly storageRepo = inject(STORAGE_REPOSITORY_TOKEN);

  // ---- anh ------------------------------------------------------------------------------------
  /** Anh dang cho gui (chon tu may, dan tu clipboard hoac chup tu camera). */
  readonly draftImages = signal<{ file: File; previewUrl: string }[]>([]);
  readonly preparingImages = signal(false);
  readonly cameraOpen = signal(false);
  /** Khoa R2 → URL doc duoc (URL ky han cho thu muc rieng tu chat-messages). */
  readonly imageUrls = signal<ReadonlyMap<string, string>>(new Map());
  readonly lightbox = signal<{ items: LightboxItem[]; start: number } | null>(null);
  readonly maxImages = CHAT_MAX_IMAGES;
  readonly imageAccept = CHAT_IMAGE_TYPES.join(',') + ',image/heic,image/heif';
  /** Tep cua tin dang gui, de "Gui lai" khong phai chon lai anh. */
  private readonly outgoingFiles = new Map<string, File[]>();
  /** Khoa da tai len cua tin gui loi, de gui lai khong tai len lan hai. */
  private readonly uploadedKeys = new Map<string, string[]>();
  private readonly localPreviewUrls = new Set<string>();
  private readonly requestedImageKeys = new Set<string>();

  readonly rooms = signal<ChatRoom[]>([]);
  readonly activeRoom = signal<ChatRoom | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly loadingRooms = signal(true);
  readonly roomsLoadFailed = signal(false);
  readonly loadingMessages = signal(false);
  readonly messagesLoadFailed = signal(false);
  readonly roomFilter = signal<RoomFilter>('ALL');
  readonly typingByRoom = signal<Record<string, ChatTypingEvent[]>>({});
  readonly presenceByUser = signal<Record<string, ChatPresenceEvent>>({});
  readonly contextPanelOpen = signal(false);
  readonly now = signal(Date.now());
  readonly showNewGroupModal = signal(false);
  readonly groupFriends = signal<Friendship[]>([]);
  readonly loadingGroupFriends = signal(false);
  readonly selectedMemberIds = signal<ReadonlySet<string>>(new Set());
  readonly creatingGroup = signal(false);

  readonly ChatRoomType = ChatRoomType;
  readonly quickReplies = ['Chào bạn!', 'Mình hẹn mấy giờ nhỉ?', 'Chốt sân nhé!'];
  readonly counterpart = signal<ChatParticipant | null>(null);
  readonly counterpartProfile = signal<User | null>(null);
  readonly counterpartSports = signal<{ label: string; shared: boolean }[]>([]);
  readonly contextActionLoading = signal(false);
  /** Chan nguoi dung: xac nhan ngay trong khung thong tin thay cho window.confirm. */
  readonly confirmBlock = signal(false);
  /** Doan chat dang cho xac nhan "Xoa" (menu ⋯ o danh sach hoac khung thong tin). */
  readonly deleteTarget = signal<ChatRoom | null>(null);
  readonly deleting = signal(false);
  /** Popup danh sach day du thanh vien. */
  readonly membersOpen = signal(false);
  /** Vai tro trong CLB (doan chat CLB): userId -> OWNER / ADMIN / MEMBER, lay tu club-service. */
  readonly clubRoles = signal<ReadonlyMap<string, ClubRole>>(new Map());
  readonly memberPreview = MEMBER_PREVIEW;
  readonly roomFilters: ReadonlyArray<{ value: RoomFilter; label: string }> = [
    { value: 'ALL', label: 'Tất cả' },
    { value: 'UNREAD', label: 'Chưa đọc' },
    { value: 'GROUP', label: 'Nhóm' },
    { value: 'CLUB', label: 'Câu lạc bộ' }
  ];
  private mySportTypes: ReadonlySet<string> = new Set();
  currentUserId = '';
  searchRoomQuery = '';
  messageInput = '';
  newGroupName = '';

  private typing = false;
  private typingTimeout?: ReturnType<typeof setTimeout>;
  private readonly remoteTypingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private relativeTimeInterval?: ReturnType<typeof setInterval>;
  private shouldScrollBottom = false;
  /** Chieu cao cu cua khung tin nhan khi chen tin cu len dau; giu nguyen vi tri dang doc. */
  private keepScrollFrom: { height: number; top: number } | null = null;
  private roomsPage = 0;
  readonly hasOlderMessages = signal(false);
  readonly loadingOlderMessages = signal(false);
  /** Dang xem mot doan giua lich su (mo tai tin chua doc): con tin moi hon o duoi, cuon xuong de tai. */
  readonly hasNewerMessages = signal(false);
  readonly loadingNewerMessages = signal(false);
  /** Tin chua doc dau tien luc mo doan chat: vach "Tin nhan chua doc" dat truoc no. */
  readonly firstUnreadId = signal<string | null>(null);
  /** Tin den qua WebSocket khi nguoi dung chua o cuoi lich su (chua chen vao danh sach). */
  readonly newBelow = signal(0);
  /** Nut ↓ ve tin moi nhat: hien khi cuon xa day hoac con tin moi hon chua tai. */
  readonly showJump = signal(false);
  private scrollToUnread = false;
  readonly hasMoreRooms = signal(false);
  readonly loadingMoreRooms = signal(false);
  private requestedRoomId: string | null = null;
  private messageRequestSequence = 0;
  private readonly subscriptions: Subscription[] = [];

  constructor() {
    // Moi khi danh sach tin doi (tai lich su, tin moi qua WebSocket, tin vua gui), lay URL cho anh moi.
    effect(() => {
      const messages = this.messages();
      untracked(() => this.resolveImageUrls(messages));
    });
  }

  ngOnInit(): void {
    this.currentUserId = this.userProvider.getCurrentUserId() || '';
    this.loadMySportTypes();
    this.wsService.connect();
    this.listenToWebSocket();
    this.relativeTimeInterval = setInterval(() => this.now.set(Date.now()), 30_000);

    this.subscriptions.push(this.route.paramMap.subscribe(params => {
      this.requestedRoomId = params.get('roomId');
      if (this.requestedRoomId && !this.loadingRooms()) {
        this.selectRoomById(this.requestedRoomId);
      }
    }));
    this.loadRooms();
  }

  ngAfterViewChecked(): void {
    const element = this.scrollContainer?.nativeElement;
    if (this.keepScrollFrom && element) {
      element.scrollTop = element.scrollHeight - this.keepScrollFrom.height + this.keepScrollFrom.top;
      this.keepScrollFrom = null;
    }
    if (this.scrollToUnread && element) {
      const divider = element.querySelector<HTMLElement>('.unread-divider');
      if (divider) {
        // Dat vach gan dau khung (cach 24px), do bang toa do thuc te de khong phu thuoc offsetParent.
        element.scrollTop += divider.getBoundingClientRect().top - element.getBoundingClientRect().top - 24;
        this.scrollToUnread = false;
        this.shouldScrollBottom = false;
        return;
      }
    }
    if (!this.shouldScrollBottom) return;
    this.scrollToBottom();
    this.shouldScrollBottom = false;
  }

  ngOnDestroy(): void {
    this.rooms().forEach(room => this.wsService.unsubscribeFromRoom(room.roomId));
    this.onTypingStop();
    this.remoteTypingTimeouts.forEach(timeout => clearTimeout(timeout));
    this.remoteTypingTimeouts.clear();
    if (this.relativeTimeInterval) clearInterval(this.relativeTimeInterval);
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.draftImages().forEach(item => URL.revokeObjectURL(item.previewUrl));
    this.localPreviewUrls.forEach(url => URL.revokeObjectURL(url));
  }

  get filteredRooms(): ChatRoom[] {
    const query = this.searchRoomQuery.trim().toLowerCase();
    return this.rooms().filter(room => {
      const matchesQuery = !query ||
        (room.name || '').toLowerCase().includes(query) ||
        (room.lastMessage || '').toLowerCase().includes(query);
      const matchesFilter = this.roomFilter() === 'ALL' ||
        (this.roomFilter() === 'UNREAD' && room.unreadCount > 0) ||
        (this.roomFilter() === 'GROUP' && room.type === ChatRoomType.GROUP) ||
        (this.roomFilter() === 'CLUB' && room.type === ChatRoomType.CLUB);
      return matchesQuery && matchesFilter;
    });
  }

  loadRooms(): void {
    this.loadingRooms.set(true);
    this.roomsLoadFailed.set(false);
    this.roomsPage = 0;
    this.hasMoreRooms.set(false);
    this.chatRepo.getUserRooms(0, ROOM_PAGE).pipe(
      tap(response => this.hasMoreRooms.set((response.data?.length ?? 0) === ROOM_PAGE)),
      switchMap(response => this.enrichRooms(response.data || [])),
      finalize(() => this.loadingRooms.set(false))
    ).subscribe({
      next: rooms => {
        this.rooms.set(this.sortRooms(rooms));
        this.rooms().forEach(room => this.wsService.subscribeToRoom(room.roomId));
        this.loadPresenceForRooms(rooms);
        if (this.requestedRoomId) {
          this.selectRoomById(this.requestedRoomId);
        } else if (!this.activeRoom() && this.rooms().length && this.showsListAndThread()) {
          // Chi mo san hoi thoai dau tien khi danh sach va noi dung nam canh nhau; tren dien thoai mo san se
          // che mat danh sach (va danh dau da doc mot hoi thoai nguoi dung chua he xem).
          this.selectRoom(this.rooms()[0], false);
        }
      },
      error: () => this.roomsLoadFailed.set(true)
    });
  }

  /** Cuon toi cuoi danh sach hoi thoai: tai them mot trang, bo trung (phong moi co the day trang). */
  loadMoreRooms(): void {
    if (this.loadingMoreRooms() || !this.hasMoreRooms()) return;
    this.loadingMoreRooms.set(true);
    const page = this.roomsPage + 1;
    this.chatRepo.getUserRooms(page, ROOM_PAGE).pipe(
      tap(response => this.hasMoreRooms.set((response.data?.length ?? 0) === ROOM_PAGE)),
      switchMap(response => this.enrichRooms(response.data || [])),
      finalize(() => this.loadingMoreRooms.set(false))
    ).subscribe({
      next: rooms => {
        const known = new Set(this.rooms().map(room => room.roomId));
        const fresh = rooms.filter(room => !known.has(room.roomId));
        this.roomsPage = page;
        this.rooms.update(current => this.sortRooms([...current, ...fresh]));
        fresh.forEach(room => this.wsService.subscribeToRoom(room.roomId));
        this.loadPresenceForRooms(fresh);
      },
      error: () => this.hasMoreRooms.set(false)
    });
  }

  selectRoomById(roomId: string): void {
    const found = this.rooms().find(room => room.roomId === roomId);
    if (found) {
      this.selectRoom(found, false);
      return;
    }

    this.chatRepo.getRoomDetails(roomId).pipe(
      switchMap(response => this.enrichRooms(response.data ? [response.data] : []))
    ).subscribe({
      next: rooms => {
        const room = rooms[0];
        if (!room) return;
        this.rooms.update(items => this.sortRooms([room, ...items.filter(item => item.roomId !== roomId)]));
        this.wsService.subscribeToRoom(room.roomId);
        this.loadPresenceForRooms([room]);
        this.selectRoom(room, false);
      },
      error: () => {
        this.notifyService.error('Không thể mở cuộc trò chuyện này.');
        void this.router.navigate(['/chat']);
      }
    });
  }

  selectRoom(room: ChatRoom, updateRoute = true): void {
    if (this.activeRoom()?.roomId === room.roomId) return;

    this.onTypingStop();
    this.activeRoom.set(room);
    this.contextPanelOpen.set(false);
    this.confirmBlock.set(false);
    this.membersOpen.set(false);
    this.loadCounterpartContext(room);
    this.loadClubRoles(room);
    this.wsService.subscribeToRoom(room.roomId);
    // Danh dau da doc SAU khi tai xong: server can biet tin chua doc dau tien de mo dung cho do.
    this.loadMessages(room.roomId, room.unreadCount > 0);
    if (room.unreadCount > 0) this.updateRoom(room.roomId, { unreadCount: 0 });
    if (updateRoute) void this.router.navigate(['/chat', room.roomId]);
  }

  /** Cung diem gay voi chat.component.scss (820px): tren do danh sach va noi dung hien canh nhau. */
  private showsListAndThread(): boolean {
    return typeof matchMedia === 'undefined' || matchMedia('(min-width: 821px)').matches;
  }

  backToRooms(): void {
    this.onTypingStop();
    this.activeRoom.set(null);
    this.messages.set([]);
    this.contextPanelOpen.set(false);
    void this.router.navigate(['/chat']);
  }

  setRoomFilter(filter: RoomFilter): void {
    this.roomFilter.set(filter);
  }

  toggleContextPanel(): void {
    this.contextPanelOpen.update(open => !open);
  }

  /**
   * Mo doan chat. Co tin chua doc thi mo tai tin chua doc dau tien (vach "Tin nhan chua doc", vai tin cu lam ngu
   * canh), khong thi tai trang moi nhat. Cuon len tai tin cu hon, cuon xuong tai tin moi hon (khi dang o giua).
   */
  loadMessages(roomId: string, atUnread = false): void {
    const sequence = ++this.messageRequestSequence;
    const localPending = this.messages().filter(message =>
      message.roomId === roomId && message.deliveryState !== 'SENT'
    );
    this.loadingMessages.set(true);
    this.messagesLoadFailed.set(false);
    this.messages.set([]);
    this.hasOlderMessages.set(false);
    this.hasNewerMessages.set(false);
    this.firstUnreadId.set(null);
    this.newBelow.set(0);
    this.showJump.set(false);
    this.keepScrollFrom = null;

    const window$ = atUnread
      ? this.chatRepo.getUnreadWindow(roomId, MESSAGE_PAGE)
      : this.chatRepo.getMessagesByCursor(roomId, {}, MESSAGE_PAGE).pipe(map(messages => ({
        messages, firstUnreadMessageId: null, hasOlder: messages.length === MESSAGE_PAGE, hasNewer: false
      })));
    window$.pipe(
      finalize(() => {
        if (sequence === this.messageRequestSequence) this.loadingMessages.set(false);
      })
    ).subscribe({
      next: window => {
        if (sequence !== this.messageRequestSequence || this.activeRoom()?.roomId !== roomId) return;
        const savedMessages = [...window.messages].reverse();
        this.hasOlderMessages.set(window.hasOlder);
        this.hasNewerMessages.set(window.hasNewer);
        this.showJump.set(window.hasNewer);
        this.firstUnreadId.set(window.firstUnreadMessageId);
        const unmatchedPending = window.hasNewer ? [] : localPending.filter(pending =>
          !savedMessages.some(saved => saved.clientMessageId === pending.clientMessageId)
        );
        this.messages.set(this.sortMessages([...savedMessages, ...unmatchedPending]));
        if (window.firstUnreadMessageId) this.scrollToUnread = true;
        else this.shouldScrollBottom = true;
        if (atUnread) this.chatRepo.markRoomAsRead(roomId).subscribe({ error: () => undefined });
      },
      error: () => {
        if (sequence === this.messageRequestSequence) this.messagesLoadFailed.set(true);
      }
    });
  }

  /** Cuon len dau khung tin nhan: tai tin cu hon tin dau tien dang co va giu nguyen cho dang doc. */
  loadOlderMessages(): void {
    const room = this.activeRoom();
    const oldest = this.messages().find(message => message.deliveryState !== 'SENDING' && message.deliveryState !== 'FAILED');
    if (!room || !oldest || this.loadingOlderMessages() || !this.hasOlderMessages()) return;
    this.loadingOlderMessages.set(true);
    const sequence = this.messageRequestSequence;
    this.chatRepo.getMessagesByCursor(room.roomId, { before: oldest.createdAt }, MESSAGE_PAGE).pipe(
      finalize(() => this.loadingOlderMessages.set(false))
    ).subscribe({
      next: page => {
        if (sequence !== this.messageRequestSequence) return;
        const known = new Set(this.messages().map(message => message.messageId));
        const fresh = [...page].reverse().filter(message => !known.has(message.messageId));
        const element = this.scrollContainer?.nativeElement;
        if (element) this.keepScrollFrom = { height: element.scrollHeight, top: element.scrollTop };
        this.hasOlderMessages.set(page.length === MESSAGE_PAGE);
        this.messages.update(current => this.sortMessages([...fresh, ...current]));
      },
      error: () => this.hasOlderMessages.set(false)
    });
  }

  /** Cuon xuong cuoi khi dang xem giua lich su: tai tin moi hon tin cuoi dang co. */
  loadNewerMessages(): void {
    const room = this.activeRoom();
    const list = this.messages();
    const newest = list[list.length - 1];
    if (!room || !newest || this.loadingNewerMessages() || !this.hasNewerMessages()) return;
    this.loadingNewerMessages.set(true);
    const sequence = this.messageRequestSequence;
    this.chatRepo.getMessagesByCursor(room.roomId, { after: newest.createdAt }, MESSAGE_PAGE).pipe(
      finalize(() => this.loadingNewerMessages.set(false))
    ).subscribe({
      next: page => {
        if (sequence !== this.messageRequestSequence) return;
        const known = new Set(this.messages().map(message => message.messageId));
        const fresh = [...page].reverse().filter(message => !known.has(message.messageId));
        const reachedEnd = page.length < MESSAGE_PAGE;
        this.hasNewerMessages.set(!reachedEnd);
        if (reachedEnd) this.newBelow.set(0);
        this.messages.update(current => this.sortMessages([...current, ...fresh]));
        this.onMessagesScroll();
      },
      error: () => this.hasNewerMessages.set(false)
    });
  }

  /** Nut ↓: con tin moi hon chua tai thi tai lai trang moi nhat, khong thi cuon xuong day. */
  jumpToLatest(): void {
    const room = this.activeRoom();
    if (!room) return;
    if (this.hasNewerMessages()) {
      this.loadMessages(room.roomId);
      return;
    }
    this.scrollContainer?.nativeElement.scrollTo({ top: this.scrollContainer.nativeElement.scrollHeight, behavior: 'smooth' });
  }

  onMessagesScroll(): void {
    const element = this.scrollContainer?.nativeElement;
    if (!element) return;
    const farFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight > 480;
    this.showJump.set(this.hasNewerMessages() || farFromBottom);
  }

  get canSend(): boolean {
    return !this.preparingImages() && (!!this.messageInput.trim() || this.draftImages().length > 0);
  }

  sendMessage(): void {
    const content = this.messageInput.trim();
    const room = this.activeRoom();
    const images = this.draftImages();
    if ((!content && !images.length) || !room || this.preparingImages()) return;

    const clientMessageId = crypto.randomUUID();
    // Ca nhom anh di trong MOT tin nhan, nguoi nhan thay mot luoi anh chu khong phai N tin rieng.
    images.forEach(item => this.localPreviewUrls.add(item.previewUrl));
    if (images.length) this.outgoingFiles.set(clientMessageId, images.map(item => item.file));
    const optimisticMessage: ChatMessage = {
      messageId: `pending-${clientMessageId}`,
      clientMessageId,
      roomId: room.roomId,
      senderId: this.currentUserId,
      senderName: this.userProvider.getCurrentUserName() || 'Bạn',
      senderAvatar: this.userProvider.getCurrentUserAvatar() || undefined,
      content,
      type: images.length ? MessageType.IMAGE : MessageType.TEXT,
      deliveryState: 'SENDING',
      attachments: images.map((item, index) => ({
        attachmentId: `local-${clientMessageId}-${index}`,
        storageKey: '',
        type: 'IMAGE' as const,
        fileName: item.file.name,
        fileSize: item.file.size,
        previewUrl: item.previewUrl
      })),
      receipts: [],
      createdAt: new Date().toISOString()
    };

    this.messageInput = '';
    this.draftImages.set([]);
    this.onTypingStop();
    // Dang xem giua lich su: ve trang moi nhat; tin dang gui duoc giu lai (loadMessages giu tin chua luu).
    if (this.hasNewerMessages()) {
      this.messages.update(items => [...items, optimisticMessage]);
      this.loadMessages(room.roomId);
    } else {
      this.insertMessage(optimisticMessage);
    }
    this.updateRoomFromMessage(optimisticMessage);
    this.dispatchMessage(optimisticMessage);
  }

  // ---- chon / chup anh ------------------------------------------------------------------------

  onPickImages(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    void this.addImages(files);
  }

  /** Dan anh tu clipboard (chup man hinh, sao chep anh) vao o soan tin. */
  onPaste(event: ClipboardEvent): void {
    const files = Array.from(event.clipboardData?.files ?? []).filter(file => file.type.startsWith('image/'));
    if (!files.length) return;
    event.preventDefault();
    void this.addImages(files);
  }

  openCamera(): void {
    if (this.draftImages().length >= CHAT_MAX_IMAGES) {
      this.notifyService.warning(`Mỗi tin nhắn gửi tối đa ${CHAT_MAX_IMAGES} ảnh.`);
      return;
    }
    this.cameraOpen.set(true);
  }

  onCaptured(file: File): void {
    this.cameraOpen.set(false);
    void this.addImages([file]);
  }

  removeDraftImage(index: number): void {
    const item = this.draftImages()[index];
    if (item) URL.revokeObjectURL(item.previewUrl);
    this.draftImages.update(items => items.filter((_, i) => i !== index));
  }

  imageUrl(attachment: ChatMessageAttachment): string {
    return (attachment.storageKey && this.imageUrls().get(attachment.storageKey)) || attachment.previewUrl || '';
  }

  /** URL ky han het han (tab mo lau) hoac anh chua kip chuyen khoi temp/: xin lai mot lan. */
  onImageError(attachment: ChatMessageAttachment): void {
    const key = attachment.storageKey;
    if (!key || !this.requestedImageKeys.has(key)) return;
    this.requestedImageKeys.delete(key);
    setTimeout(() => this.resolveImageUrls(this.messages(), true), 1500);
  }

  openLightbox(message: ChatMessage, index: number): void {
    const items = message.attachments
      .filter(item => item.type === 'IMAGE' && this.imageUrl(item))
      .map(item => ({ url: this.imageUrl(item), type: 'IMAGE' as const }));
    if (items.length) this.lightbox.set({ items, start: Math.min(index, items.length - 1) });
  }

  private async addImages(files: File[]): Promise<void> {
    const images = files.filter(file => file.type.startsWith('image/'));
    if (images.length < files.length) this.notifyService.warning('Chỉ gửi được tệp ảnh.');
    const room = CHAT_MAX_IMAGES - this.draftImages().length;
    if (!images.length) return;
    if (room <= 0) {
      this.notifyService.warning(`Mỗi tin nhắn gửi tối đa ${CHAT_MAX_IMAGES} ảnh.`);
      return;
    }
    if (images.length > room) this.notifyService.warning(`Chỉ thêm ${room} ảnh đầu tiên (tối đa ${CHAT_MAX_IMAGES} ảnh mỗi tin).`);

    this.preparingImages.set(true);
    try {
      const prepared: { file: File; previewUrl: string }[] = [];
      for (const file of images.slice(0, room)) {
        try {
          const ready = await prepareImage(file);
          if (ready.size > CHAT_MAX_BYTES) {
            this.notifyService.warning(`Ảnh ${file.name} vẫn lớn hơn 10 MB sau khi nén.`);
            continue;
          }
          prepared.push({ file: ready, previewUrl: URL.createObjectURL(ready) });
        } catch {
          this.notifyService.warning(`Không đọc được ảnh ${file.name}.`);
        }
      }
      this.draftImages.update(items => [...items, ...prepared]);
    } finally {
      this.preparingImages.set(false);
    }
  }

  private resolveImageUrls(messages: readonly ChatMessage[], force = false): void {
    const keys = [...new Set(messages.flatMap(message => message.attachments ?? [])
      .filter(item => item.type === 'IMAGE' && item.storageKey)
      .map(item => item.storageKey))]
      .filter(key => force ? !this.requestedImageKeys.has(key) : !this.requestedImageKeys.has(key) && !this.imageUrls().has(key));
    keys.forEach(key => {
      this.requestedImageKeys.add(key);
      this.storageRepo.getFileUrl(key).subscribe({
        next: url => this.imageUrls.update(current => new Map(current).set(key, url)),
        error: () => this.requestedImageKeys.delete(key)
      });
    });
  }

  retryMessage(message: ChatMessage): void {
    if (message.deliveryState !== 'FAILED' || !message.clientMessageId) return;
    this.patchMessage(message, { deliveryState: 'SENDING' });
    this.dispatchMessage({ ...message, deliveryState: 'SENDING' });
  }

  onInputKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  onTyping(): void {
    const room = this.activeRoom();
    if (!room) return;
    if (!this.messageInput.trim()) {
      this.onTypingStop();
      return;
    }
    if (!this.typing) {
      this.typing = true;
      this.wsService.sendTyping(room.roomId, true);
    }
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => this.onTypingStop(), 2500);
  }

  onTypingStop(): void {
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = undefined;
    }
    const room = this.activeRoom();
    if (!room || !this.typing) return;
    this.typing = false;
    this.wsService.sendTyping(room.roomId, false);
  }

  getTypingParticipants(roomId: string): ChatTypingEvent[] {
    return this.typingByRoom()[roomId] || [];
  }

  getTypingLabel(roomId: string): string {
    const participants = this.getTypingParticipants(roomId);
    if (!participants.length) return '';
    if (participants.length === 1) return `${this.getTypingParticipantName(roomId, participants[0])} đang nhập`;
    if (participants.length === 2) {
      return `${this.getTypingParticipantName(roomId, participants[0])} và ${this.getTypingParticipantName(roomId, participants[1])} đang nhập`;
    }
    return `${this.getTypingParticipantName(roomId, participants[0])} và ${participants.length - 1} người khác đang nhập`;
  }

  getTypingAvatar(event: ChatTypingEvent): string {
    return this.findRoom(event.roomId)?.participants.find(participant => participant.userId === event.senderId)?.userAvatar ||
      'assets/images/default-avatar.svg';
  }

  getTypingParticipantName(roomId: string, event: ChatTypingEvent): string {
    const room = this.findRoom(roomId);
    const participantName = room?.participants
      .find(participant => participant.userId === event.senderId)
      ?.userName
      ?.trim();
    if (participantName) return participantName;

    if (room && this.isPairRoom(room) && event.senderId !== this.currentUserId) {
      const roomName = room.name?.trim();
      if (roomName) return roomName;
    }

    return event.senderName?.trim() || 'Một thành viên';
  }

  isUserOnline(userId: string): boolean {
    return userId === this.currentUserId || Boolean(this.presenceByUser()[userId]?.online);
  }

  getPresenceLabel(userId: string): string {
    this.now();
    if (this.isUserOnline(userId)) return 'Đang hoạt động';
    const lastSeenAt = this.presenceByUser()[userId]?.lastSeenAt;
    if (!lastSeenAt) return 'Ngoại tuyến';

    const elapsed = Math.max(0, Date.now() - new Date(lastSeenAt).getTime());
    const minutes = Math.floor(elapsed / 60_000);
    if (minutes < 1) return 'Hoạt động vừa xong';
    if (minutes < 60) return `Hoạt động ${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hoạt động ${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `Hoạt động ${days} ngày trước`;
    return `Hoạt động ${new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(lastSeenAt))}`;
  }

  getRoomHeaderMeta(room: ChatRoom): string {
    if (this.isPairRoom(room)) {
      const counterpart = this.getDirectCounterpart(room);
      return counterpart ? this.getPresenceLabel(counterpart.userId) : 'Trò chuyện trực tiếp';
    }
    const onlineCount = room.participants.filter(participant => this.isUserOnline(participant.userId)).length;
    return `${room.participants.length} thành viên · ${onlineCount} đang hoạt động`;
  }

  /**
   * Thông tin hồ sơ của đối phương hiển thị ở panel phải. Chỉ dựng từ dữ liệu
   * auth-service thực sự trả về — hồ sơ hiện chưa có ngày sinh, nơi ở hay nghề nghiệp.
   */
  readonly counterpartFacts = computed<{ icon: string; label: string }[]>(() => {
    const person = this.counterpartProfile();
    if (!person) return [];
    const facts: { icon: string; label: string }[] = [];
    const gender = this.genderLabel(person.gender);
    if (gender) facts.push({ icon: 'user', label: gender });
    if (person.country) facts.push({ icon: 'map-pin', label: person.country });
    if (person.role?.name) facts.push({ icon: 'award', label: this.roleLabel(person.role.name) });
    if (person.createdAt) {
      const joined = new Date(person.createdAt);
      if (!Number.isNaN(joined.getTime())) {
        facts.push({
          icon: 'calendar-check',
          label: `Tham gia ${new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(joined)}`
        });
      }
    }
    return facts;
  });

  isRoomMuted(room: ChatRoom): boolean {
    return !!room.muted;
  }

  /** Luu o server: doan chat da tat thong bao khong day tin vao kenh rieng, nen khong hien bong bong chat. */
  toggleRoomMute(room: ChatRoom): void {
    const muted = !room.muted;
    this.updateRoom(room.roomId, { muted });
    this.chatRepo.setMuted(room.roomId, muted).subscribe({
      next: () => this.notifyService.success(muted
        ? 'Đã tắt thông báo. Tin nhắn mới của đoạn chat này sẽ không hiện bong bóng.'
        : 'Đã bật lại thông báo cho đoạn chat này.'),
      error: () => {
        this.updateRoom(room.roomId, { muted: !muted });
        this.notifyService.error('Không cập nhật được thông báo. Vui lòng thử lại.');
      }
    });
  }

  /** Chan xong van o lai doan chat: o soan tin doi thanh thong bao "Ban da chan…" kem nut Bo chan. */
  blockCounterpart(person: ChatParticipant): void {
    const room = this.activeRoom();
    const name = person.userName || 'người chơi này';
    this.confirmBlock.set(false);
    this.contextActionLoading.set(true);
    this.friendRepo.blockUser({ blockedUserId: person.userId }).pipe(
      finalize(() => this.contextActionLoading.set(false))
    ).subscribe({
      next: () => {
        this.notifyService.success(`Đã chặn ${name}.`);
        if (room) this.updateRoom(room.roomId, { blockState: 'BLOCKED_BY_ME' });
      },
      error: () => this.notifyService.error('Không thể chặn người dùng này. Vui lòng thử lại.')
    });
  }

  unblockCounterpart(person: ChatParticipant): void {
    const room = this.activeRoom();
    this.contextActionLoading.set(true);
    this.friendRepo.getBlockedUsers().pipe(
      switchMap(response => {
        const block = (response.data ?? []).find(item => item.blockedUserId === person.userId);
        return block ? this.friendRepo.unblockUser(block.blockId) : of(null);
      }),
      finalize(() => this.contextActionLoading.set(false))
    ).subscribe({
      next: () => {
        this.notifyService.success(`Đã bỏ chặn ${person.userName || 'người chơi này'}.`);
        if (room) this.updateRoom(room.roomId, { blockState: null });
      },
      error: () => this.notifyService.error('Không bỏ chặn được. Vui lòng thử lại.')
    });
  }

  confirmDelete(room: ChatRoom): void {
    this.deleteTarget.set(room);
  }

  closeDelete(): void {
    if (!this.deleting()) this.deleteTarget.set(null);
  }

  /** Xoa phia minh: an khoi danh sach va xoa lich su voi minh; nguoi kia khong doi, tin moi lam doan chat hien lai. */
  deleteRoom(): void {
    const room = this.deleteTarget();
    if (!room || this.deleting()) return;
    this.deleting.set(true);
    this.chatRepo.clearRoom(room.roomId).pipe(finalize(() => this.deleting.set(false))).subscribe({
      next: () => {
        this.deleteTarget.set(null);
        this.rooms.update(items => items.filter(item => item.roomId !== room.roomId));
        if (this.activeRoom()?.roomId === room.roomId) this.backToRooms();
        this.notifyService.success('Đã xóa đoạn chat ở phía bạn.');
      },
      error: () => this.notifyService.error('Không xóa được đoạn chat. Vui lòng thử lại.')
    });
  }

  /** Thanh vien da sap xep: CLB theo vai tro (chu, quan tri, thanh vien), roi nguoi dang hoat dong. */
  sortedMembers(room: ChatRoom): ChatParticipant[] {
    const roles = this.clubRoles();
    return [...room.participants].sort((left, right) => {
      const byRole = (CLUB_ROLE_ORDER[roles.get(left.userId) ?? 'MEMBER']) - (CLUB_ROLE_ORDER[roles.get(right.userId) ?? 'MEMBER']);
      if (byRole) return byRole;
      return Number(this.isUserOnline(right.userId)) - Number(this.isUserOnline(left.userId));
    });
  }

  clubRoleLabel(room: ChatRoom, userId: string): string {
    if (room.type !== ChatRoomType.CLUB) return '';
    const role = this.clubRoles().get(userId);
    return role ? CLUB_ROLE_LABEL[role] : '';
  }

  isClubManager(userId: string): boolean {
    const role = this.clubRoles().get(userId);
    return role === 'OWNER' || role === 'ADMIN';
  }

  /** Dòng phụ dưới tên ở header: bối cảnh của hội thoại, không phải trạng thái online. */
  getRoomContextLine(room: ChatRoom): string {
    if (room.type === ChatRoomType.MATCH) return 'Kèo đấu đã ghép qua GOAT AI';
    if (room.type === ChatRoomType.CLUB) return 'Kênh trao đổi của câu lạc bộ';
    if (room.type === ChatRoomType.TOURNAMENT) return 'Kênh trao đổi của giải đấu';
    if (room.type === ChatRoomType.DIRECT) return 'Trò chuyện riêng';
    return `${room.participants.length} thành viên trong nhóm`;
  }

  getRoomMeta(room: ChatRoom): string {
    if (this.isPairRoom(room)) return 'Chưa có tin nhắn nào';
    return `${room.participantIds.length} thành viên`;
  }

  /** Hội thoại giữa đúng hai người: chat riêng hoặc kèo 1-1. */
  isPairRoom(room: ChatRoom): boolean {
    return (room.type === ChatRoomType.DIRECT || room.type === ChatRoomType.MATCH)
      && room.participants.length === 2;
  }

  getRoomBadge(room: ChatRoom): string {
    if (room.type === ChatRoomType.MATCH) return 'Kèo';
    if (room.type === ChatRoomType.CLUB) return 'CLB';
    if (room.type === ChatRoomType.TOURNAMENT) return 'Giải';
    if (room.type !== ChatRoomType.DIRECT) return 'Nhóm';
    return '';
  }

  /** Người gửi cuối là mình thì nói rõ, giống chuẩn của các ứng dụng nhắn tin. */
  getRoomPreview(room: ChatRoom): string {
    if (!room.lastMessage) return this.getRoomMeta(room);
    return room.lastSenderId === this.currentUserId ? `Bạn: ${room.lastMessage}` : room.lastMessage;
  }

  /** Hôm nay hiện giờ, hôm qua hiện chữ, xa hơn hiện ngày — tránh mọi dòng cùng "11:50". */
  getRoomTimeLabel(room: ChatRoom): string {
    const timestamp = room.lastMessageAt || room.updatedAt;
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    const days = this.daysFromToday(date);
    if (days === 0) return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(date);
    if (days === 1) return 'Hôm qua';
    if (days < 7) return new Intl.DateTimeFormat('vi-VN', { weekday: 'short' }).format(date);
    return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(date);
  }

  /** Nhãn ngăn cách ngày, chỉ hiện ở tin nhắn đầu tiên của mỗi ngày. */
  getDaySeparator(index: number): string {
    const list = this.messages();
    const current = list[index];
    if (!current) return '';
    const currentDate = new Date(current.createdAt);
    if (Number.isNaN(currentDate.getTime())) return '';
    const previous = list[index - 1];
    if (previous && this.isSameDay(new Date(previous.createdAt), currentDate)) return '';

    const days = this.daysFromToday(currentDate);
    const fullDate = new Intl.DateTimeFormat('vi-VN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(currentDate);
    if (days === 0) return `Hôm nay, ${fullDate}`;
    if (days === 1) return `Hôm qua, ${fullDate}`;
    const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'long' }).format(currentDate);
    return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${fullDate}`;
  }

  /** Tin cuối trong một chuỗi liên tiếp của cùng người gửi — chỗ gắn avatar và giờ. */
  isLastOfGroup(index: number): boolean {
    const list = this.messages();
    const current = list[index];
    const next = list[index + 1];
    if (!current) return true;
    if (!next || next.senderId !== current.senderId) return true;
    if (!this.isSameDay(new Date(current.createdAt), new Date(next.createdAt))) return true;
    return new Date(next.createdAt).getTime() - new Date(current.createdAt).getTime() > 5 * 60_000;
  }

  /** Tin đầu trong chuỗi — chỗ hiện tên người gửi ở hội thoại nhóm. */
  isFirstOfGroup(index: number): boolean {
    const list = this.messages();
    const current = list[index];
    const previous = list[index - 1];
    if (!current) return true;
    if (!previous || previous.senderId !== current.senderId) return true;
    if (!this.isSameDay(new Date(previous.createdAt), new Date(current.createdAt))) return true;
    return new Date(current.createdAt).getTime() - new Date(previous.createdAt).getTime() > 5 * 60_000;
  }

  sendQuickReply(content: string): void {
    this.messageInput = content;
    this.sendMessage();
  }

  isDirectRoomOnline(room: ChatRoom): boolean {
    const counterpart = this.getDirectCounterpart(room);
    return Boolean(counterpart && this.isUserOnline(counterpart.userId));
  }

  private isSameDay(left: Date, right: Date): boolean {
    return left.getFullYear() === right.getFullYear()
      && left.getMonth() === right.getMonth()
      && left.getDate() === right.getDate();
  }

  private daysFromToday(date: Date): number {
    const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
    return Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  }

  getMessageDeliveryLabel(message: ChatMessage): string {
    if (message.deliveryState === 'SENDING') return 'Đang gửi';
    if (message.deliveryState === 'FAILED') return 'Gửi thất bại';
    if (message.status === 'READ' || message.isRead) return 'Đã xem';
    if (message.status === 'DELIVERED') return 'Đã nhận';
    return 'Đã gửi';
  }

  openGroupModal(): void {
    this.showNewGroupModal.set(true);
    if (this.groupFriends().length || this.loadingGroupFriends()) return;

    this.loadingGroupFriends.set(true);
    this.friendRepo.getFriends().pipe(
      switchMap(response => this.enrichFriendships(response.data || [])),
      finalize(() => this.loadingGroupFriends.set(false))
    ).subscribe({
      next: friends => this.groupFriends.set(friends),
      error: () => this.notifyService.error('Không thể tải danh sách bạn bè để tạo nhóm.')
    });
  }

  closeGroupModal(): void {
    if (this.creatingGroup()) return;
    this.showNewGroupModal.set(false);
    this.newGroupName = '';
    this.selectedMemberIds.set(new Set());
  }

  toggleGroupMember(friendship: Friendship): void {
    const targetId = this.getFriendId(friendship);
    this.selectedMemberIds.update(items => {
      const next = new Set(items);
      next.has(targetId) ? next.delete(targetId) : next.add(targetId);
      return next;
    });
  }

  createGroup(): void {
    const name = this.newGroupName.trim();
    if (!name) {
      this.notifyService.error('Vui lòng nhập tên nhóm trò chuyện.');
      return;
    }
    if (this.selectedMemberIds().size < 2) {
      this.notifyService.error('Vui lòng chọn ít nhất 2 người bạn để tạo nhóm.');
      return;
    }

    const selectedFriends = this.groupFriends().filter(friendship =>
      this.selectedMemberIds().has(this.getFriendId(friendship))
    );
    const participants = [
      {
        userId: this.currentUserId,
        userName: this.userProvider.getCurrentUserName() ?? undefined,
        userAvatar: this.userProvider.getCurrentUserAvatar() ?? undefined
      },
      ...selectedFriends.map(friendship => ({
        userId: this.getFriendId(friendship),
        userName: this.getFriendName(friendship),
        userAvatar: this.getFriendAvatar(friendship)
      }))
    ];

    this.creatingGroup.set(true);
    this.chatRepo.createGroupRoom({ name, participants }).pipe(
      finalize(() => this.creatingGroup.set(false))
    ).subscribe({
      next: response => {
        if (!response.data) return;
        this.showNewGroupModal.set(false);
        this.newGroupName = '';
        this.selectedMemberIds.set(new Set());
        this.rooms.update(items => this.sortRooms([response.data, ...items]));
        this.wsService.subscribeToRoom(response.data.roomId);
        this.loadPresenceForRooms([response.data]);
        this.selectRoom(response.data);
        this.notifyService.success('Đã tạo nhóm trò chuyện.');
      },
      error: () => this.notifyService.error('Không thể tạo nhóm trò chuyện. Vui lòng thử lại.')
    });
  }

  getFriendId(friendship: Friendship): string {
    return friendship.requesterId === this.currentUserId ? friendship.addresseeId : friendship.requesterId;
  }

  getFriendName(friendship: Friendship): string {
    return friendship.requesterId === this.currentUserId
      ? (friendship.addresseeName || 'Người chơi GoatSports')
      : (friendship.requesterName || 'Người chơi GoatSports');
  }

  getFriendAvatar(friendship: Friendship): string {
    return (friendship.requesterId === this.currentUserId
      ? friendship.addresseeAvatar
      : friendship.requesterAvatar) || 'assets/images/default-avatar.svg';
  }

  useDefaultAvatar(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith('/assets/images/default-avatar.svg')) {
      image.src = 'assets/images/default-avatar.svg';
    }
  }

  getMessageSenderName(message: ChatMessage): string {
    return message.senderName ||
      this.activeRoom()?.participants.find(item => item.userId === message.senderId)?.userName ||
      'Thành viên';
  }

  getMessageSenderAvatar(message: ChatMessage): string {
    return message.senderAvatar ||
      this.activeRoom()?.participants.find(item => item.userId === message.senderId)?.userAvatar ||
      'assets/images/default-avatar.svg';
  }

  /** Tin co anh: tai ca nhom anh len R2 (thu muc chat-messages) roi gui mot tin mang du khoa anh. */
  private dispatchMessage(message: ChatMessage): void {
    const key = message.clientMessageId ?? message.messageId;
    const files = this.outgoingFiles.get(key) ?? [];
    const cached = this.uploadedKeys.get(key);
    const keys$: Observable<string[]> = !files.length
      ? of([])
      : cached ? of(cached) : this.storageRepo.uploadImages(files, 'chat-messages');

    keys$.pipe(
      switchMap(storageKeys => {
        if (files.length) this.uploadedKeys.set(key, storageKeys);
        return this.chatRepo.sendMessage(message.roomId, {
          clientMessageId: message.clientMessageId,
          content: message.content,
          type: message.type,
          attachments: storageKeys.map((storageKey, index) => ({
            storageKey,
            type: 'IMAGE' as const,
            fileName: files[index]?.name,
            fileSize: files[index]?.size
          }))
        });
      })
    ).subscribe({
      next: response => {
        if (!response.data) return;
        this.outgoingFiles.delete(key);
        this.uploadedKeys.delete(key);
        // Giu anh cuc bo cho den khi URL that tai xong, de luoi anh khong nhay trang.
        const saved = {
          ...response.data,
          attachments: response.data.attachments.map((item, index) => ({
            ...item,
            previewUrl: message.attachments[index]?.previewUrl
          }))
        };
        this.reconcileMessage(saved);
        this.updateRoomFromMessage(saved);
      },
      error: () => {
        this.patchMessage(message, { deliveryState: 'FAILED' });
        this.refreshBlockState(message.roomId);
        this.notifyService.error(files.length
          ? 'Ảnh chưa gửi được. Bạn có thể bấm "Gửi lại" ngay trên tin nhắn.'
          : 'Tin nhắn chưa gửi được. Bạn có thể thử lại ngay trên tin nhắn.');
      }
    });
  }

  private listenToWebSocket(): void {
    this.subscriptions.push(this.wsService.chatMessages$.subscribe(message => {
      this.removeTypingParticipant(message.roomId, message.senderId);
      if (this.activeRoom()?.roomId === message.roomId && this.hasNewerMessages() && message.senderId !== this.currentUserId) {
        this.newBelow.update(count => count + 1);
        this.chatRepo.markRoomAsRead(message.roomId).subscribe({ error: () => undefined });
      } else if (this.activeRoom()?.roomId === message.roomId) {
        this.reconcileMessage(message);
        if (message.senderId !== this.currentUserId) {
          this.chatRepo.markRoomAsRead(message.roomId).subscribe({ error: () => undefined });
        }
      }
      this.updateRoomFromMessage(message);
    }));

    this.subscriptions.push(this.wsService.typingEvents$.subscribe(event => {
      if (event.senderId !== this.currentUserId) this.updateTypingEvent(event);
    }));

    this.subscriptions.push(this.wsService.presenceEvents$.subscribe(event => {
      this.presenceByUser.update(items => ({ ...items, [event.userId]: event }));
    }));
  }

  private updateTypingEvent(event: ChatTypingEvent): void {
    const timerKey = `${event.roomId}:${event.senderId}`;
    const existingTimeout = this.remoteTypingTimeouts.get(timerKey);
    if (existingTimeout) clearTimeout(existingTimeout);
    const followTyping = this.activeRoom()?.roomId === event.roomId && this.isMessagesNearBottom();

    this.typingByRoom.update(state => {
      const roomTyping = (state[event.roomId] || []).filter(item => item.senderId !== event.senderId);
      return {
        ...state,
        [event.roomId]: event.isTyping ? [...roomTyping, event] : roomTyping
      };
    });

    if (!event.isTyping) {
      this.remoteTypingTimeouts.delete(timerKey);
      return;
    }

    if (followTyping) this.shouldScrollBottom = true;

    this.remoteTypingTimeouts.set(timerKey, setTimeout(() => {
      this.removeTypingParticipant(event.roomId, event.senderId);
    }, 4500));
  }

  private removeTypingParticipant(roomId: string, senderId: string): void {
    const timerKey = `${roomId}:${senderId}`;
    const timeout = this.remoteTypingTimeouts.get(timerKey);
    if (timeout) clearTimeout(timeout);
    this.remoteTypingTimeouts.delete(timerKey);
    this.typingByRoom.update(state => ({
      ...state,
      [roomId]: (state[roomId] || []).filter(item => item.senderId !== senderId)
    }));
  }

  private findRoom(roomId: string): ChatRoom | undefined {
    const active = this.activeRoom();
    if (active?.roomId === roomId) return active;
    return this.rooms().find(room => room.roomId === roomId);
  }

  private isMessagesNearBottom(): boolean {
    const element = this.scrollContainer?.nativeElement;
    if (!element) return false;
    return element.scrollHeight - element.scrollTop - element.clientHeight < 120;
  }

  private insertMessage(message: ChatMessage): void {
    const duplicate = this.messages().some(item =>
      item.messageId === message.messageId ||
      (message.clientMessageId && item.clientMessageId === message.clientMessageId)
    );
    if (duplicate) return;
    this.messages.update(items => this.sortMessages([...items, message]));
    this.shouldScrollBottom = true;
  }

  private reconcileMessage(message: ChatMessage): void {
    const savedMessage = { ...message, deliveryState: 'SENT' as const };
    const index = this.messages().findIndex(item =>
      item.messageId === message.messageId ||
      (message.clientMessageId && item.clientMessageId === message.clientMessageId)
    );
    if (index < 0) {
      this.insertMessage(savedMessage);
      return;
    }
    this.messages.update(items => items.map((item, itemIndex) =>
      itemIndex === index ? savedMessage : item
    ));
    this.shouldScrollBottom = true;
  }

  private patchMessage(message: ChatMessage, changes: Partial<ChatMessage>): void {
    this.messages.update(items => items.map(item =>
      item.messageId === message.messageId ||
      (message.clientMessageId && item.clientMessageId === message.clientMessageId)
        ? { ...item, ...changes }
        : item
    ));
  }

  private updateRoomFromMessage(message: ChatMessage): void {
    const room = this.rooms().find(item => item.roomId === message.roomId);
    if (!room) {
      this.loadRooms();
      return;
    }

    const isActive = this.activeRoom()?.roomId === message.roomId;
    const images = message.attachments?.length ?? 0;
    this.updateRoom(message.roomId, {
      lastMessage: message.content || (images === 1 ? 'Đã gửi một ảnh' : images > 1 ? `Đã gửi ${images} ảnh` : ''),
      lastMessageAt: message.createdAt,
      lastSenderId: message.senderId,
      unreadCount: !isActive && message.senderId !== this.currentUserId
        ? room.unreadCount + 1
        : room.unreadCount
    });
  }

  private updateRoom(roomId: string, changes: Partial<ChatRoom>): void {
    this.rooms.update(items => this.sortRooms(items.map(item =>
      item.roomId === roomId ? { ...item, ...changes } : item
    )));
    if (this.activeRoom()?.roomId === roomId) {
      this.activeRoom.update(room => room ? { ...room, ...changes } : room);
    }
  }

  private sortRooms(rooms: ChatRoom[]): ChatRoom[] {
    return [...rooms].sort((left, right) => {
      const leftTime = new Date(left.lastMessageAt || left.updatedAt || left.createdAt).getTime();
      const rightTime = new Date(right.lastMessageAt || right.updatedAt || right.createdAt).getTime();
      return rightTime - leftTime;
    });
  }

  private sortMessages(messages: ChatMessage[]): ChatMessage[] {
    return [...messages].sort((left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    );
  }

  private loadPresenceForRooms(rooms: ChatRoom[]): void {
    const userIds = [...new Set(rooms.flatMap(room => room.participantIds))]
      .filter(userId => userId && userId !== this.currentUserId);
    if (!userIds.length) return;

    this.chatRepo.getPresence(userIds).subscribe({
      next: response => {
        const updates = Object.fromEntries((response.data || []).map(status => [status.userId, status]));
        this.presenceByUser.update(items => ({ ...items, ...updates }));
      },
      error: () => undefined
    });
  }

  private getDirectCounterpart(room: ChatRoom) {
    return room.participants.find(participant => participant.userId !== this.currentUserId);
  }

  private loadCounterpartContext(room: ChatRoom): void {
    const person = this.isPairRoom(room) ? this.getDirectCounterpart(room) : undefined;
    this.counterpart.set(person ?? null);
    this.counterpartProfile.set(null);
    this.counterpartSports.set([]);
    if (!person) return;

    this.playerDirectory.resolve([person.userId]).subscribe({
      next: directory => this.counterpartProfile.set(directory.get(person.userId) ?? null),
      error: () => undefined
    });

    this.sportProfileRepo.getProfilesOf(person.userId).subscribe({
      next: profiles => this.counterpartSports.set(profiles.map(profile => ({
        label: SPORT_LABELS[profile.sportType] || profile.sportType,
        shared: this.mySportTypes.has(profile.sportType)
      }))),
      error: () => this.counterpartSports.set([])
    });
  }

  /** Gui loi co the vi vua bi chan: doc lai trang thai chan de o soan tin doi thanh thong bao. */
  private refreshBlockState(roomId: string): void {
    this.chatRepo.getRoomDetails(roomId).subscribe({
      next: response => {
        if (response.data?.blockState) this.updateRoom(roomId, { blockState: response.data.blockState });
      },
      error: () => undefined
    });
  }

  private loadClubRoles(room: ChatRoom): void {
    this.clubRoles.set(new Map());
    if (room.type !== ChatRoomType.CLUB || !room.contextId) return;
    const roomId = room.roomId;
    this.clubRepo.getClubMembers(room.contextId).subscribe({
      next: members => {
        if (this.activeRoom()?.roomId !== roomId) return;
        this.clubRoles.set(new Map(members.map(member => [member.userId, member.role])));
      },
      error: () => undefined
    });
  }

  private loadMySportTypes(): void {
    this.sportProfileRepo.getMyProfiles().subscribe({
      next: profiles => {
        this.mySportTypes = new Set(profiles.map(profile => profile.sportType));
        const room = this.activeRoom();
        if (room) this.loadCounterpartContext(room);
      },
      error: () => undefined
    });
  }

  private genderLabel(gender?: string): string {
    if (!gender) return '';
    const normalized = gender.toUpperCase();
    if (normalized === 'MALE' || normalized === 'NAM') return 'Nam';
    if (normalized === 'FEMALE' || normalized === 'NU' || normalized === 'NỮ') return 'Nữ';
    return 'Khác';
  }

  private roleLabel(role: string): string {
    const normalized = role.toUpperCase();
    if (normalized.includes('OWNER')) return 'Chủ sân';
    if (normalized.includes('ADMIN')) return 'Quản trị viên';
    return 'Người chơi phong trào';
  }

  private enrichRooms(rooms: ChatRoom[]): Observable<ChatRoom[]> {
    const userIds = rooms.flatMap(room => room.participantIds);
    return this.playerDirectory.resolve(userIds).pipe(map(directory => rooms.map(room => {
      const participants = room.participants.map(participant => ({
        ...participant,
        userName: directory.get(participant.userId)?.fullName || participant.userName,
        userAvatar: directory.get(participant.userId)?.avatarUrl || participant.userAvatar
      }));
      // Kèo 1-1 cũng là hội thoại giữa đúng hai người, nên hiển thị theo đối phương
      // thay vì để tất cả cùng tên "Kèo BADMINTON" và cùng avatar mặc định.
      const counterpart = participants.length === 2
        ? participants.find(participant => participant.userId !== this.currentUserId)
        : undefined;
      const isPair = room.type === ChatRoomType.DIRECT || room.type === ChatRoomType.MATCH;
      return {
        ...room,
        participants,
        name: isPair ? (counterpart?.userName || room.name) : room.name,
        avatarUrl: (isPair ? counterpart?.userAvatar : undefined) || room.avatarUrl
      };
    })));
  }

  private enrichFriendships(friendships: Friendship[]): Observable<Friendship[]> {
    const userIds = friendships.flatMap(item => [item.requesterId, item.addresseeId]);
    return this.playerDirectory.resolve(userIds).pipe(map(directory => friendships.map(item => ({
      ...item,
      requesterName: directory.get(item.requesterId)?.fullName || item.requesterName,
      requesterAvatar: directory.get(item.requesterId)?.avatarUrl || item.requesterAvatar,
      addresseeName: directory.get(item.addresseeId)?.fullName || item.addresseeName,
      addresseeAvatar: directory.get(item.addresseeId)?.avatarUrl || item.addresseeAvatar
    }))));
  }

  private scrollToBottom(): void {
    const element = this.scrollContainer?.nativeElement;
    if (element) element.scrollTop = element.scrollHeight;
  }
}
