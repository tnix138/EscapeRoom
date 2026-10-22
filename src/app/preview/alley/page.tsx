import PreviewAlley from './PreviewAlley';
import { previewModeFromParam } from './preview-mode';

interface AlleyPreviewPageProps {
  searchParams: Promise<{ name?: string | string[]; seat?: string | string[]; seatIndex?: string | string[]; mode?: string | string[] }>;
}

export default async function AlleyPreviewPage({ searchParams }: AlleyPreviewPageProps) {
  const query = await searchParams;
  const name = Array.isArray(query.name) ? query.name[0] : query.name;
  const seat = Array.isArray(query.seat) ? query.seat[0] : query.seat;
  const rawSeatIndex = Array.isArray(query.seatIndex) ? query.seatIndex[0] : query.seatIndex;
  const seatIndex = Number.isInteger(Number(rawSeatIndex)) ? Number(rawSeatIndex) : undefined;
  const initialMode = previewModeFromParam(query.mode);
  return <PreviewAlley name={name?.slice(0, 32) || 'امیرعلی'} seatLabel={seat?.slice(0, 40) || 'صندلی ۰۱'} initialSeatIndex={seatIndex} initialMode={initialMode} />;
}
