import { ChatParticipant } from '@domain/entities/chat';
export { ChatRoom, ChatMessage, ChatParticipant, ChatMessageAttachment, ChatMessageReceipt } from '@domain/entities/chat';
export { ChatRoomType } from '@domain/enums/chat-room-type.enum';
export { MessageType } from '@domain/enums/message-type.enum';

export interface CreateDirectRoomRequest {
  targetUserId: string;
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
}

export interface ChatTypingEvent {
  roomId: string;
  senderId: string;
  senderName: string;
  isTyping: boolean;
}
