import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Menu,
  X,
  LogOut,
  UserCog,
  ChevronDown,
  ChevronRight,
  Sun,
  Moon,
  ClipboardList,
  Kanban,
  BarChart3,
  CheckSquare,
  ClipboardCheck,
  PanelLeftClose,
  PanelLeft,
  Bug,
  Bell,
  Check,
  AlertTriangle,
  Clock as ClockIcon,
  CheckCircle,
  XCircle,
  Plus,
  Loader2,
  Settings,
} from "lucide-react";
import { useState, useMemo, createContext, useContext } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Client, Notification } from "@shared/schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const SidebarContext = createContext<{
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}>({ collapsed: false, setCollapsed: () => {} });

export function useSidebarCollapse() {
  return useContext(SidebarContext);
}

function NotificationBell({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  variant,
}: {
  notifications: Notification[];
  unreadCount: number;
  onMarkRead: (id: number) => void;
  onMarkAllRead: () => void;
  variant: "sidebar" | "mobile" | "header";
}) {
  const recentNotifs = notifications.slice(0, 20);
  const isSidebar = variant === "sidebar";
  const isHeader = variant === "header";

  const notifTypeLabel = (type: string) => {
    switch (type) {
      case "approval_sent": return "Enviado p/ aprovação";
      case "card_approved": return "Aprovado";
      case "card_rejected": return "Reprovado";
      case "revision_requested": return "Revisão solicitada";
      case "comment_added": return "Comentário";
      case "card_scheduled": return "Agendado";
      default: return "Notificação";
    }
  };

  const notifTypeColor = (type: string) => {
    switch (type) {
      case "card_approved": return "text-emerald-500";
      case "card_rejected": return "text-red-500";
      case "revision_requested": return "text-amber-500";
      case "approval_sent": return "text-blue-500";
      case "comment_added": return "text-purple-500";
      case "card_scheduled": return "text-cyan-500";
      default: return "text-muted-foreground";
    }
  };

  const formatTime = (date: string | Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "agora";
    if (diffMin < 60) return `${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}d`;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        {isHeader ? (
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            data-testid="button-notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center bg-primary text-primary-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Button>
        ) : (
          <button
            className={`relative p-2 rounded-lg transition-colors ${isSidebar ? "w-full flex items-center gap-2.5 px-3 py-2.5" : ""}`}
            style={isSidebar ? { background: 'hsl(var(--sidebar-muted) / 0.5)', color: 'hsl(var(--sidebar-fg) / 0.7)' } : { color: 'hsl(var(--sidebar-fg) / 0.7)' }}
            data-testid="button-notifications"
          >
            <Bell className={isSidebar ? "w-4 h-4" : "w-5 h-5"} />
            {isSidebar && <span className="text-xs">Notificações</span>}
            {unreadCount > 0 && (
              <span className={`${isSidebar ? "ml-auto" : "absolute -top-0.5 -right-0.5"} min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center`} style={{ background: 'hsl(var(--sidebar-accent))', color: 'hsl(0 0% 10%)' }}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align={isSidebar ? "start" : "end"} side={isHeader || !isSidebar ? "bottom" : "right"}>
        <div className="flex items-center justify-between gap-2 p-3 border-b">
          <h4 className="text-sm font-semibold">Notificações</h4>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={onMarkAllRead}
            disabled={unreadCount === 0}
            data-testid="button-mark-all-read"
          >
            <Check className="w-3 h-3 mr-1" />
            Ler tudo
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {recentNotifs.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">Nenhuma notificação</p>
            </div>
          ) : (
            recentNotifs.map((n) => (
              <div
                key={n.id}
                className={`px-3 py-2.5 border-b last:border-b-0 cursor-pointer transition-colors ${!n.isRead ? "bg-muted/50" : ""}`}
                onClick={() => !n.isRead && onMarkRead(n.id)}
                data-testid={`notification-item-${n.id}`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[10px] font-semibold uppercase tracking-wide ${notifTypeColor(n.type)}`}>
                        {notifTypeLabel(n.type)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{formatTime(n.createdAt!)}</span>
                    </div>
                    <p className="text-xs text-foreground/80 line-clamp-2">{n.message}</p>
                  </div>
                  {!n.isRead && (
                    <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: 'hsl(var(--primary))' }} />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [clientsExpanded, setClientsExpanded] = useState(true);
  const [kanbanClientsExpanded, setKanbanClientsExpanded] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const role = user?.role || "admin";

  const { data: clientsList = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: role === "admin" || role === "designer",
  });

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 15000,
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 15000,
  });

  const unreadCount = unreadData?.count ?? 0;

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", "/api/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markOneReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PUT", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const unreadNotifications = notifications.filter(n => !n.isRead);

  const kanbanNotifTypes = ["approval_sent", "card_approved", "card_rejected", "revision_requested", "comment_added", "card_scheduled"];
  const kanbanUnread = unreadNotifications.filter(n => kanbanNotifTypes.includes(n.type));

  const kanbanNotifByClient = useMemo(() => {
    const map: Record<number, number> = {};
    for (const n of kanbanUnread) {
      if (n.clientId) {
        map[n.clientId] = (map[n.clientId] || 0) + 1;
      }
    }
    return map;
  }, [kanbanUnread]);


  const [errorReportOpen, setErrorReportOpen] = useState(false);

  const dashboardNav = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Relatórios", href: "/reports", icon: BarChart3 },
    { name: "Calendário", href: "/calendar", icon: CalendarDays },
  ];

  const postsNav: { name: string; href: string; icon: any }[] = [];

  const briefingNav = [
    { name: "Briefings", href: "/briefings", icon: ClipboardList },
  ];

  const kanbanNav = [
    { name: "Quadro", href: "/kanban", icon: Kanban },
  ];

  const managementNav = [
    { name: "Clientes", href: "/clients", icon: Users },
    { name: "Usuários", href: "/users", icon: UserCog },
    { name: "Configurações", href: "/settings", icon: Settings },
  ];

  const NavSection = ({ label, items }: { label: string; items: { name: string; href: string; icon: any }[] }) => (
    <div className="mb-5">
      <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.15em] mb-2" style={{ color: 'hsl(var(--sidebar-fg) / 0.3)' }}>
        {label}
      </p>
      <div className="space-y-0.5">
        {items.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.name} href={item.href}>
              <div
                className={`sidebar-link ${isActive ? "active" : ""}`}
                data-testid={`nav-${item.href.replace("/", "") || "dashboard"}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <item.icon className="w-[18px] h-[18px] sidebar-link-icon" />
                {item.name}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );


  const KanbanSection = () => {
    const isKanbanActive = location === "/kanban" || location.startsWith("/kanban");
    const showClientTree = role === "admin" || role === "designer";

    if (!showClientTree) {
      return <NavSection label="Tarefas" items={kanbanNav} />;
    }

    return (
      <div className="mb-5">
        <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.15em] mb-2" style={{ color: 'hsl(var(--sidebar-fg) / 0.3)' }}>
          Tarefas
        </p>
        <div className="space-y-0.5">
          <Link href="/kanban">
            <div
              className={`sidebar-link ${isKanbanActive ? "active" : ""}`}
              data-testid="nav-kanban"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <Kanban className="w-[18px] h-[18px] sidebar-link-icon" />
              Quadro
              <button
                className="ml-auto"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setKanbanClientsExpanded(!kanbanClientsExpanded);
                }}
              >
                {kanbanClientsExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" style={{ color: 'hsl(var(--sidebar-fg) / 0.5)' }} />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" style={{ color: 'hsl(var(--sidebar-fg) / 0.5)' }} />
                )}
              </button>
            </div>
          </Link>
          {kanbanClientsExpanded && clientsList.filter((c) => c.isActive !== false).map((client) => (
            <Link key={client.id} href={`/kanban?clientId=${client.id}`}>
              <div
                className="sidebar-link pl-9 cursor-pointer flex items-center gap-2"
                onClick={() => setIsMobileMenuOpen(false)}
                data-testid={`nav-kanban-client-${client.id}`}
              >
                {client.logoUrl ? (
                  <img src={client.logoUrl} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[8px] font-bold" style={{ background: 'hsl(var(--sidebar-accent) / 0.3)', color: 'hsl(var(--sidebar-fg) / 0.7)' }}>
                    {client.name.charAt(0)}
                  </div>
                )}
                <span className="text-xs truncate flex-1">{client.name}</span>
                {(kanbanNotifByClient[client.id] || 0) > 0 && (
                  <span className="min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center shrink-0" style={{ background: 'hsl(var(--sidebar-accent))', color: 'hsl(0 0% 10%)' }}>
                    {kanbanNotifByClient[client.id] > 9 ? "9+" : kanbanNotifByClient[client.id]}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  };

  const PostsSection = () => {
    if (postsNav.length === 0) return null;
    return <NavSection label="Publicações" items={postsNav} />;
  };

  const initials = user?.name
    ? user.name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase()
    : "AD";

  const SidebarContentInner = () => (
    <div className="flex flex-col h-full" style={{ background: 'hsl(var(--sidebar-bg))' }}>
      <div className="p-5 pb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg" style={{ background: 'hsl(var(--sidebar-accent))', color: 'hsl(0 0% 10%)' }}>
            S
          </div>
          <div>
            <h1 className="font-display font-bold text-base leading-tight" style={{ color: 'hsl(var(--sidebar-fg))' }}>Shift</h1>
            <p className="text-[11px] font-medium" style={{ color: 'hsl(var(--sidebar-fg) / 0.4)' }}>Agency Manager</p>
          </div>
        </div>
      </div>

      <div className="px-3 flex-1 overflow-y-auto">
        {(role === "admin" || role === "designer") && (
          <NavSection label="Geral" items={dashboardNav} />
        )}

        {(role === "admin" || role === "designer") && (
          <KanbanSection />
        )}

        <PostsSection />

        {(role === "admin" || role === "designer") && (
          <NavSection label="Briefing" items={briefingNav} />
        )}

        {(role === "admin" || role === "designer" || role === "client") && (
          <NavSection label="Onboarding" items={[
            { name: "Onboarding", href: "/onboarding", icon: ClipboardCheck },
          ]} />
        )}

        {(role === "admin" || user?.isManager) && (
          <NavSection label="Gestão" items={role === "admin" ? managementNav : [{ name: "Usuários", href: "/users", icon: UserCog }]} />
        )}

        {role === "client" && (
          <>
            <NavSection label="Geral" items={dashboardNav} />
            <NavSection label="Materiais" items={[
              { name: "Aprovações", href: "/aprovacoes", icon: CheckSquare },
            ]} />
            <NavSection label="Briefing" items={briefingNav} />
          </>
        )}
      </div>

      <div className="p-4 mt-auto space-y-3">
        <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'hsl(var(--sidebar-muted) / 0.5)' }}>
          <div className="flex items-center gap-2">
            {theme === "dark" ? (
              <Moon className="w-3.5 h-3.5" style={{ color: 'hsl(var(--sidebar-fg) / 0.5)' }} />
            ) : (
              <Sun className="w-3.5 h-3.5" style={{ color: 'hsl(var(--sidebar-fg) / 0.5)' }} />
            )}
            <span className="text-xs" style={{ color: 'hsl(var(--sidebar-fg) / 0.5)' }}>
              {theme === "dark" ? "Modo Escuro" : "Modo Claro"}
            </span>
          </div>
          <Switch
            checked={theme === "light"}
            onCheckedChange={toggleTheme}
            data-testid="switch-theme"
            className="scale-75"
          />
        </div>
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl" style={{ background: 'hsl(var(--sidebar-muted))' }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-white/20" style={{ background: 'hsl(var(--sidebar-accent))', color: 'hsl(0 0% 10%)' }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'hsl(var(--sidebar-fg) / 0.9)' }}>{user?.name || "Admin"}</p>
            <p className="text-[10px] truncate" style={{ color: 'hsl(var(--sidebar-fg) / 0.35)' }}>{user?.email || ""}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            className="shrink-0"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" style={{ color: 'hsl(var(--sidebar-fg) / 0.4)' }} />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <SidebarContext.Provider value={{ collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed }}>
      <div className="min-h-screen bg-background flex">
        <aside
          className={`hidden lg:block fixed inset-y-0 z-50 transition-all duration-300 ${sidebarCollapsed ? "w-0 overflow-hidden" : "w-64"}`}
        >
          <SidebarContentInner />
        </aside>

        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div className="w-64 flex-shrink-0">
              <SidebarContentInner />
            </div>
            <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-3 right-3 text-white"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="w-6 h-6" />
              </Button>
            </div>
          </div>
        )}

        <div className="lg:hidden fixed top-0 left-0 right-0 h-14 z-[9999] flex items-center justify-between px-4 gap-3 border-b" style={{ background: 'hsl(var(--sidebar-bg))', borderColor: 'hsl(var(--sidebar-border))' }}>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(true)}
              data-testid="button-mobile-menu"
              className="text-white"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm" style={{ background: 'hsl(var(--sidebar-accent))', color: 'hsl(0 0% 10%)' }}>
                S
              </div>
              <span className="font-display font-bold text-sm" style={{ color: 'hsl(var(--sidebar-fg))' }}>Shift Agency</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setErrorReportOpen(true)}
              data-testid="button-error-report-mobile"
              style={{ color: 'hsl(var(--sidebar-fg) / 0.7)' }}
            >
              <Bug className="w-5 h-5" />
            </Button>
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkRead={(id) => markOneReadMutation.mutate(id)}
              onMarkAllRead={() => markAllReadMutation.mutate()}
              variant="mobile"
            />
          </div>
        </div>

        <div className={`flex-1 min-h-screen pt-14 lg:pt-0 flex flex-col transition-all duration-300 overflow-x-hidden ${sidebarCollapsed ? "lg:ml-0" : "lg:ml-64"}`}>
          <header className="hidden lg:flex items-center justify-end gap-1 px-4 h-12 border-b bg-card/50 sticky top-0 z-[9999]">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setErrorReportOpen(true)}
              data-testid="button-error-report-header"
              title="Reportar Erro"
            >
              <Bug className="w-4 h-4" />
            </Button>
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkRead={(id) => markOneReadMutation.mutate(id)}
              onMarkAllRead={() => markAllReadMutation.mutate()}
              variant="header"
            />
          </header>
          <main className="flex-1">
            {location === "/kanban" ? (
              children
            ) : (
              <div className="max-w-[1400px] mx-auto p-5 md:p-8 lg:p-10 overflow-y-auto">
                {children}
              </div>
            )}
          </main>
        </div>

        <ErrorReportDialog
          open={errorReportOpen}
          onOpenChange={setErrorReportOpen}
          currentRoute={location}
        />
      </div>
    </SidebarContext.Provider>
  );
}

interface ErrorReport {
  id: number;
  description: string;
  severity: string | null;
  status: string | null;
  menu: string | null;
  resolution: string | null;
  createdAt: string;
}

const SEVERITY_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  low: { label: "Baixa", variant: "secondary" },
  medium: { label: "Média", variant: "default" },
  high: { label: "Alta", variant: "destructive" },
  critical: { label: "Crítica", variant: "destructive" },
};

const STATUS_MAP: Record<string, { label: string; icon: any }> = {
  aberto: { label: "Aberto", icon: AlertTriangle },
  em_andamento: { label: "Em Andamento", icon: ClockIcon },
  resolvido: { label: "Resolvido", icon: CheckCircle },
  ignorado: { label: "Ignorado", icon: XCircle },
};

function ErrorReportDialog({ open, onOpenChange, currentRoute }: { open: boolean; onOpenChange: (open: boolean) => void; currentRoute: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newReport, setNewReport] = useState({ description: "", menu: "", severity: "medium", errorType: "user_report" });
  const [statusFilter, setStatusFilter] = useState("all");

  const errorReportsUrl = statusFilter !== "all" ? `/api/error-reports?status=${statusFilter}` : "/api/error-reports";
  const { data: reports = [], isLoading } = useQuery<ErrorReport[]>({
    queryKey: [errorReportsUrl],
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/error-reports", { ...newReport, route: currentRoute }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/error-reports"] });
      setNewReport({ description: "", menu: "", severity: "medium", errorType: "user_report" });
      toast({ title: "Problema reportado com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao reportar problema", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: any }) => apiRequest("PATCH", `/api/error-reports/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/error-reports"] });
      toast({ title: "Relatório atualizado" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="w-5 h-5" />
            Relatórios de Erro
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          <Card>
            <CardContent className="pt-4 space-y-3">
              <p className="text-sm font-medium">Reportar um Problema</p>
              <Textarea
                value={newReport.description}
                onChange={(e) => setNewReport({ ...newReport, description: e.target.value })}
                placeholder="Descreva o problema encontrado..."
                className="resize-none min-h-[80px]"
                data-testid="input-error-description-modal"
              />
              <div className="flex items-end gap-3 flex-wrap">
                <div className="flex-1 min-w-[140px]">
                  <label className="text-xs font-medium mb-1 block text-muted-foreground">Menu / Página</label>
                  <Input
                    value={newReport.menu}
                    onChange={(e) => setNewReport({ ...newReport, menu: e.target.value })}
                    placeholder="Ex: Kanban, Dashboard"
                    data-testid="input-error-menu-modal"
                  />
                </div>
                <div className="w-[130px]">
                  <label className="text-xs font-medium mb-1 block text-muted-foreground">Severidade</label>
                  <Select value={newReport.severity} onValueChange={(v) => setNewReport({ ...newReport, severity: v })}>
                    <SelectTrigger data-testid="select-error-severity-modal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="critical">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={!newReport.description.trim() || createMutation.isPending}
                  data-testid="button-submit-error-modal"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Reportar
                </Button>
              </div>
            </CardContent>
          </Card>

          {user?.role === "admin" && (
            <>
              <div className="flex items-center gap-3">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-status-filter-modal">
                    <SelectValue placeholder="Filtrar por status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="aberto">Abertos</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="resolvido">Resolvidos</SelectItem>
                    <SelectItem value="ignorado">Ignorados</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : reports.length === 0 ? (
                <div className="text-center py-8">
                  <Bug className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum relatório encontrado</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {reports.map((report) => {
                    const severity = SEVERITY_MAP[report.severity || "medium"] || SEVERITY_MAP.medium;
                    const status = STATUS_MAP[report.status || "aberto"] || STATUS_MAP.aberto;
                    const StatusIcon = status.icon;

                    return (
                      <Card key={report.id} data-testid={`modal-error-report-${report.id}`}>
                        <CardContent className="pt-3 pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                <Badge variant={severity.variant} className="text-[10px]">{severity.label}</Badge>
                                <Badge variant="outline" className="text-[10px] no-default-hover-elevate no-default-active-elevate">
                                  <StatusIcon className="w-2.5 h-2.5 mr-0.5" />
                                  {status.label}
                                </Badge>
                                {report.menu && (
                                  <span className="text-[10px] text-muted-foreground">{report.menu}</span>
                                )}
                                <span className="text-[10px] text-muted-foreground">
                                  {format(new Date(report.createdAt), "dd/MM HH:mm", { locale: ptBR })}
                                </span>
                              </div>
                              <p className="text-xs line-clamp-2">{report.description}</p>
                              {report.resolution && (
                                <p className="text-[10px] text-green-600 dark:text-green-400 mt-1">Resolução: {report.resolution}</p>
                              )}
                            </div>
                            {report.status !== "resolvido" && (
                              <div className="flex gap-1 shrink-0">
                                {report.status === "aberto" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs h-7"
                                    onClick={() => updateMutation.mutate({ id: report.id, updates: { status: "em_andamento" } })}
                                  >
                                    Iniciar
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => {
                                    const resolution = window.prompt("Descreva a resolução:");
                                    if (resolution) {
                                      updateMutation.mutate({ id: report.id, updates: { status: "resolvido", resolution } });
                                    }
                                  }}
                                >
                                  Resolver
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
