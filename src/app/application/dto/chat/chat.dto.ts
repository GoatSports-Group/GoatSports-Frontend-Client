import { ChatMessage, ChatParticipant } from '@domain/entities/chat';
export { ChatRoom, ChatMessage, ChatParticipant, ChatMessageAttachment, ChatMessageReceipt, ChatSubjectType } from '@domain/entities/chat';
export { ChatRoomType } from '@domain/enums/chat-room-type.enum';
export { MessageType } from '@domain/enums/message-type.enum';

export interface CreateDirectRoomRequest {
  targetUserId: string;
}

/** Nguoi choi hoi chu san / ban to chuc ve mot san, giai hoac ve dat san. */
export interface CreateBusinessRoomRequest {
  ownerId: string;
  subjectType: 'VENUE' | 'TOURNAMENT' | 'BOOKING';
  subjectId: string;
}

export interface CreateGroupRoomRequest {
  name: string;
  avatarUrl?: string;
  participants: ChatParticipant[];
}

export interface SendMessageRequest {
  clientMessageId?: string;
  content: string;
  type?: string;
  metadata?: string;
  /** Ca nhom anh cua mot lan gui; khoa R2 do storage cap khi tai len. */
  attachments?: Array<{ storageKey: string; type: 'IMAGE'; fileName?: string; fileSize?: number }>;
}

/** Doan tin quanh tin chua doc dau tien; `firstUnreadMessageId` null = khong co tin chua doc. */
export interface ChatMessageWindow {
  messages: ChatMessage[];
  firstUnreadMessageId: string | null;
  hasOlder: boolean;
  hasNewer: boolean;
}

export interface ChatTypingEvent {
  roomId: string;
  senderId: string;
  senderName?: string;
  isTyping: boolean;
}

export interface ChatPresenceEvent {
  userId: string;
  online: boolean;
  lastSeenAt?: string;
}
