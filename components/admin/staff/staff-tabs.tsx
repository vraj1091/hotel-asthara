import { LinkTabs } from "@/components/admin/ui";

export function StaffTabs({ current }: { current: "people" | "roles" }) {
  return (
    <LinkTabs
      current={current}
      tabs={[
        { key: "people", label: "Staff", href: "/admin/staff" },
        { key: "roles", label: "Roles & permissions", href: "/admin/staff/roles" },
      ]}
    />
  );
}
