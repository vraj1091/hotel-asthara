# Hotel photos

Drop your own photos into this folder and they appear on the website. Use real photos of Hotel Asthara only.

You can also upload photos in **Admin → Media** and attach them in **Admin → Rooms** and **Admin → Website**.
Uploaded photos always take priority over the files here. Where neither exists, the site shows a quiet arch
placeholder instead of a broken image.

| File or folder | Where it appears |
| --- | --- |
| `hero.jpg` | Homepage hero (landscape, at least 1600 px wide) |
| `about.jpg` | About page |
| `exterior.jpg` | About and location pages, and the gallery (category "Exterior") |
| `reception.jpg` | About page and the gallery (category "Reception") |
| `og.jpg` | Picture shown when the site is shared on WhatsApp, Facebook etc. (1200 × 630) |
| `rooms/classic-room/01.jpg`, `02.jpg` … | Photo carousel for the Classic Room, in file-name order |
| `rooms/deluxe-room/01.jpg`, `02.jpg` … | Photo carousel for the Deluxe Room |
| `rooms/<room-slug>/…` | Any other room type: the folder name is the room's URL slug (see Admin → Rooms) |
| `gallery/<category>/…` | Gallery page. The folder name is the category: `rooms`, `hotel`, `reception`, `exterior`, `neighbourhood` |

Tips

- JPG, PNG, WebP and AVIF are accepted. The site resizes and compresses them automatically for each screen.
- The file name becomes the alt text, so name files descriptively: `deluxe-room-bed.jpg` → "Deluxe room bed".
  A leading number is ignored, so `01-deluxe-room-bed.jpg` sorts first and still reads "Deluxe room bed".
- After adding photos in production, redeploy (or run `npm run build`) so the photo list is refreshed.
  In development (`npm run dev`) new photos show up on the next page load.
