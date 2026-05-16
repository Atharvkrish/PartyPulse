import { createEvent } from "./firestoreEvents";

interface SeedData {
  title: string;
  description: string;
  date: string;
  time: string;
  category: string;
  location: { lat: number; lng: number; address: string };
  maxAttendees?: number;
}

// Future-proof dates relative to May 2026
const SEEDS: SeedData[] = [
  // Dublin
  { title: "Opium Club Night", description: "The biggest Friday night in Dublin. DJ lineup TBA. Dress code: smart casual.", date: "2026-06-20", time: "22:00", category: "Club Night", location: { lat: 53.3436, lng: -6.2697, address: "26 Wexford St, Dublin 2, Ireland" }, maxAttendees: 200 },
  { title: "Smithfield House Party", description: "Casual house party. BYO drinks, great sound system, rooftop access.", date: "2026-06-22", time: "20:00", category: "House Party", location: { lat: 53.3476, lng: -6.2788, address: "Smithfield Square, Dublin 7, Ireland" } },
  { title: "Temple Bar Birthday Bash", description: "Sarah's 25th! Join us for drinks, dancing and birthday cake.", date: "2026-07-05", time: "21:00", category: "Birthday Party", location: { lat: 53.3454, lng: -6.2628, address: "Temple Bar, Dublin 2, Ireland" }, maxAttendees: 50 },
  { title: "District 8 Techno Night", description: "All-night techno with resident DJs. Doors 11pm. No re-entry.", date: "2026-07-12", time: "23:00", category: "Techno Night", location: { lat: 53.3429, lng: -6.2843, address: "Lower Grangegorman, Dublin 7, Ireland" }, maxAttendees: 300 },
  { title: "Trinity Freshers Party", description: "Welcome to Trinity! Meet your new classmates and have the best night of the year.", date: "2026-09-25", time: "19:00", category: "Freshers Party", location: { lat: 53.3439, lng: -6.2546, address: "Trinity College Dublin, College Green, Dublin 2, Ireland" }, maxAttendees: 500 },

  // Cork
  { title: "After-Exams Rave – Cork", description: "Exams done! Time to celebrate. The biggest post-exam party in Cork.", date: "2026-06-18", time: "22:00", category: "After-Exams Party", location: { lat: 51.8985, lng: -8.4756, address: "Oliver Plunkett St, Cork, Ireland" }, maxAttendees: 150 },
  { title: "Leeside Birthday Night", description: "Marcus turns 21! Party at the Roundy, Cork's favourite spot.", date: "2026-07-10", time: "21:00", category: "Birthday Party", location: { lat: 51.8979, lng: -8.4715, address: "Castle St, Cork, Ireland" } },
  { title: "Cork EDM Festival Night", description: "An epic night of EDM featuring top Irish DJs on two stages.", date: "2026-08-02", time: "22:00", category: "EDM Night", location: { lat: 51.8985, lng: -8.4832, address: "Cornmarket St, Cork, Ireland" }, maxAttendees: 400 },

  // Galway
  { title: "Galway Latin Night", description: "Salsa, merengue and reggaeton all night. Free lessons from 9pm.", date: "2026-07-05", time: "21:00", category: "Latin Night", location: { lat: 53.2707, lng: -9.0568, address: "Shop St, Galway, Ireland" } },
  { title: "Salthill Silent Disco", description: "Three channels, one epic night on the Salthill promenade. Headphones provided.", date: "2026-07-18", time: "20:00", category: "Silent Disco", location: { lat: 53.2631, lng: -9.0823, address: "Salthill Promenade, Galway, Ireland" }, maxAttendees: 100 },
  { title: "Galway Farewell Party", description: "Saying goodbye to the summer crew before everyone heads home. Bring your best memories.", date: "2026-08-30", time: "19:00", category: "Farewell Party", location: { lat: 53.2743, lng: -9.0514, address: "Eyre Square, Galway, Ireland" } },

  // Limerick
  { title: "Limerick EDM Night", description: "Hardstyle and EDM at Limerick's newest venue. Limited capacity — get tickets early!", date: "2026-06-28", time: "23:00", category: "EDM Night", location: { lat: 52.6638, lng: -8.6267, address: "Thomas St, Limerick, Ireland" }, maxAttendees: 200 },
  { title: "UL Reunion Party 2026", description: "Class of 2024 gets back together! Tag your crew and relive the glory days.", date: "2026-07-20", time: "19:00", category: "Reunion Party", location: { lat: 52.6741, lng: -8.5749, address: "University of Limerick, Castletroy, Limerick, Ireland" } },

  // Mumbai
  { title: "Bollywood Night – Bandra", description: "Hit Bollywood anthems from the 90s to today. Dress in your ethnic best!", date: "2026-06-21", time: "21:00", category: "Bollywood Night", location: { lat: 19.0596, lng: 72.8295, address: "Linking Rd, Bandra West, Mumbai, Maharashtra 400050" }, maxAttendees: 250 },
  { title: "Marine Drive Glow Party", description: "Glow-in-the-dark outfits mandatory. Best outfit wins a prize. UV lights all night.", date: "2026-07-12", time: "20:00", category: "Glow-in-the-Dark Party", location: { lat: 18.9438, lng: 72.8233, address: "Marine Drive, Churchgate, Mumbai, Maharashtra 400020" } },
  { title: "Juhu Hip-Hop Night", description: "Live rap battles, beatboxing and DJ sets. Mumbai's finest underground hip-hop culture.", date: "2026-07-25", time: "22:00", category: "Hip-Hop Night", location: { lat: 19.0883, lng: 72.8262, address: "Juhu Beach Rd, Juhu, Mumbai, Maharashtra 400049" }, maxAttendees: 180 },

  // Delhi
  { title: "Hauz Khas Club Night", description: "Multi-level venue, rooftop dancing, open bar 10–11pm. ID required.", date: "2026-07-04", time: "22:00", category: "Club Night", location: { lat: 28.5494, lng: 77.1950, address: "Hauz Khas Village, New Delhi, Delhi 110016" }, maxAttendees: 300 },
  { title: "CP Birthday Extravaganza", description: "Aarav's big 30! Join 80 of his closest friends for the night of a lifetime.", date: "2026-07-18", time: "20:00", category: "Birthday Party", location: { lat: 28.6328, lng: 77.2197, address: "Connaught Place, New Delhi, Delhi 110001" }, maxAttendees: 80 },
  { title: "Delhi Retro/90s Night", description: "Backstreet Boys, Spice Girls, Aqua — dress the part and win prizes!", date: "2026-08-08", time: "21:00", category: "Retro/90s Party", location: { lat: 28.6139, lng: 77.2090, address: "Rajouri Garden, New Delhi, Delhi 110027" }, maxAttendees: 200 },

  // Indore
  { title: "Indore Freshers Night 2026", description: "Welcome the new batch! The biggest freshers' party in Indore — don't miss it.", date: "2026-07-15", time: "19:00", category: "Freshers Party", location: { lat: 22.7533, lng: 75.8937, address: "Vijay Nagar, Indore, Madhya Pradesh 452010" }, maxAttendees: 400 },
  { title: "Indore Pool Party", description: "Poolside beats, BBQ and all-day drinks. Bring your swimwear and sunblock!", date: "2026-07-20", time: "15:00", category: "Pool Party", location: { lat: 22.7179, lng: 75.8333, address: "MG Road, Indore, Madhya Pradesh 452001" }, maxAttendees: 100 },
  { title: "Palasia Open Bar Night", description: "All-inclusive open bar, live DJ, two dance floors. Pre-book to guarantee entry.", date: "2026-08-01", time: "21:00", category: "Open Bar Night", location: { lat: 22.7196, lng: 75.8577, address: "Palasia Square, Indore, Madhya Pradesh 452001" }, maxAttendees: 150 },
];

export async function seedEventsIfEmpty(
  userId: string,
  eventCount: number
): Promise<void> {
  if (eventCount > 0) return;
  if (localStorage.getItem("pp_seeded")) return;
  localStorage.setItem("pp_seeded", "1");

  for (const seed of SEEDS) {
    try {
      await createEvent({
        ...seed,
        creatorId: userId,
        creatorName: "PartyPulse",
        imageUrl: "",
      });
      // Small delay to avoid hammering Firestore
      await new Promise((r) => setTimeout(r, 80));
    } catch {
      // continue even if one fails
    }
  }
}
