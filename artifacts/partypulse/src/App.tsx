import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Login from "@/pages/login";
import CreateEvent from "@/pages/create-event";
import EventDetail from "@/pages/event-detail";
import Profile from "@/pages/profile";
import Feed from "@/pages/feed";
import UserProfile from "@/pages/user-profile";
import EditEvent from "@/pages/edit-event";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Redirect to="/login" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        {() => <ProtectedRoute component={Home} />}
      </Route>
      <Route path="/feed">
        {() => <ProtectedRoute component={Feed} />}
      </Route>
      <Route path="/events/new">
        {() => <ProtectedRoute component={CreateEvent} />}
      </Route>
      <Route path="/events/:id">
        {() => <ProtectedRoute component={EventDetail} />}
      </Route>
      <Route path="/profile">
        {() => <ProtectedRoute component={Profile} />}
      </Route>
      <Route path="/users/:id">
        {() => <ProtectedRoute component={UserProfile} />}
      </Route>
      <Route path="/events/:id/edit">
        {() => <ProtectedRoute component={EditEvent} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
