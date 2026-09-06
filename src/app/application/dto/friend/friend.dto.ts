export { Friendship } from '@domain/entities/friend';
export { FriendshipStatus } from '@domain/enums/friendship-status.enum';
export { UserBlock } from '@domain/entities/user-block';

export interface SendFriendRequestPayload {
  targetUserId: string;
}

export interface RespondFriendRequestPayload {
  accepted: boolean;
}

export interface BlockUserPayload {
  blockedUserId: string;
  reason?: string;
}
