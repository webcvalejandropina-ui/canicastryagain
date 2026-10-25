export type Rival = { id: string; name: string; games: number; wins: number; lastPlayed: string };
export type RivalInvitation = {
  id: string; rivalId: string; name: string; incoming: boolean;
  status: 'pending' | 'accepted'; numRows: number; expiresAt: number; gameCode: string | null;
};
export type RivalData = { rivals: Rival[]; hidden: Rival[]; invitations: RivalInvitation[] };
