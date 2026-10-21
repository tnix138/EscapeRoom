import InvitationPreview from '@/components/invitation/InvitationPreview';

interface InvitationPreviewPageProps {
  searchParams: Promise<{ name?: string | string[]; seat?: string | string[] }>;
}

export default async function InvitationPreviewPage({ searchParams }: InvitationPreviewPageProps) {
  const query = await searchParams;
  const name = Array.isArray(query.name) ? query.name[0] : query.name;
  const seat = Array.isArray(query.seat) ? query.seat[0] : query.seat;
  return <InvitationPreview name={name?.slice(0, 32) || 'امیرعلی'} seat={seat?.slice(0, 40) || 'صندلی ۰۱'} />;
}
