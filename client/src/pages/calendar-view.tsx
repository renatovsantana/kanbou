import { usePosts } from "@/hooks/use-posts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { useState, useMemo, useCallback } from "react";
import { ptBR } from "date-fns/locale";
import {
  format,
  isSameDay,
  isBefore,
  startOfDay,
  startOfWeek,
  addDays,
  parseISO,
} from "date-fns";
import { StatusBadge } from "@/components/status-badge";
import { PlatformIcon } from "@/components/platform-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  CalendarDays,
  Filter,
  ListFilter,
  Clock,
  Kanban,
  ChevronLeft,
  ChevronRight,
  CalendarRange,
  AlertTriangle,
} from "lucide-react";
import type { Client } from "@shared/schema";

interface CalendarItem {
  id: string | number;
  title: string;
  clientId: number;
  clientName: string;
  content?: string;
  platform: string[];
  scheduledDate: string;
  scheduledTime?: string | null;
  status: string;
  columnTitle?: string;
  notes?: string;
  source: "post" | "kanban";
  cardType?: string;
}

const STATUS_LABELS: Record<string, string> = {
  "Na Fila": "Na Fila",
  "Em Produção": "Em Produção",
  "Em Aprovação": "Em Aprovação",
  "Revisão": "Revisão",
  "Aprovado": "Aprovado",
  "Reprovado": "Reprovado",
  "Aguardando Agendar": "Aguardando Agendar",
  "Agendado": "Agendado",
  "Postado": "Postado",
  "Finalizado": "Finalizado",
  scheduled: "Agendado",
  published: "Publicado",
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
};

const STATUS_COLORS: Record<string, string> = {
  "Na Fila": "border-l-gray-400",
  "Em Produção": "border-l-amber-500",
  "Em Aprovação": "border-l-purple-500",
  "Revisão": "border-l-orange-500",
  "Aprovado": "border-l-green-500",
  "Reprovado": "border-l-red-500",
  "Aguardando Agendar": "border-l-cyan-500",
  "Agendado": "border-l-blue-500",
  "Postado": "border-l-emerald-500",
  "Finalizado": "border-l-teal-500",
  scheduled: "border-l-blue-500",
  published: "border-l-emerald-500",
};

const STATUS_DOT_COLORS: Record<string, string> = {
  "Na Fila": "bg-gray-400",
  "Em Produção": "bg-amber-500",
  "Em Aprovação": "bg-purple-500",
  "Revisão": "bg-orange-500",
  "Aprovado": "bg-green-500",
  "Reprovado": "bg-red-500",
  "Aguardando Agendar": "bg-cyan-500",
  "Agendado": "bg-blue-500",
  "Postado": "bg-emerald-500",
  "Finalizado": "bg-teal-500",
  scheduled: "bg-blue-500",
  published: "bg-emerald-500",
};

function normalizeStatus(status: string): string {
  return STATUS_LABELS[status] || status;
}

function safeParseDate(dateStr: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(dateStr);
}

function ItemCard({ item }: { item: CalendarItem }) {
  const dateObj = safeParseDate(item.scheduledDate);
  const isPast = isBefore(startOfDay(dateObj), startOfDay(new Date()));
  const statusColor = STATUS_COLORS[item.status] || "border-l-gray-300";

  return (
    <div
      className={`flex flex-col sm:flex-row gap-3 p-3 rounded-md bg-muted/30 hover:bg-muted/50 transition-all border-l-4 ${statusColor} ${isPast ? "opacity-60" : ""}`}
      data-testid={`calendar-item-${item.id}`}
    >
      <div className="flex-shrink-0">
        <div className="w-10 h-10 rounded-md bg-card flex items-center justify-center gap-0.5 border border-border">
          {item.platform.length > 0 ? (
            item.platform
              .slice(0, 3)
              .map((p: string) => <PlatformIcon key={p} platform={p} />)
          ) : (
            <Kanban className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <h4 className="font-semibold text-sm truncate">{item.clientName}</h4>
            <p className="text-sm text-muted-foreground truncate">{item.title}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {item.source === "kanban" && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 no-default-hover-elevate no-default-active-elevate"
              >
                <Kanban className="w-3 h-3 mr-0.5" />
                Kanban
              </Badge>
            )}
            <StatusBadge status={item.status} />
          </div>
        </div>
        {item.content && (
          <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
            {item.content}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <CalendarDays className="w-3 h-3" />
            {format(dateObj, "dd/MM/yyyy", { locale: ptBR })}
          </span>
          {item.scheduledTime && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {item.scheduledTime}
            </span>
          )}
          {isPast && (
            <span className="flex items-center gap-1 text-destructive">
              <AlertTriangle className="w-3 h-3" />
              Atrasado
            </span>
          )}
          {item.notes && (
            <span className="truncate max-w-[200px]">Obs: {item.notes}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function WeekView({
  items,
  weekStart,
  onPrevWeek,
  onNextWeek,
  onDayClick,
}: {
  items: CalendarItem[];
  weekStart: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onDayClick: (d: Date) => void;
}) {
  const days = useMemo(() => {
    const result: { date: Date; items: CalendarItem[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      const dayItems = items
        .filter(
          (item) =>
            item.scheduledDate && isSameDay(safeParseDate(item.scheduledDate), d)
        )
        .sort((a, b) => {
          const timeA = a.scheduledTime || "99:99";
          const timeB = b.scheduledTime || "99:99";
          return timeA.localeCompare(timeB);
        });
      result.push({ date: d, items: dayItems });
    }
    return result;
  }, [weekStart, items]);

  const today = startOfDay(new Date());

  return (
    <div data-testid="week-view">
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrevWeek}
          data-testid="button-prev-week"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h3 className="text-sm font-medium">
          {format(weekStart, "dd MMM", { locale: ptBR })} —{" "}
          {format(addDays(weekStart, 6), "dd MMM yyyy", { locale: ptBR })}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNextWeek}
          data-testid="button-next-week"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map(({ date, items: dayItems }) => {
          const isToday = isSameDay(date, today);
          return (
            <div
              key={date.toISOString()}
              className={`min-h-[120px] rounded-lg border p-2 cursor-pointer transition-colors hover:bg-muted/30 ${
                isToday
                  ? "border-primary bg-primary/5"
                  : "border-border"
              }`}
              onClick={() => onDayClick(date)}
              data-testid={`week-day-${format(date, "yyyy-MM-dd")}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={`text-xs font-medium capitalize ${
                    isToday ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {format(date, "EEE", { locale: ptBR })}
                </span>
                <span
                  className={`text-sm font-semibold ${
                    isToday
                      ? "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center"
                      : ""
                  }`}
                >
                  {format(date, "d")}
                </span>
              </div>
              <div className="space-y-1">
                {dayItems.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className={`text-[10px] px-1.5 py-0.5 rounded truncate border-l-2 ${
                      STATUS_COLORS[item.status]?.replace(
                        "border-l-",
                        "border-l-"
                      ) || "border-l-gray-300"
                    } bg-muted/50`}
                    title={`${item.clientName}: ${item.title}${item.scheduledTime ? ` às ${item.scheduledTime}` : ""}`}
                  >
                    {item.scheduledTime && (
                      <span className="font-medium mr-1">
                        {item.scheduledTime}
                      </span>
                    )}
                    {item.clientName}
                  </div>
                ))}
                {dayItems.length > 4 && (
                  <div className="text-[10px] text-muted-foreground text-center">
                    +{dayItems.length - 4} mais
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MobileWeekView({
  items,
  weekStart,
  onPrevWeek,
  onNextWeek,
}: {
  items: CalendarItem[];
  weekStart: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}) {
  const days = useMemo(() => {
    const result: { date: Date; items: CalendarItem[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      const dayItems = items
        .filter(
          (item) =>
            item.scheduledDate && isSameDay(safeParseDate(item.scheduledDate), d)
        )
        .sort((a, b) => {
          const timeA = a.scheduledTime || "99:99";
          const timeB = b.scheduledTime || "99:99";
          return timeA.localeCompare(timeB);
        });
      result.push({ date: d, items: dayItems });
    }
    return result;
  }, [weekStart, items]);

  const today = startOfDay(new Date());

  return (
    <div data-testid="mobile-week-view">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={onPrevWeek}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h3 className="text-sm font-medium">
          {format(weekStart, "dd MMM", { locale: ptBR })} —{" "}
          {format(addDays(weekStart, 6), "dd MMM yyyy", { locale: ptBR })}
        </h3>
        <Button variant="ghost" size="icon" onClick={onNextWeek}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      <div className="space-y-3">
        {days.map(({ date, items: dayItems }) => {
          const isToday = isSameDay(date, today);
          if (dayItems.length === 0 && !isToday) return null;
          return (
            <div
              key={date.toISOString()}
              className={`rounded-lg border p-3 ${isToday ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`text-sm font-semibold capitalize ${isToday ? "text-primary" : ""}`}
                >
                  {format(date, "EEEE, dd", { locale: ptBR })}
                </span>
                {dayItems.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] no-default-hover-elevate no-default-active-elevate"
                  >
                    {dayItems.length}
                  </Badge>
                )}
              </div>
              {dayItems.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum agendamento
                </p>
              ) : (
                <div className="space-y-2">
                  {dayItems.map((item) => (
                    <ItemCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ITEMS_PER_PAGE = 20;

export default function CalendarView() {
  const { user } = useAuth();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [month, setMonth] = useState<Date>(new Date());
  const [weekStart, setWeekStart] = useState<Date>(
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
  const { data: posts, isLoading: postsLoading } = usePosts();
  const { data: scheduledCards = [], isLoading: cardsLoading } = useQuery<
    any[]
  >({
    queryKey: ["/api/kanban/scheduled-cards"],
    refetchInterval: 15000,
  });
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });
  const [activeTab, setActiveTab] = useState("calendar");
  const [listPage, setListPage] = useState(0);

  const [clientFilter, setClientFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const resetFilters = useCallback((cf: string, pf: string, sf: string) => {
    setClientFilter(cf);
    setPlatformFilter(pf);
    setStatusFilter(sf);
    setListPage(0);
  }, []);

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
          platform: Array.isArray(post.platform)
            ? post.platform
            : [post.platform],
          scheduledDate: String(post.scheduledDate),
          status: normalizeStatus(post.status),
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
          platform: Array.isArray(card.platform)
            ? card.platform
            : card.platform
              ? [card.platform]
              : [],
          scheduledDate: card.scheduledDate,
          scheduledTime: card.scheduledTime || null,
          status: card.status,
          columnTitle: card.columnTitle,
          source: "kanban",
          cardType: card.cardType,
        });
      }
    }

    return items;
  }, [posts, scheduledCards]);

  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      if (clientFilter !== "all" && String(item.clientId) !== clientFilter)
        return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (platformFilter !== "all") {
        if (!item.platform.includes(platformFilter)) return false;
      }
      return true;
    });
  }, [allItems, clientFilter, platformFilter, statusFilter]);

  const dateMap = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of filteredItems) {
      if (!item.scheduledDate) continue;
      const key = format(safeParseDate(item.scheduledDate), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [filteredItems]);

  const itemsForSelectedDate = useMemo(() => {
    if (!date) return [];
    const key = format(date, "yyyy-MM-dd");
    return (dateMap.get(key) || []).sort((a, b) => {
      const timeA = a.scheduledTime || "99:99";
      const timeB = b.scheduledTime || "99:99";
      return timeA.localeCompare(timeB);
    });
  }, [dateMap, date]);

  const scheduledItems = useMemo(() => {
    const today = startOfDay(new Date());
    return filteredItems
      .filter((item) => {
        if (!item.scheduledDate) return false;
        return !isBefore(safeParseDate(item.scheduledDate), today);
      })
      .sort(
        (a, b) =>
          safeParseDate(a.scheduledDate).getTime() -
          safeParseDate(b.scheduledDate).getTime()
      );
  }, [filteredItems]);

  const paginatedScheduledItems = useMemo(() => {
    const start = listPage * ITEMS_PER_PAGE;
    return scheduledItems.slice(start, start + ITEMS_PER_PAGE);
  }, [scheduledItems, listPage]);

  const totalPages = Math.ceil(scheduledItems.length / ITEMS_PER_PAGE);

  const uniqueStatuses = useMemo(() => {
    return Array.from(new Set(allItems.map((i) => i.status))).sort();
  }, [allItems]);

  const hasDate = useCallback(
    (d: Date) => {
      const key = format(d, "yyyy-MM-dd");
      return dateMap.has(key);
    },
    [dateMap]
  );

  const getDateCount = useCallback(
    (d: Date) => {
      const key = format(d, "yyyy-MM-dd");
      return dateMap.get(key)?.length || 0;
    },
    [dateMap]
  );

  const handlePrevWeek = useCallback(() => {
    setWeekStart((prev) => addDays(prev, -7));
  }, []);

  const handleNextWeek = useCallback(() => {
    setWeekStart((prev) => addDays(prev, 7));
  }, []);

  const handleWeekDayClick = useCallback(
    (d: Date) => {
      setDate(d);
      setMonth(d);
      setActiveTab("calendar");
    },
    []
  );

  const isClient = user?.role === "client";

  const filterControls = (
    <div
      className="flex flex-wrap gap-2 items-center"
      data-testid="calendar-filters"
    >
      <Filter className="w-4 h-4 text-muted-foreground" />
      {!isClient && (
        <Select value={clientFilter} onValueChange={(v) => { setClientFilter(v); setListPage(0); }}>
          <SelectTrigger className="w-[160px]" data-testid="filter-client">
            <SelectValue placeholder="Todos os clientes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Select value={platformFilter} onValueChange={(v) => { setPlatformFilter(v); setListPage(0); }}>
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
      <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setListPage(0); }}>
        <SelectTrigger className="w-[140px]" data-testid="filter-status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {uniqueStatuses.map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_LABELS[s] || s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {((!isClient && clientFilter !== "all") ||
        platformFilter !== "all" ||
        statusFilter !== "all") && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => resetFilters(isClient ? clientFilter : "all", "all", "all")}
          data-testid="button-clear-filters"
        >
          Limpar filtros
        </Button>
      )}
    </div>
  );

  const overdueCount = useMemo(() => {
    const today = startOfDay(new Date());
    return filteredItems.filter((item) => {
      if (!item.scheduledDate) return false;
      const d = safeParseDate(item.scheduledDate);
      return (
        isBefore(d, today) &&
        item.status !== "Postado" &&
        item.status !== "Finalizado"
      );
    }).length;
  }, [filteredItems]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="section-title" data-testid="text-page-title">
            Calendário
          </h1>
          <p className="section-subtitle">
            Visualize seus agendamentos por data, semana ou lista.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {overdueCount > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1 no-default-hover-elevate no-default-active-elevate" data-testid="badge-overdue">
              <AlertTriangle className="w-3 h-3" />
              {overdueCount} atrasado{overdueCount > 1 ? "s" : ""}
            </Badge>
          )}
          <Badge
            variant="secondary"
            className="text-xs no-default-hover-elevate no-default-active-elevate"
            data-testid="badge-total"
          >
            {filteredItems.length} item
            {filteredItems.length !== 1 ? "s" : ""} no total
          </Badge>
        </div>
      </div>

      {filterControls}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="calendar-tabs">
          <TabsTrigger value="calendar" data-testid="tab-calendar">
            <CalendarDays className="w-4 h-4 mr-1.5" />
            Mês
          </TabsTrigger>
          <TabsTrigger value="week" data-testid="tab-week">
            <CalendarRange className="w-4 h-4 mr-1.5" />
            Semana
          </TabsTrigger>
          <TabsTrigger value="scheduled" data-testid="tab-scheduled">
            <ListFilter className="w-4 h-4 mr-1.5" />
            Lista
            {scheduledItems.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-1.5 text-[10px] no-default-hover-elevate no-default-active-elevate"
              >
                {scheduledItems.length}
              </Badge>
            )}
          </TabsTrigger>
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
                      hasItems: hasDate,
                    }}
                    modifiersStyles={{
                      hasItems: { fontWeight: "bold" },
                    }}
                    components={{
                      DayContent: ({ date: dayDate }) => {
                        const count = getDateCount(dayDate);
                        const dayItems = dateMap.get(format(dayDate, "yyyy-MM-dd"));
                        const hasOverdue =
                          dayItems?.some(
                            (i) =>
                              isBefore(
                                safeParseDate(i.scheduledDate),
                                startOfDay(new Date())
                              ) &&
                              i.status !== "Postado" &&
                              i.status !== "Finalizado"
                          ) || false;

                        return (
                          <div className="relative flex flex-col items-center">
                            <span>{dayDate.getDate()}</span>
                            {count > 0 && (
                              <div className="flex items-center gap-0.5 mt-0.5">
                                {count <= 3 ? (
                                  dayItems
                                    ?.slice(0, 3)
                                    .map((item, idx) => (
                                      <div
                                        key={idx}
                                        className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT_COLORS[item.status] || "bg-gray-400"}`}
                                      />
                                    ))
                                ) : (
                                  <>
                                    <div
                                      className={`w-1.5 h-1.5 rounded-full ${hasOverdue ? "bg-destructive" : "bg-primary"}`}
                                    />
                                    <span className="text-[8px] font-bold text-muted-foreground leading-none">
                                      {count}
                                    </span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      },
                    }}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-8">
              <Card className="h-full min-h-[500px]">
                <CardHeader className="border-b border-border bg-muted/20 flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-base font-semibold">
                    {date
                      ? format(date, "dd 'de' MMMM", { locale: ptBR })
                      : "Selecione uma data"}
                  </CardTitle>
                  <Badge
                    variant="secondary"
                    className="text-xs no-default-hover-elevate no-default-active-elevate"
                  >
                    {itemsForSelectedDate.length} item
                    {itemsForSelectedDate.length !== 1 ? "s" : ""}
                  </Badge>
                </CardHeader>
                <CardContent className="p-5">
                  {isLoading ? (
                    <div className="flex justify-center p-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                    </div>
                  ) : itemsForSelectedDate.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-sm">
                      <CalendarDays className="w-10 h-10 mb-3 opacity-30" />
                      <p>Nenhum agendamento para este dia.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {itemsForSelectedDate.map((item) => (
                        <ItemCard key={item.id} item={item} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="week">
          <Card>
            <CardContent className="p-5">
              <div className="hidden md:block">
                <WeekView
                  items={filteredItems}
                  weekStart={weekStart}
                  onPrevWeek={handlePrevWeek}
                  onNextWeek={handleNextWeek}
                  onDayClick={handleWeekDayClick}
                />
              </div>
              <div className="md:hidden">
                <MobileWeekView
                  items={filteredItems}
                  weekStart={weekStart}
                  onPrevWeek={handlePrevWeek}
                  onNextWeek={handleNextWeek}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduled">
          <Card>
            <CardHeader className="border-b border-border bg-muted/20 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ListFilter className="w-4 h-4" />
                Próximos Agendamentos
              </CardTitle>
              <Badge
                variant="secondary"
                className="text-xs no-default-hover-elevate no-default-active-elevate"
              >
                {scheduledItems.length} item
                {scheduledItems.length !== 1 ? "s" : ""}
              </Badge>
            </CardHeader>
            <CardContent className="p-5">
              {isLoading ? (
                <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                </div>
              ) : scheduledItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm">
                  <Clock className="w-10 h-10 mb-3 opacity-30" />
                  <p>Nenhum agendamento encontrado.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {paginatedScheduledItems.map((item) => (
                      <ItemCard key={item.id} item={item} />
                    ))}
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={listPage === 0}
                        onClick={() => setListPage((p) => p - 1)}
                        data-testid="button-prev-page"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {listPage + 1} de {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={listPage >= totalPages - 1}
                        onClick={() => setListPage((p) => p + 1)}
                        data-testid="button-next-page"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
