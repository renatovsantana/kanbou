import { usePosts } from "@/hooks/use-posts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { useState, useMemo } from "react";
import { ptBR } from "date-fns/locale";
import { format, isSameDay, isBefore, startOfDay } from "date-fns";
import { StatusBadge } from "@/components/status-badge";
import { PlatformIcon } from "@/components/platform-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { CalendarDays, Filter, ListFilter, AlertTriangle, Clock } from "lucide-react";
import type { Client } from "@shared/schema";

export default function CalendarView() {
  const { user } = useAuth();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [month, setMonth] = useState<Date>(new Date());
  const { data: posts, isLoading } = usePosts();
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const [activeTab, setActiveTab] = useState("calendar");

  const [clientFilter, setClientFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredPosts = useMemo(() => {
    if (!posts) return [];
    return posts.filter(post => {
      if (clientFilter !== "all" && String(post.clientId) !== clientFilter) return false;
      if (statusFilter !== "all" && post.status !== statusFilter) return false;
      if (platformFilter !== "all") {
        const platforms = Array.isArray(post.platform) ? post.platform : [post.platform];
        if (!platforms.includes(platformFilter)) return false;
      }
      return true;
    });
  }, [posts, clientFilter, platformFilter, statusFilter]);

  const postsForSelectedDate = useMemo(() => {
    return filteredPosts.filter(post =>
      date && isSameDay(new Date(post.scheduledDate), date)
    );
  }, [filteredPosts, date]);

  const scheduledPosts = useMemo(() => {
    const today = startOfDay(new Date());
    return filteredPosts
      .filter(post => {
        const postDate = new Date(post.scheduledDate);
        return !isBefore(postDate, today);
      })
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  }, [filteredPosts]);

  const overduePosts = useMemo(() => {
    const today = startOfDay(new Date());
    return filteredPosts
      .filter(post => {
        const postDate = new Date(post.scheduledDate);
        return isBefore(postDate, today) && post.status !== "published" && post.status !== "Publicado";
      })
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  }, [filteredPosts]);

  const uniqueStatuses = useMemo(() => {
    if (!posts) return [];
    return Array.from(new Set(posts.map(p => p.status)));
  }, [posts]);

  const STATUS_LABELS: Record<string, string> = {
    scheduled: "Agendado",
    Agendado: "Agendado",
    published: "Publicado",
    Publicado: "Publicado",
    draft: "Rascunho",
    Rascunho: "Rascunho",
    pending: "Pendente",
    Pendente: "Pendente",
    approved: "Aprovado",
    Aprovado: "Aprovado",
    rejected: "Rejeitado",
    Rejeitado: "Rejeitado",
  };

  const renderPostCard = (post: any) => (
    <div key={post.id} className="flex flex-col sm:flex-row gap-3 p-4 rounded-md bg-muted/30 hover-elevate transition-all" data-testid={`calendar-post-${post.id}`}>
      <div className="flex-shrink-0">
        <div className="w-11 h-11 rounded-md bg-card flex items-center justify-center gap-1 border border-border">
          {(Array.isArray(post.platform) ? post.platform.slice(0, 3) : [post.platform]).map((p: string) => (
            <PlatformIcon key={p} platform={p} />
          ))}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <h4 className="font-semibold text-sm">{post.clientName}</h4>
            <p className="text-sm text-muted-foreground">{post.title}</p>
          </div>
          <StatusBadge status={post.status} />
        </div>
        {post.content && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{post.content}</p>
        )}
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <CalendarDays className="w-3 h-3" />
            {format(new Date(post.scheduledDate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </span>
          {post.notes && (
            <span className="truncate max-w-[200px] block">Obs: {post.notes}</span>
          )}
        </div>
      </div>
    </div>
  );

  const filterControls = (
    <div className="flex flex-wrap gap-2 items-center" data-testid="calendar-filters">
      <Filter className="w-4 h-4 text-muted-foreground" />
      <Select value={clientFilter} onValueChange={setClientFilter}>
        <SelectTrigger className="w-[160px]" data-testid="filter-client">
          <SelectValue placeholder="Todos os clientes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os clientes</SelectItem>
          {clients.map(c => (
            <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={platformFilter} onValueChange={setPlatformFilter}>
        <SelectTrigger className="w-[140px]" data-testid="filter-platform">
          <SelectValue placeholder="Plataforma" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="Instagram">Instagram</SelectItem>
          <SelectItem value="Facebook">Facebook</SelectItem>
          <SelectItem value="LinkedIn">LinkedIn</SelectItem>
          <SelectItem value="TikTok">TikTok</SelectItem>
          <SelectItem value="Blog">Blog</SelectItem>
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[140px]" data-testid="filter-status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {uniqueStatuses.map(s => (
            <SelectItem key={s} value={s}>{STATUS_LABELS[s] || s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {(clientFilter !== "all" || platformFilter !== "all" || statusFilter !== "all") && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setClientFilter("all"); setPlatformFilter("all"); setStatusFilter("all"); }}
          data-testid="button-clear-filters"
        >
          Limpar filtros
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="section-title" data-testid="text-page-title">Calendário</h1>
          <p className="section-subtitle">Visualize e filtre suas postagens por data.</p>
        </div>
      </div>

      {filterControls}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="calendar-tabs">
          <TabsTrigger value="calendar" data-testid="tab-calendar">
            <CalendarDays className="w-4 h-4 mr-1.5" />
            Calendário
          </TabsTrigger>
          <TabsTrigger value="scheduled" data-testid="tab-scheduled">
            <Clock className="w-4 h-4 mr-1.5" />
            Agendados
            {scheduledPosts.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] no-default-hover-elevate no-default-active-elevate">{scheduledPosts.length}</Badge>
            )}
          </TabsTrigger>
          {overduePosts.length > 0 && (
            <TabsTrigger value="overdue" data-testid="tab-overdue">
              <AlertTriangle className="w-4 h-4 mr-1.5 text-destructive" />
              Atrasados
              <Badge variant="destructive" className="ml-1.5 text-[10px] no-default-hover-elevate no-default-active-elevate">{overduePosts.length}</Badge>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="calendar">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4">
              <Card className="h-full">
                <CardContent className="p-5 flex justify-center">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    month={month}
                    onMonthChange={setMonth}
                    locale={ptBR}
                    className="rounded-md border-none shadow-none w-full flex justify-center"
                    modifiers={{
                      hasPost: (d) => filteredPosts.some(p => isSameDay(new Date(p.scheduledDate), d)),
                    }}
                    modifiersStyles={{
                      hasPost: { fontWeight: 'bold', textDecoration: 'underline', color: 'hsl(135, 55%, 58%)' },
                    }}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-8">
              <Card className="h-full min-h-[500px]">
                <CardHeader className="border-b border-border bg-muted/20 flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-base font-semibold">
                    Posts para {date ? format(date, "dd 'de' MMMM", { locale: ptBR }) : "Data Selecionada"}
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs no-default-hover-elevate no-default-active-elevate">
                    {postsForSelectedDate.length} post{postsForSelectedDate.length !== 1 ? "s" : ""}
                  </Badge>
                </CardHeader>
                <CardContent className="p-5">
                  {isLoading ? (
                    <div className="flex justify-center p-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
                    </div>
                  ) : postsForSelectedDate.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-sm">
                      <CalendarDays className="w-10 h-10 mb-3 opacity-30" />
                      <p>Nenhum post para este dia.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {postsForSelectedDate.map(renderPostCard)}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="scheduled">
          <Card>
            <CardHeader className="border-b border-border bg-muted/20 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ListFilter className="w-4 h-4" />
                Posts Agendados
              </CardTitle>
              <Badge variant="secondary" className="text-xs no-default-hover-elevate no-default-active-elevate">
                {scheduledPosts.length} post{scheduledPosts.length !== 1 ? "s" : ""}
              </Badge>
            </CardHeader>
            <CardContent className="p-5">
              {isLoading ? (
                <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
                </div>
              ) : scheduledPosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm">
                  <Clock className="w-10 h-10 mb-3 opacity-30" />
                  <p>Nenhum post agendado encontrado.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {scheduledPosts.map(renderPostCard)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {overduePosts.length > 0 && (
          <TabsContent value="overdue">
            <Card>
              <CardHeader className="border-b border-destructive/20 bg-destructive/5 flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-4 h-4" />
                  Posts com Agendamento Atrasado
                </CardTitle>
                <Badge variant="destructive" className="text-xs no-default-hover-elevate no-default-active-elevate">
                  {overduePosts.length} post{overduePosts.length !== 1 ? "s" : ""}
                </Badge>
              </CardHeader>
              <CardContent className="p-5">
                <div className="space-y-3">
                  {overduePosts.map(renderPostCard)}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
