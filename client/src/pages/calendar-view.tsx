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
import { CalendarDays, Filter, ListFilter, AlertTriangle, Clock, Kanban } from "lucide-react";
import type { Client } from "@shared/schema";

interface CalendarItem {
  id: string | number;
  title: string;
  clientId: number;
  clientName: string;
  content?: string;
  platform: string[];
  scheduledDate: string;
  status: string;
  notes?: string;
  source: "post" | "kanban";
  cardType?: string;
}

export default function CalendarView() {
  const { user } = useAuth();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [month, setMonth] = useState<Date>(new Date());
  const { data: posts, isLoading: postsLoading } = usePosts();
  const { data: scheduledCards = [], isLoading: cardsLoading } = useQuery<any[]>({
    queryKey: ["/api/kanban/scheduled-cards"],
  });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const [activeTab, setActiveTab] = useState("calendar");

  const [clientFilter, setClientFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const isLoading = postsLoading || cardsLoading;

  const allItems = useMemo(() => {
    const items: CalendarItem[] = [];

    if (posts) {
      for (const post of posts) {
        items.push({
          id: post.id,
          title: post.title || "",
          clientId: post.clientId ?? 0,
          clientName: post.clientName || "",
          content: post.content || "",
          platform: Array.isArray(post.platform) ? post.platform : [post.platform],
          scheduledDate: String(post.scheduledDate),
          status: post.status,
          notes: post.notes || "",
          source: "post",
        });
      }
    }

    if (scheduledCards) {
      for (const card of scheduledCards) {
        items.push({
          id: card.id,
          title: card.title || "",
          clientId: card.clientId,
          clientName: card.clientName || "",
          content: card.content || "",
          platform: Array.isArray(card.platform) ? card.platform : card.platform ? [card.platform] : [],
          scheduledDate: card.scheduledDate,
          status: card.status,
          source: "kanban",
          cardType: card.cardType,
        });
      }
    }

    return items;
  }, [posts, scheduledCards]);

  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      if (clientFilter !== "all" && String(item.clientId) !== clientFilter) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (platformFilter !== "all") {
        if (!item.platform.includes(platformFilter)) return false;
      }
      return true;
    });
  }, [allItems, clientFilter, platformFilter, statusFilter]);

  const itemsForSelectedDate = useMemo(() => {
    return filteredItems.filter(item =>
      date && item.scheduledDate && isSameDay(new Date(item.scheduledDate), date)
    );
  }, [filteredItems, date]);

  const scheduledItems = useMemo(() => {
    const today = startOfDay(new Date());
    return filteredItems
      .filter(item => {
        if (!item.scheduledDate) return false;
        const itemDate = new Date(item.scheduledDate);
        return !isBefore(itemDate, today);
      })
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  }, [filteredItems]);

  const overdueItems = useMemo(() => {
    const today = startOfDay(new Date());
    return filteredItems
      .filter(item => {
        if (!item.scheduledDate) return false;
        const itemDate = new Date(item.scheduledDate);
        return isBefore(itemDate, today) && item.status !== "Publicado" && item.status !== "published" && item.status !== "Postado";
      })
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  }, [filteredItems]);

  const uniqueStatuses = useMemo(() => {
    return Array.from(new Set(allItems.map(i => i.status)));
  }, [allItems]);

  const STATUS_LABELS: Record<string, string> = {
    scheduled: "Agendado",
    Agendado: "Agendado",
    published: "Publicado",
    Publicado: "Publicado",
    Postado: "Postado",
    pending: "Pendente",
    Pendente: "Pendente",
    approved: "Aprovado",
    Aprovado: "Aprovado",
    rejected: "Rejeitado",
    Rejeitado: "Rejeitado",
  };

  const STATUS_COLORS: Record<string, string> = {
    Agendado: "border-l-blue-500",
    Postado: "border-l-emerald-500",
    Publicado: "border-l-emerald-500",
  };

  const renderItemCard = (item: CalendarItem) => (
    <div key={item.id} className={`flex flex-col sm:flex-row gap-3 p-4 rounded-md bg-muted/30 hover-elevate transition-all border-l-4 ${STATUS_COLORS[item.status] || "border-l-gray-300"}`} data-testid={`calendar-item-${item.id}`}>
      <div className="flex-shrink-0">
        <div className="w-11 h-11 rounded-md bg-card flex items-center justify-center gap-1 border border-border">
          {item.platform.length > 0 ? (
            item.platform.slice(0, 3).map((p: string) => (
              <PlatformIcon key={p} platform={p} />
            ))
          ) : (
            <Kanban className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <h4 className="font-semibold text-sm">{item.clientName}</h4>
            <p className="text-sm text-muted-foreground">{item.title}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {item.source === "kanban" && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 no-default-hover-elevate no-default-active-elevate">
                <Kanban className="w-3 h-3 mr-0.5" />
                Kanban
              </Badge>
            )}
            <StatusBadge status={item.status} />
          </div>
        </div>
        {item.content && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{item.content}</p>
        )}
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          {item.scheduledDate && (
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {format(new Date(item.scheduledDate), "dd/MM/yyyy", { locale: ptBR })}
            </span>
          )}
          {item.notes && (
            <span className="truncate max-w-[200px] block">Obs: {item.notes}</span>
          )}
        </div>
      </div>
    </div>
  );

  const isClient = user?.role === "client";

  const filterControls = (
    <div className="flex flex-wrap gap-2 items-center" data-testid="calendar-filters">
      <Filter className="w-4 h-4 text-muted-foreground" />
      {!isClient && (
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
      )}
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
      {((!isClient && clientFilter !== "all") || platformFilter !== "all" || statusFilter !== "all") && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { if (!isClient) setClientFilter("all"); setPlatformFilter("all"); setStatusFilter("all"); }}
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
          <p className="section-subtitle">Visualize e filtre seus agendamentos por data.</p>
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
            {scheduledItems.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] no-default-hover-elevate no-default-active-elevate">{scheduledItems.length}</Badge>
            )}
          </TabsTrigger>
          {overdueItems.length > 0 && (
            <TabsTrigger value="overdue" data-testid="tab-overdue">
              <AlertTriangle className="w-4 h-4 mr-1.5 text-destructive" />
              Atrasados
              <Badge variant="destructive" className="ml-1.5 text-[10px] no-default-hover-elevate no-default-active-elevate">{overdueItems.length}</Badge>
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
                      hasScheduled: (d) => filteredItems.some(i => i.scheduledDate && isSameDay(new Date(i.scheduledDate), d) && (i.status === "Agendado" || i.status === "scheduled")),
                      hasPosted: (d) => filteredItems.some(i => i.scheduledDate && isSameDay(new Date(i.scheduledDate), d) && (i.status === "Postado" || i.status === "Publicado" || i.status === "published")),
                      hasPost: (d) => filteredItems.some(i => i.scheduledDate && isSameDay(new Date(i.scheduledDate), d)),
                    }}
                    modifiersStyles={{
                      hasPost: { fontWeight: 'bold' },
                      hasScheduled: { fontWeight: 'bold', color: 'hsl(217, 91%, 60%)' },
                      hasPosted: { fontWeight: 'bold', color: 'hsl(160, 60%, 45%)' },
                    }}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-8">
              <Card className="h-full min-h-[500px]">
                <CardHeader className="border-b border-border bg-muted/20 flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-base font-semibold">
                    Agendamentos para {date ? format(date, "dd 'de' MMMM", { locale: ptBR }) : "Data Selecionada"}
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs no-default-hover-elevate no-default-active-elevate">
                    {itemsForSelectedDate.length} item{itemsForSelectedDate.length !== 1 ? "s" : ""}
                  </Badge>
                </CardHeader>
                <CardContent className="p-5">
                  {isLoading ? (
                    <div className="flex justify-center p-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
                    </div>
                  ) : itemsForSelectedDate.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-sm">
                      <CalendarDays className="w-10 h-10 mb-3 opacity-30" />
                      <p>Nenhum agendamento para este dia.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {itemsForSelectedDate.map(renderItemCard)}
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
                Agendamentos
              </CardTitle>
              <Badge variant="secondary" className="text-xs no-default-hover-elevate no-default-active-elevate">
                {scheduledItems.length} item{scheduledItems.length !== 1 ? "s" : ""}
              </Badge>
            </CardHeader>
            <CardContent className="p-5">
              {isLoading ? (
                <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
                </div>
              ) : scheduledItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm">
                  <Clock className="w-10 h-10 mb-3 opacity-30" />
                  <p>Nenhum agendamento encontrado.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {scheduledItems.map(renderItemCard)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {overdueItems.length > 0 && (
          <TabsContent value="overdue">
            <Card>
              <CardHeader className="border-b border-destructive/20 bg-destructive/5 flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-4 h-4" />
                  Agendamentos Atrasados
                </CardTitle>
                <Badge variant="destructive" className="text-xs no-default-hover-elevate no-default-active-elevate">
                  {overdueItems.length} item{overdueItems.length !== 1 ? "s" : ""}
                </Badge>
              </CardHeader>
              <CardContent className="p-5">
                <div className="space-y-3">
                  {overdueItems.map(renderItemCard)}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
