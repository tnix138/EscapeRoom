import InvitationGate from '@/components/invitation/InvitationGate';

interface InvitePageProps {
  params: Promise<{ code: string; seatToken: string }>;
  searchParams: Promise<{ name?: string | string[]; seat?: string | string[]; seatIndex?: string | string[] }>;
}

export default async function InvitePage({ params, searchParams }: InvitePageProps) {
  const [route, query] = await Promise.all([params, searchParams]);
  const playerName = Array.isArray(query.name) ? query.name[0] : query.name;
  const seatLabel = Array.isArray(query.seat) ? query.seat[0] : query.seat;
  const rawSeatIndex = Array.isArray(query.seatIndex) ? query.seatIndex[0] : query.seatIndex;
  const seatIndex = Number.isInteger(Number(rawSeatIndex)) ? Number(rawSeatIndex) : 0;
  return <InvitationGate code={route.code} seatToken={route.seatToken} requestedName={playerName ?? ''} requestedSeat={seatLabel ?? ''} requestedSeatIndex={seatIndex} />;
}
