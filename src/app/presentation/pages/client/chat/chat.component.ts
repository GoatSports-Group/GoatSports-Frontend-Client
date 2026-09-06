import { AfterViewChecked, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subscription, finalize, map, switchMap } from 'rxjs';
import { CHAT_REPOSITORY_TOKEN } from '@application/ports/persistence/chat.repository';
import { FRIEND_REPOSITORY_TOKEN } from '@application/ports/persistence/friend.repository';
import { WEBSOCKET_SERVICE_TOKEN } from '@application/ports/websocket.service';
import { CURRENT_USER_PROVIDER_TOKEN } from '@application/ports/current-user.provider';
import { ChatMessage, ChatRoom, ChatRoomType, ChatTypingEvent, MessageType } from '@application/dto/chat/chat.dto';
import { Friendship } from '@application/dto/friend/friend.dto';
import { NotifyService } from '@shared/components/notify/notify.service';
import { PlayerDirectoryService } from '@presentation/services/player-directory.service';

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
  readonly sendingMessage = signal(false);
  readonly partnerTypingName = signal('');
  readonly showNewGroupModal = signal(false);
  readonly groupFriends = signal<Friendship[]>([]);
  readonly loadingGroupFriends = signal(false);
  readonly selectedMemberIds = signal<ReadonlySet<string>>(new Set());
  readonly creatingGroup = signal(false);

  readonly ChatRoomType = ChatRoomType;
  currentUserId = '';
  searchRoomQuery = '';
  messageInput = '';
  newGroupName = '';

  private typing = false;
  private typingTimeout?: ReturnType<typeof setTimeout>;
  private shouldScrollBottom = false;
  private requestedRoomId: string | null = null;
  private messageRequestSequence = 0;
  private readonly subscriptions: Subscription[] = [];

  ngOnInit(): void {
    this.currentUserId = this.userProvider.getCurrentUserId() || '';
    this.wsService.connect();
    this.listenToWebSocket();

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
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  get filteredRooms(): ChatRoom[] {
    const query = this.searchRoomQuery.trim().toLowerCase();
    if (!query) return this.rooms();
    return this.rooms().filter(room =>
      (room.name || '').toLowerCase().includes(query) ||
      (room.lastMessage || '').toLowerCase().includes(query)
    );
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
    this.partnerTypingName.set('');
    this.activeRoom.set(room);
    this.wsService.subscribeToRoom(room.roomId);
    this.loadMessages(room.roomId);

    if (room.unreadCount > 0) {
      this.updateRoom(room.roomId, { unreadCount: 0 });
      this.chatRepo.markRoomAsRead(room.roomId).subscribe({ error: () => undefined });
    }
    if (updateRoute) void this.router.navigate(['/chat', room.roomId]);
  }

  backToRooms(): void {
    this.activeRoom.set(null);
    this.messages.set([]);
    this.partnerTypingName.set('');
    void this.router.navigate(['/chat']);
  }

  loadMessages(roomId: string): void {
    const sequence = ++this.messageRequestSequence;
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
        this.messages.set([...(response.data || [])].reverse());
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
    if (!content || !room || this.sendingMessage()) return;

    this.sendingMessage.set(true);
    this.messageInput = '';
    this.onTypingStop();
    this.chatRepo.sendMessage(room.roomId, {
      clientMessageId: crypto.randomUUID(),
      content,
      type: MessageType.TEXT
    }).pipe(
      finalize(() => this.sendingMessage.set(false))
    ).subscribe({
      next: response => {
        if (!response.data) return;
        this.insertMessage(response.data);
        this.updateRoomFromMessage(response.data);
      },
      error: () => {
        if (!this.messageInput) this.messageInput = content;
        this.notifyService.error('Không thể gửi tin nhắn. Vui lòng thử lại.');
      }
    });
  }

  onInputKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
      return;
    }
    this.onTyping();
  }

  onTyping(): void {
    const room = this.activeRoom();
    if (!room) return;
    if (!this.typing) {
      this.typing = true;
      this.wsService.sendTyping(room.roomId, this.userProvider.getCurrentUserName() || 'Người chơi GoatSports', true);
    }
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => this.onTypingStop(), 2500);
  }

  onTypingStop(): void {
    const room = this.activeRoom();
    if (!room || !this.typing) return;
    this.typing = false;
    this.wsService.sendTyping(room.roomId, this.userProvider.getCurrentUserName() || 'Người chơi GoatSports', false);
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

    const selectedFriends = this.groupFriends().filter(friendship => this.selectedMemberIds().has(this.getFriendId(friendship)));
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
        this.selectRoom(response.data);
        this.notifyService.success('Đã tạo nhóm trò chuyện.');
      },
      error: () => this.notifyService.error('Không thể tạo nhóm trò chuyện. Vui lòng thử lại.')
    });
  }

  getRoomMeta(room: ChatRoom): string {
    return room.type === ChatRoomType.DIRECT
      ? 'Trò chuyện trực tiếp'
      : `${room.participantIds.length} thành viên`;
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
      : friendship.requesterAvatar) || 'assets/images/default-avatar.png';
  }

  useDefaultAvatar(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith('/assets/images/default-avatar.png')) image.src = 'assets/images/default-avatar.png';
  }

  getMessageSenderName(message: ChatMessage): string {
    return message.senderName || this.activeRoom()?.participants.find(item => item.userId === message.senderId)?.userName || 'Thành viên';
  }

  getMessageSenderAvatar(message: ChatMessage): string {
    return message.senderAvatar ||
      this.activeRoom()?.participants.find(item => item.userId === message.senderId)?.userAvatar ||
      'assets/images/default-avatar.png';
  }

  private listenToWebSocket(): void {
    this.subscriptions.push(this.wsService.chatMessages$.subscribe(message => {
      if (this.activeRoom()?.roomId === message.roomId) {
        this.insertMessage(message);
        if (message.senderId !== this.currentUserId) {
          this.chatRepo.markRoomAsRead(message.roomId).subscribe({ error: () => undefined });
        }
      }
      this.updateRoomFromMessage(message);
    }));

    this.subscriptions.push(this.wsService.typingEvents$.subscribe((event: ChatTypingEvent) => {
      if (this.activeRoom()?.roomId === event.roomId && event.senderId !== this.currentUserId) {
        this.partnerTypingName.set(event.isTyping ? (event.senderName || 'Đối phương') : '');
      }
    }));
  }

  private insertMessage(message: ChatMessage): void {
    if (this.messages().some(item => item.messageId === message.messageId)) return;
    this.messages.update(items => [...items, message]);
    this.shouldScrollBottom = true;
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
      unreadCount: !isActive && message.senderId !== this.currentUserId ? room.unreadCount + 1 : room.unreadCount
    });
  }

  private updateRoom(roomId: string, changes: Partial<ChatRoom>): void {
    this.rooms.update(items => this.sortRooms(items.map(item => item.roomId === roomId ? { ...item, ...changes } : item)));
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

  private enrichRooms(rooms: ChatRoom[]): Observable<ChatRoom[]> {
    const userIds = rooms.flatMap(room => room.participantIds);
    return this.playerDirectory.resolve(userIds).pipe(map(directory => rooms.map(room => {
      const participants = room.participants.map(participant => ({
        ...participant,
        userName: directory.get(participant.userId)?.fullName || participant.userName,
        userAvatar: directory.get(participant.userId)?.avatarUrl || participant.userAvatar
      }));
      const counterpart = room.type === ChatRoomType.DIRECT
        ? participants.find(participant => participant.userId !== this.currentUserId)
        : undefined;
      return {
        ...room,
        participants,
        name: counterpart?.userName || room.name,
        avatarUrl: counterpart?.userAvatar || room.avatarUrl
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
