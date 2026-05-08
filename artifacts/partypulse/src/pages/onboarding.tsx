import { useState, useRef } from "react";
import { useLocation } from "wouter";

const SLIDES = [
  {
   
    title: "Discover Parties Near You",
    sub: "Find events happening right now on a live interactive map.",
    image: "/slides/Discover.jpg", 
  },
  {
  
    title: "Every Night Has a Vibe",
    sub: "25 party categories — from Club Nights to Birthday Parties to Silent Discos.",
    image: "/slides/vibe.jpg", 
  },
  {
    
    title: "Go With Your Crew",
    sub: "Add friends, RSVP together, and chat inside every event.",
      image: "/slides/friends.jpg", 
  },
  {
    
    title: "Host Your Own Event",
    sub: "Create a party in seconds and invite everyone nearby.",
      image: "/slides/host.jpg", 
  },
];

export default function Onboarding() {
  const [idx, setIdx] = useState(0);
  const [, setLocation] = useLocation();
  const touchStartX = useRef<number | null>(null);

  function finish(to: "/login" | "/login?mode=register") {
    localStorage.setItem("pp_onboarding_done", "1");
    setLocation(to);
  }

  function next() {
    if (idx < SLIDES.length - 1) setIdx(idx + 1);
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx < -50 && idx < SLIDES.length - 1) setIdx(idx + 1);
    if (dx > 50 && idx > 0) setIdx(idx - 1);
    touchStartX.current = null;
  }

  const slide = SLIDES[idx];
  const isLast = idx === SLIDES.length - 1;

  return (
    <div
          className="min-h-screen flex flex-col items-center justify-between px-6 pt-16 pb-12 select-none relative"
          style={{ backgroundImage: `url(${slide.image})`, backgroundSize: "cover", backgroundPosition: "center" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      >
          {/* Dark overlay so text is readable */}
          <div className="absolute inset-0 bg-black/50 z-0" />

          {/* THIS IS THE WRAPPER — put everything inside it */}
          <div className="relative z-10 w-full flex flex-col items-center justify-between flex-1">

      {/* Skip */}
      <button
        onClick={() => finish("/login")}
        className="self-end text-sm text-muted-foreground hover:text-foreground"
      >
        Skip
      </button>

      {/* Slide content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 max-w-sm">
      
        <h1 className="text-3xl font-black text-foreground leading-tight">{slide.title}</h1>
        <p className="text-muted-foreground text-base leading-relaxed">{slide.sub}</p>
      </div>

      {/* Dots */}
      <div className="flex gap-2 mb-8">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={`rounded-full transition-all ${
              i === idx ? "w-6 h-2 bg-primary" : "w-2 h-2 bg-border"
            }`}
          />
        ))}
      </div>

      {/* Actions */}
      {isLast ? (
        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={() => finish("/login")}
            className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-2xl text-base hover:opacity-90 transition-opacity"
          >
            Sign In
          </button>
          <button
            onClick={() => finish("/login?mode=register")}
            className="w-full border border-border text-foreground font-bold py-4 rounded-2xl text-base hover:bg-card transition-colors"
          >
            Create Account
          </button>
        </div>
      ) : (
        <div className="w-full max-w-sm">
          <button
            onClick={next}
            className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-2xl text-base hover:opacity-90 transition-opacity"
          >
            Next
          </button>
        </div>
      )}
            </div>    {/* ← close the z-10 wrapper */}
        </div>      {/* ← close the outer background div */ }
  );
}
