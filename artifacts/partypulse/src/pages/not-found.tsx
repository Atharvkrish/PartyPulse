import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center text-foreground">
      <h1 className="text-5xl font-black text-primary mb-3">404</h1>
      <p className="text-muted-foreground mb-6">This page doesn't exist.</p>
      <button
        onClick={() => setLocation("/")}
        className="bg-primary text-primary-foreground rounded-lg px-5 py-2 font-semibold text-sm hover:opacity-90"
      >
        Back to Map
      </button>
    </div>
  );
}
