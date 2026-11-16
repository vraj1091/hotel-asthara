import { AdminCard, AdminPageHeader } from "@/components/admin/ui";
import { RoomTypeForm } from "@/components/admin/rooms/room-type-form";
import { AMENITY_BY_KEY, ROOM_AMENITY_KEYS } from "@/lib/amenities";
import { requirePage } from "@/lib/session";

export const metadata = { title: "New room type" };

export default async function NewRoomTypePage() {
  await requirePage("rooms:write");
  return (
    <>
      <AdminPageHeader
        title="New room type"
        description="Start with the details. After saving you can add room numbers, photos, rate rules and blocked dates."
        back={{ href: "/admin/rooms", label: "Rooms & rates" }}
      />
      <AdminCard>
        <RoomTypeForm
          amenityOptions={ROOM_AMENITY_KEYS.map((k) => ({ key: k, label: AMENITY_BY_KEY[k]?.label ?? k }))}
        />
      </AdminCard>
    </>
  );
}
