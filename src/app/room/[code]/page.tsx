import RoomRuntime from '@/components/room/RoomRuntime';

interface RoomPageProps {
  params: Promise<{ code: string }>;
}

/** Real room entry point shared by the invitation gate, the alley, and cutscenes. */
export default async function RoomPage({ params }: RoomPageProps) {
  const { code } = await params;
  return <RoomRuntime code={code} />;
}
