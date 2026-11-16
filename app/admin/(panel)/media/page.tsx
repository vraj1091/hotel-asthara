import { MediaLibrary } from "@/components/admin/media/media-library";
import { AdminPageHeader } from "@/components/admin/ui";
import { mediaStorageLabel } from "@/lib/media";
import { requirePage } from "@/lib/session";

export const metadata = { title: "Media library" };

export default async function MediaPage() {
  await requirePage("content:write");
  return (
    <>
      <AdminPageHeader
        title="Media library"
        description="Every photo used on the website. Upload once, then use it on rooms, the gallery, offers and website sections."
      />
      <MediaLibrary storage={mediaStorageLabel()} />
    </>
  );
}
