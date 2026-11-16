/* Seed: roles, first Super Admin, Hotel Asthara settings, homepage sections and SAMPLE rooms.
   Safe to run more than once – existing rows are never overwritten.  Run: npm run db:seed */
import { existsSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@prisma/client";

// Load .env / .env.local when present (CI and Vercel pass real environment variables, which take precedence).
for (const file of [".env.local", ".env"]) if (existsSync(file)) process.loadEnvFile(file);
import { DEFAULT_ROLES, type RoleKey } from "../lib/permissions";
import { DEFAULT_SECTIONS, DEFAULT_SETTINGS } from "../lib/defaults";
import { hashPassword, zPassword } from "../lib/password";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

const json = (v: unknown) => v as Prisma.InputJsonValue;

async function seedRoles() {
  for (const [key, def] of Object.entries(DEFAULT_ROLES) as [
    RoleKey,
    (typeof DEFAULT_ROLES)[RoleKey],
  ][]) {
    await db.role.upsert({
      where: { key },
      update: { name: def.name }, // keep any permission changes made later in the admin matrix
      create: { key, name: def.name, permissions: def.permissions, system: true },
    });
  }
  console.log("✓ roles");
}

async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "owner@example.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe-Now-123";
  const name = process.env.SEED_ADMIN_NAME ?? "Hotel Owner";
  const check = zPassword.safeParse(password);
  if (!check.success)
    throw new Error(`SEED_ADMIN_PASSWORD is too weak: ${check.error.issues[0]?.message}`);

  const role = await db.role.findUniqueOrThrow({ where: { key: "SUPER_ADMIN" } });
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`✓ admin ${email} already exists`);
    return;
  }
  await db.user.create({
    data: { email, name, passwordHash: await hashPassword(password), roleId: role.id },
  });
  console.log(`✓ admin created: ${email}`);
  if (password === "ChangeMe-Now-123")
    console.warn("  ! Using the default password. Change it after your first sign-in.");
}

async function seedSettings() {
  const overrides: Record<string, unknown> = {
    contact: {
      ...DEFAULT_SETTINGS.contact,
      phone: process.env.HOTEL_PHONE ?? "",
      whatsapp: process.env.HOTEL_WHATSAPP ?? "",
      email: process.env.HOTEL_EMAIL ?? "",
    },
  };
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.setting.upsert({
      where: { key },
      update: {},
      create: { key, value: json(overrides[key] ?? value) },
    });
  }
  for (const section of DEFAULT_SECTIONS) {
    await db.pageSection.upsert({
      where: { key: section.key },
      update: {},
      create: {
        key: section.key,
        enabled: section.enabled,
        sortOrder: section.sortOrder,
        content: json(section.content),
      },
    });
  }
  console.log("✓ settings and homepage sections");
}

/* The hotel's room types and current rack rates. Room sizes and room numbers are estimates – check them in
   Admin → Rooms before launch. Add any other room type there rather than here. */
const SAMPLE_TYPES = [
  {
    slug: "classic-room",
    name: "Classic Room",
    nameHi: "क्लासिक रूम",
    summary: "A comfortable air-conditioned room for one or two guests.",
    summaryHi: "एक या दो मेहमानों के लिए आरामदायक एयर-कंडीशन्ड कमरा।",
    description:
      "A comfortable air-conditioned room with a double bed, private bathroom with toiletries, LED TV, work desk and wardrobe. Free WiFi and room service are included.",
    descriptionHi:
      "डबल बेड, टॉयलेटरीज़ के साथ प्राइवेट बाथरूम, एलईडी टीवी, वर्क डेस्क और अलमारी वाला आरामदायक एयर-कंडीशन्ड कमरा। मुफ़्त वाई-फ़ाई और रूम सर्विस शामिल।",
    sizeSqFt: 180,
    maxAdults: 2,
    maxChildren: 1,
    bedType: "Double bed",
    baseRatePaise: 179_900,
    featured: false,
    sortOrder: 1,
    rooms: ["201", "202", "203", "204"],
  },
  {
    slug: "deluxe-room",
    name: "Deluxe Room",
    nameHi: "डीलक्स रूम",
    summary: "More space to settle in, ideal for couples and longer stays.",
    summaryHi: "ज़्यादा जगह, कपल और लंबे प्रवास के लिए उपयुक्त।",
    description:
      "A larger room for guests who want extra space. Double bed, air conditioning, private bathroom with toiletries, LED TV, work desk and wardrobe, with free WiFi and room service.",
    descriptionHi:
      "ज़्यादा जगह चाहने वाले मेहमानों के लिए बड़ा कमरा। डबल बेड, एयर कंडीशनिंग, टॉयलेटरीज़ के साथ प्राइवेट बाथरूम, एलईडी टीवी, वर्क डेस्क और अलमारी, साथ में मुफ़्त वाई-फ़ाई और रूम सर्विस।",
    sizeSqFt: 230,
    maxAdults: 2,
    maxChildren: 1,
    bedType: "Double bed",
    baseRatePaise: 229_900,
    featured: true,
    sortOrder: 2,
    rooms: ["205", "206", "207", "208"],
  },
] as const;

async function seedRooms() {
  const amenities = ["ac", "wifi", "tv", "room-service", "bathroom", "wardrobe", "desk"];
  for (const { rooms, ...type } of SAMPLE_TYPES) {
    const data = { ...type, extraBedPaise: null, amenities };
    const roomType = await db.roomType.upsert({
      where: { slug: type.slug },
      update: {},
      create: data,
    });
    for (const number of rooms) {
      await db.room.upsert({
        where: { number },
        update: {},
        create: { number, roomTypeId: roomType.id, floor: 2 },
      });
    }
  }
  console.log("✓ rooms: Classic (₹1,799) and Deluxe (₹2,299), 4 rooms each – check sizes in the admin");
}

async function main() {
  await seedRoles();
  await seedAdmin();
  await seedSettings();
  await seedRooms();
  console.log("\nDone. Sign in at /admin/login");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
