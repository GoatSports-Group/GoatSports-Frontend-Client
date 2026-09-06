export interface UserBlock {
  blockId: string;
  blockerId: string;
  blockerName?: string;
  blockedUserId: string;
  blockedUserName?: string;
  reason?: string;
  blockedAt: string;
}
