import { useState, useEffect } from "react";
import {
  FilterState,
  DEFAULT_FILTERS,
  CATEGORIES,
  CATEGORY_META,
  countActiveFilters,
  DatePreset,
  SortBy,
} from "@/lib/eventFilters";

interface Props {
  open: boolean;
  filters: FilterState;
  hasUserLocation: boolean;
  onApply: (f: FilterState) => void;
  onClose: () => void;
}

const SORT_OPTIONS: { value: SortBy; label: string; icon: string }[] = [
  { value: "soonest",  label: "Soonest",     icon: "🗓" },
  { value: "popular",  label: "Most Popular", icon: "🔥" },
  { value: "newest",   label: "Newest",       icon: "✨" },
  { value: "nearest",  label: "Nearest",      icon: "📍" },
];

const DATE_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: "all",     label: "All dates"    },
  { value: "today",   label: "Today"        },
  { value: "tomorrow",label: "Tomorrow"     },
  { value: "weekend", label: "This Weekend" },
  { value: "custom",  label: "Custom…"      },
];

const DISTANCE_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "Any"   },
  { value: 1,    label: "1 km"  },
  { value: 5,    label: "5 km"  },
  { value: 10,   label: "10 km" },
  { value: 25,   label: "25 km" },
];

function Pill({
  active,
  onClick,
  children,
  className = "",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "border-border text-muted-foreground hover:text-foreground"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export default function EventFilterSheet({ open, filters, hasUserLocation, onApply, onClose }: Props) {
  const [local, setLocal] = useState<FilterState>(filters);

  // Sync when parent opens sheet
  useEffect(() => { if (open) setLocal(filters); }, [open]);

  function toggle<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
  }

  const activeCount = countActiveFilters(local);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative bg-card border-t border-border rounded-t-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Handle */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-1 rounded-full bg-border mx-auto" />
          </div>
          <h2 className="text-base font-bold text-foreground absolute left-1/2 -translate-x-1/2">
            Discover Events
          </h2>
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <button
                data-testid="button-reset-filters"
                onClick={() => setLocal(DEFAULT_FILTERS)}
                className="text-xs text-primary hover:opacity-80"
              >
                Reset
              </button>
            )}
            <button
              data-testid="button-close-filter-sheet"
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-6">

          {/* Sort */}
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sort By</p>
            <div className="flex gap-2 flex-wrap">
              {SORT_OPTIONS.map((opt) => (
                <Pill
                  key={opt.value}
                  active={local.sortBy === opt.value}
                  onClick={() =>
                    setLocal((f) => ({
                      ...f,
                      sortBy: opt.value,
                      // nearest requires location
                      ...(opt.value === "nearest" && !hasUserLocation ? { sortBy: f.sortBy } : {}),
                    }))
                  }
                >
                  {opt.icon} {opt.label}
                  {opt.value === "nearest" && !hasUserLocation && (
                    <span className="ml-1 opacity-50">(needs location)</span>
                  )}
                </Pill>
              ))}
            </div>
          </section>

          {/* Date */}
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">When</p>
            <div className="flex gap-2 flex-wrap">
              {DATE_OPTIONS.map((opt) => (
                <Pill
                  key={opt.value}
                  active={local.datePreset === opt.value}
                  onClick={() => setLocal((f) => ({ ...f, datePreset: opt.value }))}
                >
                  {opt.label}
                </Pill>
              ))}
            </div>
            {local.datePreset === "custom" && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">From</p>
                  <input
                    data-testid="input-date-from"
                    type="date"
                    value={local.dateFrom}
                    onChange={(e) => setLocal((f) => ({ ...f, dateFrom: e.target.value }))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">To</p>
                  <input
                    data-testid="input-date-to"
                    type="date"
                    value={local.dateTo}
                    onChange={(e) => setLocal((f) => ({ ...f, dateTo: e.target.value }))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Category */}
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Category</p>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => {
                const meta = CATEGORY_META[cat];
                const active = local.categories.includes(cat);
                return (
                  <button
                    key={cat}
                    data-testid={`filter-cat-${cat}`}
                    onClick={() =>
                      setLocal((f) => ({ ...f, categories: toggle(f.categories, cat) }))
                    }
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-xs font-medium transition-all ${
                      active ? meta.active : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <span className="text-lg">{meta.emoji}</span>
                    <span className="leading-tight text-center">{cat}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Distance */}
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Distance
              {!hasUserLocation && (
                <span className="ml-2 font-normal text-muted-foreground/60 normal-case">(enable location first)</span>
              )}
            </p>
            <div className="flex gap-2 flex-wrap">
              {DISTANCE_OPTIONS.map((opt) => (
                <Pill
                  key={String(opt.value)}
                  active={local.maxDistanceKm === opt.value}
                  onClick={() =>
                    hasUserLocation && setLocal((f) => ({ ...f, maxDistanceKm: opt.value }))
                  }
                  className={!hasUserLocation ? "opacity-40 cursor-not-allowed" : ""}
                >
                  {opt.label}
                </Pill>
              ))}
            </div>
          </section>

          {/* Capacity */}
          <section>
            <button
              data-testid="toggle-capacity-only"
              onClick={() => setLocal((f) => ({ ...f, capacityOnly: !f.capacityOnly }))}
              className="flex items-center justify-between w-full"
            >
              <div>
                <p className="text-sm font-medium text-foreground text-left">Spots Available</p>
                <p className="text-xs text-muted-foreground text-left">Only show events with capacity left</p>
              </div>
              <div
                className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 relative ${
                  local.capacityOnly ? "bg-primary" : "bg-border"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    local.capacityOnly ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </div>
            </button>
          </section>
        </div>

        {/* Apply button */}
        <div className="flex-shrink-0 px-5 pb-6 pt-3 border-t border-border">
          <button
            data-testid="button-apply-filters"
            onClick={() => { onApply(local); onClose(); }}
            className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            {activeCount > 0 ? `Show Results · ${activeCount} filter${activeCount > 1 ? "s" : ""} active` : "Show All Events"}
          </button>
        </div>
      </div>
    </div>
  );
}
