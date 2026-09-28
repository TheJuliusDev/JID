# JID — OAU Student Marketplace & Accommodation Platform

A dedicated campus commerce and student accommodation discovery web application designed for students of **Obafemi Awolowo University (OAU), Ile-Ife (Great Ife)**.

---

## Key Features

1. **Student Marketplace**
   - Trade laptops, phones, course textbooks, hostel furniture, electronics, and school supplies directly with fellow Great Ife students.
   - Designated safe daylight meetup locations: Students' Union Building (SUB), Hezekiah Oluwasanmi Library, Amphitheatre, Motion Ground, and Spider Web.
   - Comprehensive filtering by Category, Condition, Campus Residence (Fajuyi, Awo, Moremi, Angola, Mozambique, etc.), and Price.

2. **Accommodation Discovery**
   - Discover student lodges across off-campus zones: Asherifa, Damico (Road 7), Mayfair, Ede Road, and Parakin.
   - Detailed infrastructure breakdown: Solar borehole water availability, power reliability / dedicated prepaid meters, perimeter security, and proximity to campus gates.
   - Direct connection to caretakers, student subletters, and roommates without paying arbitrary agent inspection fees.

3. **Voluntary Rewarded Ad Boost System**
   - 100% free monetization model: users voluntarily watch 5 short sponsor ads to unlock an active 24-hour top-tier featured listing boost with a live countdown timer.
   - Zero intrusive popups or forced ads during normal browsing.

4. **Student Dashboard & In-App Messaging**
   - Personalized student hub ("Good morning, Julius") with real-time views counters, bookmarks, and active listing management.
   - Direct chat threads between buyers and sellers with listing previews.

5. **Premium Membership**
   - "Stand out on campus" with official gold Premium Member badges, 3x search visibility multiplier, up to 20 active listings, and listing analytics.

6. **Admin Moderation Portal**
   - Review reported suspicious listings (scam prevention, misleading description, counterfeit items), manage users, and monitor active boosts.

7. **Dual Operation (Demo Mode & Production Mode)**
   - Automatically detects whether Supabase and Cloudinary credentials exist.
   - If missing, launches immediately in **Demo Mode** with realistic Great Ife mock data and `localStorage` persistence.
   - Once keys are added to `.env`, connects seamlessly to live Supabase PostgreSQL and Cloudinary image storage.

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```

### 3. Build for Production
```bash
npm run build
```

---

## Supabase & Cloudinary Configuration

To connect live production services:

1. Create a Supabase project and run the migration in [`supabase/schema.sql`](supabase/schema.sql).
2. Create a Formspree form for the contact page and copy its endpoint.
3. Set your environment variables in `.env`:
```env
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
VITE_CLOUDINARY_CLOUD_NAME="your-cloud-name"
VITE_CLOUDINARY_UPLOAD_PRESET="your-preset"
VITE_FORMSPREE_ENDPOINT="https://formspree.io/f/your-form-id"
```
*(Supports `EXPO_PUBLIC_`, `VITE_` and `NEXT_PUBLIC_` prefixes for every key — see [`.env.example`](.env.example). The contact form stays disabled until a Formspree endpoint is present.)*

---

## Pages & Routing

JID is a multi-page app with real URLs (client-side routing via the History API):

| Route             | Page                                   |
| ----------------- | -------------------------------------- |
| `/`               | Home (hero, marketplace + lodge previews, how JID works) |
| `/marketplace`    | Marketplace explorer                   |
| `/accommodation`  | Accommodation explorer                 |
| `/vendors`        | How selling on JID works + signup CTA  |
| `/about`          | About JID, social proof, FAQ           |
| `/contact`        | Contact form + real contact channels   |
| `/login`          | Log in                                 |
| `/signup`         | Create an account                      |
| `/u/:username`    | Public profile of a user/vendor        |
| `/dashboard`, `/my-listings`, `/saved`, `/messages`, `/profile` | Authenticated member surfaces |

Unknown paths fall back to a styled 404. Authenticated surfaces redirect to Home and open the sign-in modal when a signed-out visitor tries to open them.

> **Hosting note:** because routing is client-side, your host must serve `index.html` for any unmatched path (SPA fallback). On Vercel/Netlify add a rewrite rule; on Render/Fly serve the app with a fallback to the built `dist/index.html`.
