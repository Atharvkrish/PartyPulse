import {
  collection,
  addDoc,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
  query,
  limit,
  getCountFromServer,
} from "firebase/firestore";
import { db } from "./firebase";

// ─── 30 dummy users (show up in friend search) ────────────────────────────
export const DUMMY_USERS = [
  { uid: "d_arjun",   displayName: "Arjun Sharma",     email: "arjun.sharma@partypulse.test" },
  { uid: "d_priya",   displayName: "Priya Patel",       email: "priya.patel@partypulse.test" },
  { uid: "d_rohan",   displayName: "Rohan Mehta",       email: "rohan.mehta@partypulse.test" },
  { uid: "d_ananya",  displayName: "Ananya Singh",      email: "ananya.singh@partypulse.test" },
  { uid: "d_kiran",   displayName: "Kiran Rao",         email: "kiran.rao@partypulse.test" },
  { uid: "d_aisha",   displayName: "Aisha Khan",        email: "aisha.khan@partypulse.test" },
  { uid: "d_nikhil",  displayName: "Nikhil Gupta",      email: "nikhil.gupta@partypulse.test" },
  { uid: "d_shruti",  displayName: "Shruti Nair",       email: "shruti.nair@partypulse.test" },
  { uid: "d_rahul",   displayName: "Rahul Verma",       email: "rahul.verma@partypulse.test" },
  { uid: "d_divya",   displayName: "Divya Reddy",       email: "divya.reddy@partypulse.test" },
  { uid: "d_kabir",   displayName: "Kabir Malhotra",    email: "kabir.malhotra@partypulse.test" },
  { uid: "d_meera",   displayName: "Meera Krishnan",    email: "meera.krishnan@partypulse.test" },
  { uid: "d_siddh",   displayName: "Siddharth Joshi",   email: "siddharth.joshi@partypulse.test" },
  { uid: "d_laksh",   displayName: "Lakshmi Iyer",      email: "lakshmi.iyer@partypulse.test" },
  { uid: "d_yash",    displayName: "Yash Chaudhary",    email: "yash.chaudhary@partypulse.test" },
  { uid: "d_vikram",  displayName: "Vikram Bose",       email: "vikram.bose@partypulse.test" },
  { uid: "d_neha",    displayName: "Neha Agarwal",      email: "neha.agarwal@partypulse.test" },
  { uid: "d_aman",    displayName: "Aman Kapoor",       email: "aman.kapoor@partypulse.test" },
  { uid: "d_pooja",   displayName: "Pooja Desai",       email: "pooja.desai@partypulse.test" },
  { uid: "d_manish",  displayName: "Manish Tiwari",     email: "manish.tiwari@partypulse.test" },
  { uid: "d_aoife",   displayName: "Aoife Murphy",      email: "aoife.murphy@partypulse.test" },
  { uid: "d_cian",    displayName: "Cian O'Brien",      email: "cian.obrien@partypulse.test" },
  { uid: "d_saoirse", displayName: "Saoirse Ryan",      email: "saoirse.ryan@partypulse.test" },
  { uid: "d_fionn",   displayName: "Fionn Walsh",       email: "fionn.walsh@partypulse.test" },
  { uid: "d_niamh",   displayName: "Niamh Kelly",       email: "niamh.kelly@partypulse.test" },
  { uid: "d_nisha",   displayName: "Nisha Bansal",      email: "nisha.bansal@partypulse.test" },
  { uid: "d_ravi",    displayName: "Ravi Saxena",       email: "ravi.saxena@partypulse.test" },
  { uid: "d_tanvi",   displayName: "Tanvi Bajaj",       email: "tanvi.bajaj@partypulse.test" },
  { uid: "d_kunal",   displayName: "Kunal Bhatt",       email: "kunal.bhatt@partypulse.test" },
  { uid: "d_sneha",   displayName: "Sneha Pillai",      email: "sneha.pillai@partypulse.test" },
];

const D = DUMMY_USERS.map((u) => u.uid); // 30 UIDs for going/interested
const N = D.length;

// Rotate through the dummy user pool deterministically
function picks(start: number, count: number): string[] {
  return Array.from({ length: Math.min(count, N) }, (_, i) => D[(start + i) % N]);
}

interface SeedEvent {
  title: string;
  description: string;
  date: string;
  time: string;
  category: string;
  location: { lat: number; lng: number; address: string };
  maxAttendees?: number;
  going: string[];
  interested: string[];
}

// ─── ALL SEED EVENTS (60+) ────────────────────────────────────────────────

const EVENTS: SeedEvent[] = [

  // ══════════════════════════════════════════════════════
  // DUBLIN (5 events)
  // ══════════════════════════════════════════════════════
  {
    title: "Opium Club Night",
    description: "The biggest Friday night in Dublin 2. Resident DJs, two rooms, dress code smart casual. Doors 10pm.",
    date: "2026-06-20", time: "22:00", category: "Club Night",
    location: { lat: 53.3436, lng: -6.2697, address: "26 Wexford St, Dublin 2, Ireland" },
    maxAttendees: 200, going: picks(0, 14), interested: picks(14, 20),
  },
  {
    title: "Smithfield House Party",
    description: "Casual vibes, BYO drinks, great sound system and rooftop access. Limited capacity — invite only.",
    date: "2026-06-22", time: "20:00", category: "House Party",
    location: { lat: 53.3476, lng: -6.2788, address: "Smithfield Square, Dublin 7, Ireland" },
    going: picks(3, 9), interested: picks(12, 12),
  },
  {
    title: "Temple Bar Birthday Bash",
    description: "Sarah's 25th! Join us for drinks, dancing and birthday cake. Everyone's welcome, the more the merrier.",
    date: "2026-07-05", time: "21:00", category: "Birthday Party",
    location: { lat: 53.3454, lng: -6.2628, address: "The Temple Bar, Temple Bar, Dublin 2, Ireland" },
    maxAttendees: 50, going: picks(6, 12), interested: picks(18, 15),
  },
  {
    title: "District 8 Techno Night",
    description: "All-night techno with top resident DJs. Doors 11pm, no re-entry after 2am. Industrial venue, massive sound.",
    date: "2026-07-12", time: "23:00", category: "Techno Night",
    location: { lat: 53.3429, lng: -6.2843, address: "Lower Grangegorman, Dublin 7, Ireland" },
    maxAttendees: 300, going: picks(2, 18), interested: picks(20, 22),
  },
  {
    title: "Trinity Freshers Party 2026",
    description: "Welcome to Trinity College! Meet your new classmates and kick off the best year of your life. Free entry with student ID.",
    date: "2026-09-25", time: "19:00", category: "Freshers Party",
    location: { lat: 53.3439, lng: -6.2546, address: "Trinity College Dublin, College Green, Dublin 2, Ireland" },
    maxAttendees: 500, going: picks(5, 20), interested: picks(25, 28),
  },

  // ══════════════════════════════════════════════════════
  // CORK (3 events)
  // ══════════════════════════════════════════════════════
  {
    title: "After-Exams Rave – Cork",
    description: "Exams are DONE! Celebrate with the whole campus. The biggest post-exam blowout in Cork, no study talk allowed.",
    date: "2026-06-18", time: "22:00", category: "After-Exams Party",
    location: { lat: 51.8979, lng: -8.4715, address: "Oliver Plunkett St, Cork, Ireland" },
    maxAttendees: 150, going: picks(8, 15), interested: picks(23, 18),
  },
  {
    title: "Leeside Birthday Night",
    description: "Marcus turns 21! Party at Cork's favourite local. Shots on Marcus at midnight. Don't be late.",
    date: "2026-07-10", time: "21:00", category: "Birthday Party",
    location: { lat: 51.8979, lng: -8.4715, address: "Castle St, Cork, Ireland" },
    going: picks(11, 8), interested: picks(19, 10),
  },
  {
    title: "Cork EDM Festival Night",
    description: "Two stages, top Irish DJs, and a crowd that knows how to move. The biggest EDM night in Cork this summer.",
    date: "2026-08-02", time: "22:00", category: "EDM Night",
    location: { lat: 51.8985, lng: -8.4832, address: "Cornmarket St, Cork, Ireland" },
    maxAttendees: 400, going: picks(4, 17), interested: picks(21, 24),
  },

  // ══════════════════════════════════════════════════════
  // GALWAY (3 events)
  // ══════════════════════════════════════════════════════
  {
    title: "Galway Latin Night",
    description: "Salsa, merengue and reggaeton until 3am. Free dance lessons from 9pm. Best dancers get a free round!",
    date: "2026-07-05", time: "21:00", category: "Latin Night",
    location: { lat: 53.2707, lng: -9.0568, address: "Shop St, Galway, Ireland" },
    going: picks(7, 11), interested: picks(18, 14),
  },
  {
    title: "Salthill Silent Disco",
    description: "Three channels, three DJs, one epic night on the Salthill promenade. Wireless headphones provided. Sober or not, you'll dance.",
    date: "2026-07-18", time: "20:00", category: "Silent Disco",
    location: { lat: 53.2631, lng: -9.0823, address: "Salthill Promenade, Galway, Ireland" },
    maxAttendees: 100, going: picks(1, 9), interested: picks(10, 13),
  },
  {
    title: "Galway Summer Farewell",
    description: "Saying goodbye to the summer crew before everyone scatters. Bring your best memories, bring your worst dance moves.",
    date: "2026-08-30", time: "19:00", category: "Farewell Party",
    location: { lat: 53.2743, lng: -9.0514, address: "Eyre Square, Galway, Ireland" },
    going: picks(13, 7), interested: picks(20, 11),
  },

  // ══════════════════════════════════════════════════════
  // LIMERICK (2 events)
  // ══════════════════════════════════════════════════════
  {
    title: "Limerick EDM Night",
    description: "Hardstyle and EDM at Limerick's newest warehouse venue. Limited capacity — grab your tickets before they're gone.",
    date: "2026-06-28", time: "23:00", category: "EDM Night",
    location: { lat: 52.6638, lng: -8.6267, address: "Thomas St, Limerick, Ireland" },
    maxAttendees: 200, going: picks(9, 13), interested: picks(22, 16),
  },
  {
    title: "UL Reunion Party 2026",
    description: "Class of 2024 gets back together! Tag your crew, share the memories, relive the glory. UL Stables as always.",
    date: "2026-07-20", time: "19:00", category: "Reunion Party",
    location: { lat: 52.6741, lng: -8.5749, address: "University of Limerick, Castletroy, Limerick, Ireland" },
    going: picks(15, 10), interested: picks(25, 13),
  },

  // ══════════════════════════════════════════════════════
  // MUMBAI (5 events)
  // ══════════════════════════════════════════════════════
  {
    title: "Bollywood Biryani & Bass Night",
    description: "Bollywood anthems from the 90s to today, unlimited biryani on arrival, and a dance floor that never stops. Dress in your ethnic best!",
    date: "2026-06-21", time: "21:00", category: "Bollywood Night",
    location: { lat: 19.0596, lng: 72.8295, address: "Linking Rd, Bandra West, Mumbai, Maharashtra 400050" },
    maxAttendees: 250, going: picks(0, 16), interested: picks(16, 22),
  },
  {
    title: "Marine Drive Glow-in-the-Dark Party",
    description: "UV lights, glow face paint station, neon outfits mandatory. Best outfit wins ₹5000. The sea as your backdrop.",
    date: "2026-07-12", time: "20:00", category: "Glow-in-the-Dark Party",
    location: { lat: 18.9438, lng: 72.8233, address: "Marine Drive, Churchgate, Mumbai, Maharashtra 400020" },
    going: picks(5, 12), interested: picks(17, 18),
  },
  {
    title: "Juhu Hip-Hop Takeover",
    description: "Live rap battles, beatboxing rounds and underground DJ sets. Mumbai's finest hip-hop culture hits the beach.",
    date: "2026-07-25", time: "22:00", category: "Hip-Hop Night",
    location: { lat: 19.0883, lng: 72.8262, address: "Juhu Beach Rd, Juhu, Mumbai, Maharashtra 400049" },
    maxAttendees: 180, going: picks(10, 14), interested: picks(24, 20),
  },
  {
    title: "Colaba Rooftop Pool Party",
    description: "Poolside beats, open bar 6–8pm, BBQ and the most stunning view in Mumbai. Swimwear compulsory. Sunblock recommended.",
    date: "2026-08-01", time: "16:00", category: "Pool Party",
    location: { lat: 18.9067, lng: 72.8147, address: "Colaba Causeway, Colaba, Mumbai, Maharashtra 400005" },
    maxAttendees: 120, going: picks(3, 11), interested: picks(14, 17),
  },
  {
    title: "Andheri Techno Underground",
    description: "Mumbai's most intimate techno experience. 200-person cap, no photography, no requests. Pure music.",
    date: "2026-08-15", time: "23:00", category: "Techno Night",
    location: { lat: 19.1136, lng: 72.8697, address: "Andheri West, Mumbai, Maharashtra 400058" },
    maxAttendees: 200, going: picks(7, 13), interested: picks(20, 19),
  },

  // ══════════════════════════════════════════════════════
  // DELHI (4 events)
  // ══════════════════════════════════════════════════════
  {
    title: "Hauz Khas All-Night Club",
    description: "Multi-level venue, rooftop dancing, open bar 10–11pm. Delhi's most iconic party destination. ID required.",
    date: "2026-07-04", time: "22:00", category: "Club Night",
    location: { lat: 28.5494, lng: 77.1950, address: "Hauz Khas Village, New Delhi, Delhi 110016" },
    maxAttendees: 300, going: picks(2, 17), interested: picks(19, 23),
  },
  {
    title: "CP Freshers Welcome Night",
    description: "New to Delhi? Welcome night for students and newcomers. Free first drink, make 10 new friends or your money back.",
    date: "2026-07-18", time: "19:00", category: "Freshers Party",
    location: { lat: 28.6328, lng: 77.2197, address: "Connaught Place, New Delhi, Delhi 110001" },
    maxAttendees: 200, going: picks(6, 15), interested: picks(21, 21),
  },
  {
    title: "South Delhi Retro 90s Night",
    description: "Backstreet Boys, Spice Girls, Aqua and AR Rahman classics. Dress the decade, win the prize. Nostalgia guaranteed.",
    date: "2026-08-08", time: "21:00", category: "Retro/90s Party",
    location: { lat: 28.5495, lng: 77.2420, address: "Greater Kailash, New Delhi, Delhi 110048" },
    maxAttendees: 200, going: picks(11, 13), interested: picks(24, 17),
  },
  {
    title: "Lajpat Nagar Birthday Extravaganza",
    description: "Priya turns 30! Join 100 of her closest friends for a night of chaos, cake and celebration. Fancy dress encouraged.",
    date: "2026-09-01", time: "20:00", category: "Birthday Party",
    location: { lat: 28.5672, lng: 77.2432, address: "Lajpat Nagar Central Market, New Delhi, Delhi 110024" },
    maxAttendees: 100, going: picks(14, 9), interested: picks(23, 14),
  },

  // ══════════════════════════════════════════════════════
  // BANGALORE (4 events)
  // ══════════════════════════════════════════════════════
  {
    title: "Indiranagar After-Work Mixer",
    description: "Leave the laptop at the office. Friday drinks and networking for Bangalore's tech crowd. Startup founders, PMs and engineers welcome.",
    date: "2026-06-19", time: "19:30", category: "Regular Party",
    location: { lat: 12.9784, lng: 77.6408, address: "100 Feet Rd, Indiranagar, Bengaluru, Karnataka 560038" },
    maxAttendees: 80, going: picks(1, 10), interested: picks(11, 16),
  },
  {
    title: "Koramangala House Party",
    description: "No corporate talk, just good music and better people. Semi-private house party in the heart of Koramangala. RSVP required.",
    date: "2026-07-03", time: "21:00", category: "House Party",
    location: { lat: 12.9352, lng: 77.6245, address: "Koramangala 5th Block, Bengaluru, Karnataka 560095" },
    going: picks(4, 8), interested: picks(12, 11),
  },
  {
    title: "Brigade Road Silent Disco",
    description: "Three channels: Bollywood, EDM, and 90s pop. Wireless headphones for all. The street outside goes silent. The party inside does not.",
    date: "2026-07-17", time: "20:00", category: "Silent Disco",
    location: { lat: 12.9716, lng: 77.6060, address: "Brigade Road, Bengaluru, Karnataka 560025" },
    maxAttendees: 150, going: picks(8, 12), interested: picks(20, 15),
  },
  {
    title: "MG Road Ladies Night",
    description: "Complimentary cocktails for all ladies 8–10pm. Bangalore's most exclusive ladies night — dress to impress, leave stress at home.",
    date: "2026-08-07", time: "20:00", category: "Ladies Night",
    location: { lat: 12.9764, lng: 77.6101, address: "MG Road, Bengaluru, Karnataka 560001" },
    maxAttendees: 120, going: picks(0, 9), interested: picks(9, 14),
  },

  // ══════════════════════════════════════════════════════
  // KOLKATA (3 events)
  // ══════════════════════════════════════════════════════
  {
    title: "Park Street Karaoke Night",
    description: "You don't need talent. You need confidence. Kolkata's most chaotic and most fun karaoke night, every Thursday at Someplace Else.",
    date: "2026-06-25", time: "20:00", category: "Regular Party",
    location: { lat: 22.5519, lng: 88.3527, address: "Park Street, Kolkata, West Bengal 700016" },
    going: picks(3, 8), interested: picks(11, 13),
  },
  {
    title: "Behala Hip-Hop Night",
    description: "Live freestyle battles, open mic and DJ sets from Kolkata's underground scene. No industry posturing, just raw hip-hop culture.",
    date: "2026-07-09", time: "21:00", category: "Hip-Hop Night",
    location: { lat: 22.4964, lng: 88.3241, address: "Behala Chowrasta, Kolkata, West Bengal 700034" },
    maxAttendees: 100, going: picks(6, 10), interested: picks(16, 14),
  },
  {
    title: "Salt Lake Book Launch Party",
    description: "Come for the book launch, stay for the drinks. Kolkata's quirkiest literary gathering that somehow ends in a full dance floor.",
    date: "2026-07-22", time: "18:00", category: "Regular Party",
    location: { lat: 22.5744, lng: 88.4200, address: "Sector V, Salt Lake City, Kolkata, West Bengal 700091" },
    going: picks(9, 7), interested: picks(16, 10),
  },

  // ══════════════════════════════════════════════════════
  // CHENNAI (3 events)
  // ══════════════════════════════════════════════════════
  {
    title: "ECR Latin Night – Chennai",
    description: "Salsa and bachata lessons from 8pm, then the floor opens. Best couple wins two ECR resort vouchers. No partner needed to come.",
    date: "2026-06-27", time: "20:00", category: "Latin Night",
    location: { lat: 12.8406, lng: 80.2270, address: "East Coast Road, Sholinganallur, Chennai, Tamil Nadu 600119" },
    going: picks(12, 9), interested: picks(21, 12),
  },
  {
    title: "Besant Nagar Birthday Bash",
    description: "Vikram's big 28. Beach-adjacent venue, live acoustic set followed by DJ. Dress code: smart casual. Cake at midnight.",
    date: "2026-07-15", time: "20:00", category: "Birthday Party",
    location: { lat: 12.9990, lng: 80.2707, address: "Besant Nagar Beach Rd, Chennai, Tamil Nadu 600090" },
    maxAttendees: 60, going: picks(15, 8), interested: picks(23, 11),
  },
  {
    title: "Anna Salai Open Mic Night",
    description: "Comics, poets, musicians and the occasional brave soul doing stand-up for the first time. Supportive crowd guaranteed.",
    date: "2026-08-06", time: "19:00", category: "Regular Party",
    location: { lat: 13.0524, lng: 80.2522, address: "Anna Salai (Mount Road), Chennai, Tamil Nadu 600002" },
    going: picks(18, 7), interested: picks(25, 9),
  },

  // ══════════════════════════════════════════════════════
  // HYDERABAD (2 events)
  // ══════════════════════════════════════════════════════
  {
    title: "Banjara Hills Networking Night",
    description: "Hyderabad's freshest networking event for entrepreneurs, artists and anyone who refuses to talk about the weather.",
    date: "2026-07-01", time: "19:00", category: "Regular Party",
    location: { lat: 17.4126, lng: 78.4401, address: "Road No.12, Banjara Hills, Hyderabad, Telangana 500034" },
    maxAttendees: 100, going: picks(2, 8), interested: picks(10, 13),
  },
  {
    title: "Hitech City Masquerade Night",
    description: "Masks on. Names off. Hyderabad's most mysterious themed night — you might dance with your CEO and not even know it.",
    date: "2026-08-14", time: "21:00", category: "Masquerade Party",
    location: { lat: 17.4504, lng: 78.3811, address: "Hitech City Main Rd, Hyderabad, Telangana 500081" },
    maxAttendees: 150, going: picks(5, 11), interested: picks(16, 15),
  },

  // ══════════════════════════════════════════════════════
  // PUNE (2 events)
  // ══════════════════════════════════════════════════════
  {
    title: "FC Road College Farewell",
    description: "The whole gang together one last time before everyone ships off to grad school, startups and quarter-life crises. Mandatory attendance.",
    date: "2026-06-30", time: "19:00", category: "Farewell Party",
    location: { lat: 18.5236, lng: 73.8478, address: "Fergusson College Rd, Shivajinagar, Pune, Maharashtra 411004" },
    going: picks(7, 10), interested: picks(17, 13),
  },
  {
    title: "Koregaon Park Retro Night",
    description: "80s and 90s Indian pop, flared pants compulsory. DJ Aakash spinning Kishore Kumar to Daler Mehndi. Mullets welcome.",
    date: "2026-07-26", time: "21:00", category: "Retro/90s Party",
    location: { lat: 18.5362, lng: 73.8929, address: "Lane 5, Koregaon Park, Pune, Maharashtra 411001" },
    maxAttendees: 180, going: picks(10, 12), interested: picks(22, 16),
  },

  // ══════════════════════════════════════════════════════
  // GOA (2 events)
  // ══════════════════════════════════════════════════════
  {
    title: "Calangute Sunset Beach Party",
    description: "Watch the sun melt into the Arabian Sea, then dance till 4am. Open bar packages, beach bonfire, and live drums at midnight.",
    date: "2026-07-11", time: "17:00", category: "Pool Party",
    location: { lat: 15.5440, lng: 73.7553, address: "Calangute Beach, North Goa, Goa 403516" },
    going: picks(0, 15), interested: picks(15, 20),
  },
  {
    title: "Anjuna Full Moon Trance Night",
    description: "Full moon. Anjuna beach. Legendary trance DJs. This is the one you'll tell your grandkids about. 10pm to sunrise.",
    date: "2026-07-21", time: "22:00", category: "Techno Night",
    location: { lat: 15.5767, lng: 73.7370, address: "Anjuna Beach, North Goa, Goa 403509" },
    going: picks(4, 18), interested: picks(22, 25),
  },

  // ══════════════════════════════════════════════════════
  // INDORE (3 events — from original seed)
  // ══════════════════════════════════════════════════════
  {
    title: "Indore Freshers Night 2026",
    description: "Welcome the new batch! The biggest freshers' party in Indore — free entry for first-years, DJ from Bhopal, and zero awkward silences.",
    date: "2026-07-15", time: "19:00", category: "Freshers Party",
    location: { lat: 22.7533, lng: 75.8937, address: "Vijay Nagar, Indore, Madhya Pradesh 452010" },
    maxAttendees: 400, going: picks(8, 16), interested: picks(24, 22),
  },
  {
    title: "Indore Rooftop Pool Party",
    description: "Poolside beats, BBQ, all-day drinks. Bring your swimwear and sunblock. DJ from sunset till the stars come out.",
    date: "2026-07-20", time: "15:00", category: "Pool Party",
    location: { lat: 22.7179, lng: 75.8333, address: "MG Road, Indore, Madhya Pradesh 452001" },
    maxAttendees: 100, going: picks(11, 9), interested: picks(20, 13),
  },
  {
    title: "Palasia Open Bar Night",
    description: "All-inclusive open bar, live DJ, two dance floors. The event that broke Indore's record for most selfies taken in one night.",
    date: "2026-08-01", time: "21:00", category: "Open Bar Night",
    location: { lat: 22.7196, lng: 75.8577, address: "Palasia Square, Indore, Madhya Pradesh 452001" },
    maxAttendees: 150, going: picks(14, 11), interested: picks(25, 16),
  },

  // ══════════════════════════════════════════════════════
  // GEN-Z QUIRKY EVENTS (22 events)
  // ══════════════════════════════════════════════════════
  {
    title: "Dumping Him Party (Breakup Celebration) 💅",
    description: "She deleted the contact. Now we celebrate. Dress your revenge dress, bring your girls, and toast to the glow-up. Zero ex talk allowed after 10pm.",
    date: "2026-06-14", time: "20:00", category: "Themed Party",
    location: { lat: 53.3398, lng: -6.2606, address: "South William St, Dublin 2, Ireland" },
    maxAttendees: 60, going: picks(20, 11), interested: picks(1, 14),
  },
  {
    title: "Find a Man / Find a Woman Speed Dating 🏹",
    description: "5 minutes. 1 person. Can you make a connection? Mumbai's most no-BS speed dating event — actually fun, shockingly effective.",
    date: "2026-06-20", time: "19:00", category: "Regular Party",
    location: { lat: 19.0178, lng: 72.8478, address: "Worli Seaface, Mumbai, Maharashtra 400030" },
    maxAttendees: 60, going: picks(0, 8), interested: picks(8, 15),
  },
  {
    title: "Wingman / Wingwoman Wanted Mixer 🕊️",
    description: "Bring yourself. We provide you a wingman. Bangalore's social experiment where two strangers help each other meet people. 100% success rate in awkwardness.",
    date: "2026-06-27", time: "19:30", category: "Regular Party",
    location: { lat: 12.9716, lng: 77.6013, address: "Church St, Bengaluru, Karnataka 560001" },
    maxAttendees: 50, going: picks(3, 9), interested: picks(12, 13),
  },
  {
    title: "Ex-Telling Stories Night (Therapeutic Roast) 🎤",
    description: "Tell the worst story about your ex. The crowd votes. Top story wins a free therapy session (or at least a bottle of wine). Delhi, we need this.",
    date: "2026-07-02", time: "20:00", category: "Themed Party",
    location: { lat: 28.6304, lng: 77.2177, address: "Connaught Place, New Delhi, Delhi 110001" },
    maxAttendees: 80, going: picks(6, 10), interested: picks(16, 16),
  },
  {
    title: "Blind Date Challenge Night 😶‍🌫️",
    description: "You fill out a form. We match you. You meet. That's it. Mumbai's most terrifying and most fun social event. Couples have literally formed here.",
    date: "2026-07-04", time: "18:00", category: "Regular Party",
    location: { lat: 19.0544, lng: 72.8322, address: "Bandra-Kurla Complex, Mumbai, Maharashtra 400051" },
    maxAttendees: 40, going: picks(9, 7), interested: picks(16, 12),
  },
  {
    title: "Couple Up Game Night 🎲",
    description: "Already a couple? Prove it. Singles looking? Show up anyway. Hyderabad's most chaotic game night where everyone ends up laughing too hard.",
    date: "2026-07-08", time: "18:30", category: "Regular Party",
    location: { lat: 17.4375, lng: 78.4482, address: "Jubilee Hills, Hyderabad, Telangana 500033" },
    maxAttendees: 60, going: picks(12, 8), interested: picks(20, 11),
  },
  {
    title: "Friendship Speed Dating (No Romance, Just Vibes) 🤝",
    description: "Because making adult friends is actually harder than dating. 5 minutes per person, find your new best friend. Bangalore, we're all a bit lonely.",
    date: "2026-07-11", time: "19:00", category: "Regular Party",
    location: { lat: 12.9352, lng: 77.6245, address: "Koramangala 4th Block, Bengaluru, Karnataka 560034" },
    maxAttendees: 50, going: picks(15, 9), interested: picks(24, 13),
  },
  {
    title: "Healing from Heartbreak – Coffee & Cookies ☕",
    description: "No judgment. No toxic positivity. Just coffee, homemade cookies, and a room full of people who get it. Kolkata's most wholesome event.",
    date: "2026-07-13", time: "16:00", category: "Regular Party",
    location: { lat: 22.5726, lng: 88.3639, address: "Park Street, Kolkata, West Bengal 700017" },
    maxAttendees: 30, going: picks(18, 6), interested: picks(24, 9),
  },
  {
    title: "Puppy Yoga & Mingling 🐶",
    description: "Certified rescue puppies. Certified yoga instructor. Uncertified mingling. Dublin's most wholesome evening — warning: you may adopt a dog.",
    date: "2026-07-14", time: "18:00", category: "Themed Party",
    location: { lat: 53.3340, lng: -6.2488, address: "Grand Canal Dock, Dublin 2, Ireland" },
    maxAttendees: 25, going: picks(20, 7), interested: picks(27, 10),
  },
  {
    title: "Cringe Confessions Party 😬",
    description: "Submit your most embarrassing story anonymously. Someone reads it out. The crowd guesses who it is. Delhi has been waiting for this.",
    date: "2026-07-16", time: "20:00", category: "Themed Party",
    location: { lat: 28.5355, lng: 77.3910, address: "Noida Sector 18, Noida, Uttar Pradesh 201301" },
    maxAttendees: 100, going: picks(1, 11), interested: picks(12, 17),
  },
  {
    title: "Bring Your Bestie – Who Knows Who Better? 🏆",
    description: "You and your best friend vs every other duo in the room. Chennai's most competitive friendship quiz night. Losers buy the winners a drink.",
    date: "2026-07-18", time: "18:30", category: "Regular Party",
    location: { lat: 13.0827, lng: 80.2707, address: "T. Nagar, Chennai, Tamil Nadu 600017" },
    maxAttendees: 60, going: picks(4, 9), interested: picks(13, 13),
  },
  {
    title: "Tinder Profile Roast (Friendly & Private) 🔥",
    description: "Show us your Tinder profile. The group (anonymously) rates your bio, photos and opener. Then we help you fix it. Mumbai, you need this.",
    date: "2026-07-19", time: "19:00", category: "Themed Party",
    location: { lat: 19.1075, lng: 72.8263, address: "Versova, Andheri West, Mumbai, Maharashtra 400061" },
    maxAttendees: 40, going: picks(7, 8), interested: picks(15, 12),
  },
  {
    title: "Anti-Valentine's Bash 💔",
    description: "Singles welcome. Heartbroken welcome. Happily single ESPECIALLY welcome. Cork's most liberating night of the year.",
    date: "2026-08-01", time: "21:00", category: "Themed Party",
    location: { lat: 51.8979, lng: -8.4679, address: "French Church St, Cork, Ireland" },
    maxAttendees: 120, going: picks(22, 10), interested: picks(2, 14),
  },
  {
    title: "Sitcom Trivia & Pizza 🍕",
    description: "Friends. The Office. Seinfeld. Brooklyn Nine-Nine. One big pizza. One bigger trivia night. Galway's most casual Tuesday ever.",
    date: "2026-08-04", time: "19:00", category: "Regular Party",
    location: { lat: 53.2743, lng: -9.0499, address: "Eyre Square, Galway, Ireland" },
    maxAttendees: 50, going: picks(21, 8), interested: picks(0, 11),
  },
  {
    title: "Make a New Friend in 5 Minutes 🙋",
    description: "No phones. No social media handles upfront. Just real conversation for 5 minutes each. Pune's answer to loneliness in a big city.",
    date: "2026-08-05", time: "18:30", category: "Regular Party",
    location: { lat: 18.5204, lng: 73.8567, address: "MG Road, Pune, Maharashtra 411001" },
    maxAttendees: 40, going: picks(10, 7), interested: picks(17, 10),
  },
  {
    title: "Breakup Photoshoot (Turn Pain into Vogue) 📸",
    description: "Professional photographer. Goa sunset. Your revenge era. We turn your lowest moment into your most glamorous photos. Healing, but make it fashion.",
    date: "2026-08-09", time: "17:00", category: "Themed Party",
    location: { lat: 15.4989, lng: 73.8278, address: "Panjim Beach Road, Panaji, Goa 403001" },
    maxAttendees: 20, going: picks(13, 5), interested: picks(18, 9),
  },
  {
    title: "Random Roommate Match Night 🏠",
    description: "Looking for a flatmate in Bangalore? Meet 20 strangers who are also desperately looking. Cheaper than Sulekha. Weirder than Facebook groups.",
    date: "2026-08-11", time: "19:00", category: "Regular Party",
    location: { lat: 12.9141, lng: 77.6101, address: "HSR Layout, Bengaluru, Karnataka 560102" },
    maxAttendees: 40, going: picks(16, 8), interested: picks(24, 12),
  },
  {
    title: "Conspiracy Theories & Chill 🛸",
    description: "No phones to fact-check. You present your theory. The crowd votes. Most convincing theory wins. Delhi's most questionable intellectual evening.",
    date: "2026-08-13", time: "20:00", category: "Regular Party",
    location: { lat: 28.6562, lng: 77.2410, address: "Civil Lines, New Delhi, Delhi 110054" },
    maxAttendees: 60, going: picks(19, 9), interested: picks(28, 13),
  },
  {
    title: "Nostalgia 2000s Party (Barbie, Emo, Pop Punk) 🌸",
    description: "Low-rise jeans, butterfly clips, side-swept fringe. Crazy Frog, Simple Plan, and Hilary Duff on full blast. Mumbai's most chaotic decade revival.",
    date: "2026-08-16", time: "21:00", category: "Retro/90s Party",
    location: { lat: 19.0178, lng: 72.8399, address: "Phoenix Mills, Lower Parel, Mumbai, Maharashtra 400013" },
    maxAttendees: 300, going: picks(0, 15), interested: picks(15, 22),
  },
  {
    title: "Revenge Dress Party 💃",
    description: "Your most iconic outfit. Your most confident walk. Delhi's celebration of everyone who ever cried in a fitting room and then looked incredible.",
    date: "2026-08-22", time: "21:00", category: "Themed Party",
    location: { lat: 28.5733, lng: 77.1746, address: "Vasant Kunj, New Delhi, Delhi 110070" },
    maxAttendees: 80, going: picks(2, 10), interested: picks(12, 15),
  },
  {
    title: "Silent Book Club then Drinks 📚",
    description: "1 hour of silent reading together. Then we drink and talk about what we're reading. Dublin's most civilised night that somehow ends at 2am.",
    date: "2026-08-20", time: "18:00", category: "Regular Party",
    location: { lat: 53.3380, lng: -6.2592, address: "Wexford St, Dublin 2, Ireland" },
    maxAttendees: 40, going: picks(21, 7), interested: picks(28, 10),
  },
  {
    title: "Karaoke for the Tonedeaf 🎤",
    description: "Can't sing? Perfect, neither can anyone else. Kolkata's only karaoke night where bad singing gets the biggest cheers. Free drink if you do a Celine Dion song.",
    date: "2026-08-27", time: "20:00", category: "Regular Party",
    location: { lat: 22.5448, lng: 88.3426, address: "Tollygunge, Kolkata, West Bengal 700033" },
    maxAttendees: 80, going: picks(5, 10), interested: picks(15, 14),
  },
];

// ─── Create dummy user documents so they appear in friend search ──────────
// Returns how many were successfully written (uses merge so it's idempotent).
async function seedDummyUsers(): Promise<number> {
  let created = 0;
  for (const u of DUMMY_USERS) {
    try {
      const ref = doc(db, "users", u.uid);
      await setDoc(
        ref,
        { uid: u.uid, displayName: u.displayName, email: u.email, friends: [], createdAt: serverTimestamp() },
        { merge: true },
      );
      created++;
      await new Promise((r) => setTimeout(r, 30));
    } catch (err) {
      console.warn(`[Seed] Failed to create user ${u.displayName}:`, err);
    }
  }
  return created;
}

// ─── Write a single event document ────────────────────────────────────────
async function writeEvent(ev: SeedEvent): Promise<boolean> {
  try {
    await addDoc(collection(db, "events"), {
      title: ev.title,
      description: ev.description,
      date: ev.date,
      time: ev.time,
      category: ev.category,
      location: ev.location,
      maxAttendees: ev.maxAttendees ?? null,
      going: ev.going,
      interested: ev.interested,
      cantGo: [],
      bannedUsers: [],
      checkedIn: [],
      creatorId: "system",
      creatorName: "PartyPulse",
      imageUrl: "",
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.warn("[Seed] Failed to write event:", ev.title, err);
    return false;
  }
}

// ─── Auto-seed: runs once per session when the DB is empty ────────────────
export async function seedEventsIfEmpty(existingCount: number): Promise<void> {
  if (existingCount > 0) {
    console.log("[Seed] Events exist (" + existingCount + ") — skipping auto-seed.");
    return;
  }

  // Guard: only run once per browser session
  if (sessionStorage.getItem("pp_seeding")) {
    console.log("[Seed] Already ran this session — skipping.");
    return;
  }
  sessionStorage.setItem("pp_seeding", "1");

  console.info(`[Seed] Starting auto-seed: ${DUMMY_USERS.length} users + ${EVENTS.length} events…`);

  const users = await seedDummyUsers();
  console.info(`[Seed] Users: ${users}/${DUMMY_USERS.length} written.`);

  let seeded = 0;
  for (const ev of EVENTS) {
    if (await writeEvent(ev)) seeded++;
    await new Promise((r) => setTimeout(r, 60));
  }

  console.info(`[Seed] Auto-seed complete: ${seeded}/${EVENTS.length} events written.`);
}

// ─── Force-seed: called from the debug "Seed Data" button ─────────────────
// Always runs the full seed regardless of existing count.
// Users are idempotent (merge:true). Events are only written when the
// collection is empty — if events already exist, only dummy users are created.
export async function seedAllData(): Promise<{ users: number; events: number }> {
  // Always re-seed users (idempotent — uses merge:true)
  console.info("[Seed] Force-seed: writing dummy users…");
  const users = await seedDummyUsers();
  console.info(`[Seed] Users done: ${users}/${DUMMY_USERS.length}`);

  // Only write events if the collection is genuinely empty
  const snap = await getCountFromServer(collection(db, "events"));
  const eventCount = snap.data().count;

  if (eventCount > 0) {
    console.info(`[Seed] ${eventCount} events already exist — skipping event write.`);
    return { users, events: 0 };
  }

  // Clear session lock so writeEvent calls go through
  sessionStorage.removeItem("pp_seeding");

  console.info(`[Seed] Writing ${EVENTS.length} events…`);
  let seeded = 0;
  for (const ev of EVENTS) {
    if (await writeEvent(ev)) seeded++;
    await new Promise((r) => setTimeout(r, 60));
  }

  console.info(`[Seed] Force-seed complete: ${seeded}/${EVENTS.length} events written.`);
  return { users, events: seeded };
}
