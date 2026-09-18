import { AfterViewChecked, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subscription, finalize, map, switchMap } from 'rxjs';
import { CHAT_REPOSITORY_TOKEN } from '@application/ports/persistence/chat.repository';
import { FRIEND_REPOSITORY_TOKEN } from '@application/ports/persistence/friend.repository';
import { WEBSOCKET_SERVICE_TOKEN } from '@application/ports/websocket.service';
import { CURRENT_USER_PROVIDER_TOKEN } from '@application/ports/current-user.provider';
import {
  ChatMessage,
  ChatPresenceEvent,
  ChatRoom,
  ChatRoomType,
  ChatTypingEvent,
  MessageType
} from '@application/dto/chat/chat.dto';
import { Friendship } from '@application/dto/friend/friend.dto';
import { NotifyService } from '@shared/components/notify/notify.service';
import { PlayerDirectoryService } from '@presentation/services/player-directory.service';

type RoomFilter = 'ALL' | 'UNREAD' | 'GROUP';

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
  currentUserId = '';
  searchRoomQuery = '';
  messageInput = '';
  newGroupName = '';

  private typing = false;
  private typingTimeout?: ReturnType<typeof setTimeout>;
  private readonly remoteTypingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private relativeTimeInterval?: ReturnType<typeof setInterval>;
  private shouldScrollBottom = false;
  private requestedRoomId: string | null = null;
  private messageRequestSequence = 0;
  private readonly subscriptions: Subscription[] = [];

  ngOnInit(): void {
    this.currentUserId = this.userProvider.getCurrentUserId() || '';
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
  }

  get filteredRooms(): ChatRoom[] {
    const query = this.searchRoomQuery.trim().toLowerCase();
    return this.rooms().filter(room => {
      const matchesQuery = !query ||
        (room.name || '').toLowerCase().includes(query) ||
        (room.lastMessage || '').toLowerCase().includes(query);
      const matchesFilter = this.roomFilter() === 'ALL' ||
        (this.roomFilter() === 'UNREAD' && room.unreadCount > 0) ||
        (this.roomFilter() === 'GROUP' && room.type !== ChatRoomType.DIRECT);
      return matchesQuery && matchesFilter;
    });
  }

  loadRooms(): void {
    this.loadingRooms.set(true);
    this.roomsLoadFailed.set(false);
    this.chatRepo.getUserRooms(0, 50).pipe(
      switchMap(response => this.enrichRooms(response.data || [])),
      finalize(() => this.loadingRooms.set(false))
    ).subscribe({
      next: rooms => {
        this.rooms.set(this.sortRooms(rooms));
        this.rooms().forEach(room => this.wsService.subscribeToRoom(room.roomId));
        this.loadPresenceForRooms(rooms);
        if (this.requestedRoomId) {
          this.selectRoomById(this.requestedRoomId);
        } else if (!this.activeRoom() && this.rooms().length) {
          this.selectRoom(this.rooms()[0], false);
        }
      },
      error: () => this.roomsLoadFailed.set(true)
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
    this.wsService.subscribeToRoom(room.roomId);
    this.loadMessages(room.roomId);

    if (room.unreadCount > 0) {
      this.updateRoom(room.roomId, { unreadCount: 0 });
      this.chatRepo.markRoomAsRead(room.roomId).subscribe({ error: () => undefined });
    }
    if (updateRoute) void this.router.navigate(['/chat', room.roomId]);
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

  loadMessages(roomId: string): void {
    const sequence = ++this.messageRequestSequence;
    const localPending = this.messages().filter(message =>
      message.roomId === roomId && message.deliveryState !== 'SENT'
    );
    this.loadingMessages.set(true);
    this.messagesLoadFailed.set(false);
    this.messages.set([]);

    this.chatRepo.getRoomMessages(roomId, 0, 100).pipe(
      finalize(() => {
        if (sequence === this.messageRequestSequence) this.loadingMessages.set(false);
      })
    ).subscribe({
      next: response => {
        if (sequence !== this.messageRequestSequence || this.activeRoom()?.roomId !== roomId) return;
        const savedMessages = [...(response.data || [])].reverse();
        const unmatchedPending = localPending.filter(pending =>
          !savedMessages.some(saved => saved.clientMessageId === pending.clientMessageId)
        );
        this.messages.set(this.sortMessages([...savedMessages, ...unmatchedPending]));
        this.shouldScrollBottom = true;
      },
      error: () => {
        if (sequence === this.messageRequestSequence) this.messagesLoadFailed.set(true);
      }
    });
  }

  sendMessage(): void {
    const content = this.messageInput.trim();
    const room = this.activeRoom();
    if (!content || !room) return;

    const clientMessageId = crypto.randomUUID();
    const optimisticMessage: ChatMessage = {
      messageId: `pending-${clientMessageId}`,
      clientMessageId,
      roomId: room.roomId,
      senderId: this.currentUserId,
      senderName: this.userProvider.getCurrentUserName() || 'Bạn',
      senderAvatar: this.userProvider.getCurrentUserAvatar() || undefined,
      content,
      type: MessageType.TEXT,
      deliveryState: 'SENDING',
      attachments: [],
      receipts: [],
      createdAt: new Date().toISOString()
    };

    this.messageInput = '';
    this.onTypingStop();
    this.insertMessage(optimisticMessage);
    this.updateRoomFromMessage(optimisticMessage);
    this.dispatchMessage(optimisticMessage);
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
      this.wsService.sendTyping(
        room.roomId,
        this.userProvider.getCurrentUserName() || 'Người chơi GoatSports',
        true
      );
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
    this.wsService.sendTyping(
      room.roomId,
      this.userProvider.getCurrentUserName() || 'Người chơi GoatSports',
      false
    );
  }

  getTypingParticipants(roomId: string): ChatTypingEvent[] {
    return this.typingByRoom()[roomId] || [];
  }

  getTypingLabel(roomId: string): string {
    const participants = this.getTypingParticipants(roomId);
    if (!participants.length) return '';
    if (participants.length === 1) return `${participants[0].senderName || 'Một thành viên'} đang nhập`;
    if (participants.length === 2) {
      return `${participants[0].senderName || 'Một thành viên'} và ${participants[1].senderName || 'một thành viên'} đang nhập`;
    }
    return `${participants[0].senderName || 'Một thành viên'} và ${participants.length - 1} người khác đang nhập`;
  }

  getTypingAvatar(event: ChatTypingEvent): string {
    return this.activeRoom()?.participants.find(participant => participant.userId === event.senderId)?.userAvatar ||
      'assets/images/default-avatar.svg';
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
    if (days === 0) return 'Hôm nay';
    if (days === 1) return 'Hôm qua';
    return new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: currentDate.getFullYear() === new Date().getFullYear() ? undefined : 'numeric'
    }).format(currentDate);
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

  private dispatchMessage(message: ChatMessage): void {
    this.chatRepo.sendMessage(message.roomId, {
      clientMessageId: message.clientMessageId,
      content: message.content,
      type: message.type
    }).subscribe({
      next: response => {
        if (!response.data) return;
        this.reconcileMessage(response.data);
        this.updateRoomFromMessage(response.data);
      },
      error: () => {
        this.patchMessage(message, { deliveryState: 'FAILED' });
        this.notifyService.error('Tin nhắn chưa gửi được. Bạn có thể thử lại ngay trên tin nhắn.');
      }
    });
  }

  private listenToWebSocket(): void {
    this.subscriptions.push(this.wsService.chatMessages$.subscribe(message => {
      this.removeTypingParticipant(message.roomId, message.senderId);
      if (this.activeRoom()?.roomId === message.roomId) {
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
    this.updateRoom(message.roomId, {
      lastMessage: message.content,
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
