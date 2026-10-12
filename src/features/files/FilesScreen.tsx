import { Placeholder } from '@/components/Placeholder';
import { useSession } from '@/features/session/SessionProvider';

/** Shared by both roles; the backend only returns media this person may see. */
export default function FilesScreen() {
  const { role } = useSession();
  return (
    <Placeholder
      kicker="Photos & videos"
      title="Shared files"
      description={
        role === 'parent'
          ? 'Photos and videos. Choose who sees each one: everyone, or Colton & Kristin only.'
          : 'Photos and videos shared with you. Everything you upload is visible to everyone.'
      }
    />
  );
}
