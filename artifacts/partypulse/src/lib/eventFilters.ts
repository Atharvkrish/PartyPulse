import type { Event } from "./firestoreEvents";

export const CATEGORIES = [
  "Party",
  "Concert",
  "Sports",
  "Networking",
  "Food & Drink",
  "Gaming",
  "Art & Culture",
  "Education",
  "Outdoors",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_META: Record<Category, { emoji: string; color: string; active: string }> = {
  "Party":        { emoji: "🎉", color: "border-border text-muted-foreground", active: "bg-pink-500/20 border-pink-500 text-pink-400" },
  "Concert":      { emoji: "🎵", color: "border-border text-muted-foreground", active: "bg-purple-500/20 border-purple-500 text-purple-400" },
  "Sports":       { emoji: "⚽", color: "border-border text-muted-foreground", active: "bg-green-500/20 border-green-500 text-green-400" },
  "Networking":   { emoji: "🤝", color: "border-border text-muted-foreground", active: "bg-blue-500/20 border-blue-500 text-blue-400" },
  "Food & Drink": { emoji: "🍕", color: "border-border text-muted-foreground", active: "bg-orange-500/20 border-orange-500 text-orange-400" },
  "Gaming":       { emoji: "🎮", color: "border-border text-muted-foreground", active: "bg-cyan-500/20 border-cyan-500 text-cyan-400" },
  "Art & Culture":{ emoji: "🎨", color: "border-border text-muted-foreground", active: "bg-red-500/20 border-red-500 text-red-400" },
  "Education":    { emoji: "📚", color: "border-border text-muted-foreground", active: "bg-amber-500/20 border-amber-500 text-amber-400" },
  "Outdoors":     { emoji: "🌿", color: "border-border text-muted-foreground", active: "bg-emerald-500/20 border-emerald-500 text-emerald-400" },
  "Other":        { emoji: "✨", color: "border-border text-muted-foreground", active: "bg-gray-500/20 border-gray-500 text-gray-400" },
};

export type DatePreset = "all" | "today" | "tomorrow" | "weekend" | "custom";
export type SortBy = "soonest" | "popular" | "newest" | "nearest";

export interface FilterState {
  search: string;
  categories: string[];
  datePreset: DatePreset;
  dateFrom: string;
  dateTo: string;
  maxDistanceKm: number | null;
  capacityOnly: boolean;
  sortBy: SortBy;
}

export const DEFAULT_FILTERS: FilterState = {
  search: "",
  categories: [],
  datePreset: "all",
  dateFrom: "",
  dateTo: "",
  maxDistanceKm: null,
  capacityOnly: false,
  sortBy: "soonest",
};

// Haversine distance in km
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function offsetDateStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function weekendDates(): string[] {
  const today = new Date();
  const day = today.getDay();
  const dates: string[] = [];
  // next Saturday
  const sat = new Date(today);
  sat.setDate(today.getDate() + ((6 - day + 7) % 7 || 7));
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);
  // include today if it is already weekend
  if (day === 6 || day === 0) dates.push(today.toISOString().slice(0, 10));
  dates.push(sat.toISOString().slice(0, 10));
  dates.push(sun.toISOString().slice(0, 10));
  return [...new Set(dates)];
}

export function applyFilters(
  events: Event[],
  filters: FilterState,
  userLat?: number,
  userLng?: number
): Event[] {
  let result = [...events];

  // Text search
  if (filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    result = result.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.description ?? "").toLowerCase().includes(q) ||
        (e.creatorName ?? "").toLowerCase().includes(q) ||
        (e.category ?? "").toLowerCase().includes(q)
    );
  }

  // Category
  if (filters.categories.length > 0) {
    result = result.filter(
      (e) => e.category && filters.categories.includes(e.category)
    );
  }

  // Date
  const today = todayStr();
  switch (filters.datePreset) {
    case "today":
      result = result.filter((e) => e.date === today);
      break;
    case "tomorrow":
      result = result.filter((e) => e.date === offsetDateStr(1));
      break;
    case "weekend":
      {
        const wdates = weekendDates();
        result = result.filter((e) => wdates.includes(e.date));
      }
      break;
    case "custom":
      if (filters.dateFrom) result = result.filter((e) => e.date >= filters.dateFrom);
      if (filters.dateTo) result = result.filter((e) => e.date <= filters.dateTo);
      break;
    default:
      // "all" — still only show future events
      result = result.filter((e) => e.date >= today);
  }

  // Distance
  if (filters.maxDistanceKm !== null && userLat != null && userLng != null) {
    result = result.filter(
      (e) =>
        haversineKm(userLat, userLng, e.location.lat, e.location.lng) <=
        filters.maxDistanceKm!
    );
  }

  // Capacity left
  if (filters.capacityOnly) {
    result = result.filter(
      (e) => !e.maxAttendees || e.going.length < e.maxAttendees
    );
  }

  // Sort
  switch (filters.sortBy) {
    case "soonest":
      result.sort(
        (a, b) =>
          new Date(`${a.date}T${a.time}`).getTime() -
          new Date(`${b.date}T${b.time}`).getTime()
      );
      break;
    case "popular":
      result.sort((a, b) => b.going.length - a.going.length);
      break;
    case "newest":
      result.sort((a, b) => {
        const ta = (a.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
        const tb = (b.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
        return tb - ta;
      });
      break;
    case "nearest":
      if (userLat != null && userLng != null) {
        result.sort(
          (a, b) =>
            haversineKm(userLat, userLng, a.location.lat, a.location.lng) -
            haversineKm(userLat, userLng, b.location.lat, b.location.lng)
        );
      }
      break;
  }

  return result;
}

export function countActiveFilters(filters: FilterState): number {
  let n = 0;
  if (filters.search.trim()) n++;
  if (filters.categories.length > 0) n++;
  if (filters.datePreset !== "all") n++;
  if (filters.maxDistanceKm !== null) n++;
  if (filters.capacityOnly) n++;
  if (filters.sortBy !== "soonest") n++;
  return n;
}
