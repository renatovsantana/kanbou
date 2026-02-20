import { useEffect } from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import PostList from "@/pages/post-list";
import CalendarView from "@/pages/calendar-view";
import ClientList from "@/pages/client-list";
import UsersPage from "@/pages/users";
import BriefingsPage from "@/pages/briefings";
import BriefingPublicPage from "@/pages/briefing-public";
import LinkPage from "@/pages/link-page";
import KanbanBoard from "@/pages/kanban";
import ReportsPage from "@/pages/reports";
import ClientApprovals from "@/pages/client-approvals";
import ClientOnboarding from "@/pages/client-onboarding";
import ErrorReportsPage from "@/pages/error-reports";
import InsightsPage from "@/pages/insights";
import SettingsPage from "@/pages/settings";
import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

function ProtectedRouter() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/posts" component={PostList} />
        <Route path="/clients" component={ClientList} />
        <Route path="/calendar" component={CalendarView} />
        <Route path="/users" component={UsersPage} />
        <Route path="/briefings" component={BriefingsPage} />
        <Route path="/kanban" component={KanbanBoard} />
        <Route path="/reports" component={ReportsPage} />
        <Route path="/onboarding" component={ClientOnboarding} />
        <Route path="/insights" component={InsightsPage} />
        <Route path="/aprovacoes" component={ClientApprovals} />
        <Route path="/error-reports" component={ErrorReportsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/briefing/:token" component={BriefingPublicPage} />
      <Route path="/link/:slug" component={LinkPage} />
      <Route>
        <ProtectedRouter />
      </Route>
    </Switch>
  );
}

function DynamicBranding() {
  const { data: branding } = useQuery<{ systemName: string; systemFavicon: string; systemTheme: string }>({
    queryKey: ["/api/settings/branding"],
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (branding?.systemName) {
      document.title = `${branding.systemName} - Agency Manager`;
    }
  }, [branding?.systemName]);

  useEffect(() => {
    if (branding?.systemFavicon) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = branding.systemFavicon;
    }
  }, [branding?.systemFavicon]);

  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AuthProvider>
            <DynamicBranding />
            <Toaster />
            <Router />
          </AuthProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
