import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Users, BarChart3, ChevronDown, ChevronRight, CheckCircle, XCircle, RotateCcw, Filter, FileText, ArrowRight, MoveRight, Building2, CalendarDays, Send, Eye, Printer } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { CARD_TYPES, TIMED_COLUMNS, type CardType } from "@shared/schema";
import type { Client, User } from "@shared/schema";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface WorkflowReport {
  totalCards: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byClient: Record<number, number>;
  approvedCount: number;
  rejectedCount: number;
  revisionCount: number;
  pendingCount: number;
  avgApprovalTimeHours: number;
  cards: any[];
}

interface MoveDetail {
  from: string;
  to: string;
  movedAt: string;
}

interface UserCardDetail {
  cardId: number;
  cardTitle: string;
  clientName: string;
  totalMoves: number;
  moves: MoveDetail[];
}

interface UserReport {
  userId: number;
  userName: string;
  totalMoves: number;
  totalCardsTouched: number;
  columnMovements: Record<string, number>;
  cards: UserCardDetail[];
}

interface ColumnTimeEntry {
  columnName: string;
  totalHours: number;
  avgHours: number;
  totalEntries: number;
}

interface MovementReport {
  totalMovements: number;
  totalUsersActive: number;
  totalCardsWithMovements: number;
  userReports: UserReport[];
  columnTimeReport: ColumnTimeEntry[];
}

function formatHours(hours: number): string {
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes}m`;
  }
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m > 0) return `${h}h ${m}m`;
  return `${h}h`;
}

const CARD_TYPE_LABELS: Record<string, string> = {
  geral: "Geral",
  post: "Post",
  material_offline: "Material Offline",
  material_digital: "Material Digital",
  copy: "Copy",
  roteiro: "Roteiro",
  identidade_visual: "Identidade Visual",
};

const STATUS_LABELS: Record<string, string> = {
  Pendente: "Em Aprovação",
  Aprovado: "Aprovados",
  Reprovado: "Reprovados",
  "Revisão": "Revisão",
  sem_aprovacao: "Sem Aprovação",
};

const CHART_COLORS = ["#84cc16", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#6b7280"];

export default function ReportsPage() {
  const { user } = useAuth();
  const isClient = user?.role === "client";
  const [expandedUsers, setExpandedUsers] = useState<Set<number>>(new Set());
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState(isClient ? "client-activity" : "workflow");

  const [clientFilter, setClientFilter] = useState<string>("all");
  const [cardTypeFilter, setCardTypeFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("30");

  const [movClientFilter, setMovClientFilter] = useState<string>("all");
  const [movUserFilter, setMovUserFilter] = useState<string>("all");
  const [movPeriodFilter, setMovPeriodFilter] = useState<string>("30");

  const now = new Date();
  const [actClientFilter, setActClientFilter] = useState<string>(isClient && user?.clientId ? String(user.clientId) : "all");
  const [actMonth, setActMonth] = useState<string>(String(now.getMonth() + 1));
  const [actYear, setActYear] = useState<string>(String(now.getFullYear()));

  const { data: clientsData = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: usersData = [] } = useQuery<User[]>({ queryKey: ["/api/users"] });

  const workflowQueryKey = useMemo(() => {
    const params: Record<string, string> = {};
    if (clientFilter !== "all") params.clientId = clientFilter;
    if (cardTypeFilter !== "all") params.cardType = cardTypeFilter;
    if (userFilter !== "all") params.assignedUserId = userFilter;
    if (periodFilter !== "all") {
      const end = new Date();
      const start = new Date();
      const days = Number(periodFilter);
      start.setDate(end.getDate() - days);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      params.startDate = start.toISOString();
      params.endDate = end.toISOString();
    }
    const qs = new URLSearchParams(params).toString();
    return `/api/reports/workflow${qs ? `?${qs}` : ""}`;
  }, [clientFilter, cardTypeFilter, userFilter, periodFilter]);

  const movementQueryKey = useMemo(() => {
    const params: Record<string, string> = {};
    if (movClientFilter !== "all") params.clientId = movClientFilter;
    if (movUserFilter !== "all") params.userId = movUserFilter;
    if (movPeriodFilter !== "all") {
      const end = new Date();
      const start = new Date();
      const days = Number(movPeriodFilter);
      start.setDate(end.getDate() - days);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      params.startDate = start.toISOString();
      params.endDate = end.toISOString();
    }
    const qs = new URLSearchParams(params).toString();
    return `/api/reports/movements${qs ? `?${qs}` : ""}`;
  }, [movClientFilter, movUserFilter, movPeriodFilter]);

  const { data: workflowData, isLoading: workflowLoading } = useQuery<WorkflowReport>({
    queryKey: [workflowQueryKey],
  });

  const { data: movementData, isLoading: movementLoading } = useQuery<MovementReport>({
    queryKey: [movementQueryKey],
  });

  const activityQueryKey = useMemo(() => {
    const params: Record<string, string> = {};
    if (actClientFilter !== "all") params.clientId = actClientFilter;
    params.month = actMonth;
    params.year = actYear;
    const qs = new URLSearchParams(params).toString();
    return `/api/reports/client-activity?${qs}`;
  }, [actClientFilter, actMonth, actYear]);

  interface ClientActivityReport {
    clientId: number;
    clientName: string;
    clientLogoUrl: string | null;
    period: { month: number; year: number };
    totalCardsCreated: number;
    totalCardsAll: number;
    approvedCount: number;
    pendingApprovalCount: number;
    scheduledCount: number;
    postedCount: number;
    finishedCount: number;
    revisionCount: number;
    rejectedCount: number;
    totalPostsCreated: number;
    scheduledPostsCount: number;
    publishedPostsCount: number;
    byType: Record<string, number>;
    byPlatform: Record<string, number>;
  }

  const { data: activityData = [], isLoading: activityLoading } = useQuery<ClientActivityReport[]>({
    queryKey: [activityQueryKey],
  });

  const toggleUser = (userId: number) => {
    const next = new Set(expandedUsers);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    setExpandedUsers(next);
  };

  const toggleCard = (key: string) => {
    const next = new Set(expandedCards);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedCards(next);
  };

  const typeChartData = workflowData
    ? Object.entries(workflowData.byType).map(([key, value]) => ({
        name: CARD_TYPE_LABELS[key] || key,
        value,
      }))
    : [];

  const statusChartData = workflowData
    ? [
        { name: "Aprovados", value: workflowData.approvedCount, color: "#84cc16" },
        { name: "Reprovados", value: workflowData.rejectedCount, color: "#ef4444" },
        { name: "Revisão", value: workflowData.revisionCount, color: "#f59e0b" },
        { name: "Em Aprovação", value: workflowData.pendingCount, color: "#3b82f6" },
      ].filter((d) => d.value > 0)
    : [];

  const clientChartData = workflowData
    ? Object.entries(workflowData.byClient)
        .map(([id, count]) => {
          const client = clientsData.find((c) => c.id === Number(id));
          return { name: client?.name || `Cliente ${id}`, value: count };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 10)
    : [];

  const columnTimeChartData = movementData?.columnTimeReport?.map((ct) => ({
    name: ct.columnName,
    horas: ct.totalHours,
    media: ct.avgHours,
  })) || [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap" data-testid="section-title">
            <div>
              <h1 className="text-3xl font-bold text-foreground" data-testid="text-page-title">
                Relatórios
              </h1>
              <p className="text-sm text-muted-foreground mt-1" data-testid="text-page-subtitle">
                Acompanhamento de fluxo de trabalho e atividades
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => window.print()}
              className="print:hidden"
              data-testid="button-print-report"
            >
              <Printer className="w-4 h-4 mr-2" />
              Imprimir / PDF
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList data-testid="tabs-reports">
              {!isClient && (
                <>
                  <TabsTrigger value="workflow" data-testid="tab-workflow">
                    <FileText className="w-4 h-4 mr-2" />
                    Fluxo de Trabalho
                  </TabsTrigger>
                  <TabsTrigger value="movements" data-testid="tab-movements">
                    <MoveRight className="w-4 h-4 mr-2" />
                    Atividade por Usuário
                  </TabsTrigger>
                </>
              )}
              <TabsTrigger value="client-activity" data-testid="tab-client-activity">
                <Building2 className="w-4 h-4 mr-2" />
                Relatório por Cliente
              </TabsTrigger>
            </TabsList>

            <TabsContent value="workflow" className="space-y-6 mt-4">
              <Card data-testid="card-filters">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Filtros
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Cliente</label>
                      <Select value={clientFilter} onValueChange={setClientFilter}>
                        <SelectTrigger data-testid="select-client-filter">
                          <SelectValue placeholder="Todos os clientes" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os clientes</SelectItem>
                          {clientsData.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Tipo de Card</label>
                      <Select value={cardTypeFilter} onValueChange={setCardTypeFilter}>
                        <SelectTrigger data-testid="select-type-filter">
                          <SelectValue placeholder="Todos os tipos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os tipos</SelectItem>
                          {Object.entries(CARD_TYPE_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Responsável</label>
                      <Select value={userFilter} onValueChange={setUserFilter}>
                        <SelectTrigger data-testid="select-user-filter">
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {usersData.filter(u => u.role !== "client").map((u) => (
                            <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Período</label>
                      <Select value={periodFilter} onValueChange={setPeriodFilter}>
                        <SelectTrigger data-testid="select-period-filter">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">Últimos 7 dias</SelectItem>
                          <SelectItem value="30">Últimos 30 dias</SelectItem>
                          <SelectItem value="90">Últimos 90 dias</SelectItem>
                          <SelectItem value="365">Último ano</SelectItem>
                          <SelectItem value="all">Todo o período</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {workflowLoading ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-muted-foreground">Carregando relatório...</p>
                </div>
              ) : workflowData ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <Card data-testid="card-total">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                        <CardTitle className="text-sm font-medium">Total de Cards</CardTitle>
                        <BarChart3 className="w-4 h-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold" data-testid="text-total-cards">
                          {workflowData.totalCards}
                        </div>
                      </CardContent>
                    </Card>
                    <Card data-testid="card-approved">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                        <CardTitle className="text-sm font-medium">Aprovados</CardTitle>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-600" data-testid="text-approved">
                          {workflowData.approvedCount}
                        </div>
                      </CardContent>
                    </Card>
                    <Card data-testid="card-rejected">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                        <CardTitle className="text-sm font-medium">Reprovados</CardTitle>
                        <XCircle className="w-4 h-4 text-red-500" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-red-600" data-testid="text-rejected">
                          {workflowData.rejectedCount}
                        </div>
                      </CardContent>
                    </Card>
                    <Card data-testid="card-revision">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                        <CardTitle className="text-sm font-medium">Em Revisão</CardTitle>
                        <RotateCcw className="w-4 h-4 text-amber-500" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-amber-600" data-testid="text-revision">
                          {workflowData.revisionCount}
                        </div>
                      </CardContent>
                    </Card>
                    <Card data-testid="card-avg-time">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                        <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
                        <Clock className="w-4 h-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold" data-testid="text-avg-time">
                          {workflowData.avgApprovalTimeHours}h
                        </div>
                        <p className="text-xs text-muted-foreground">para aprovação</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card data-testid="card-chart-status">
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">Status de Aprovação</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {statusChartData.length > 0 ? (
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie data={statusChartData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                {statusChartData.map((entry, i) => (
                                  <Cell key={i} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado de aprovação</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card data-testid="card-chart-type">
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">Cards por Tipo</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {typeChartData.length > 0 ? (
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={typeChartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                              <YAxis allowDecimals={false} />
                              <Tooltip />
                              <Bar dataKey="value" fill="#84cc16" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado disponível</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {clientChartData.length > 0 && (
                    <Card data-testid="card-chart-clients">
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">Cards por Cliente (Top 10)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={clientChartData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" allowDecimals={false} />
                            <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
                            <Tooltip />
                            <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : null}
            </TabsContent>

            <TabsContent value="movements" className="space-y-6 mt-4">
              <Card data-testid="card-movement-filters">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Filtros
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Cliente</label>
                      <Select value={movClientFilter} onValueChange={setMovClientFilter}>
                        <SelectTrigger data-testid="select-mov-client-filter">
                          <SelectValue placeholder="Todos os clientes" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os clientes</SelectItem>
                          {clientsData.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Usuário</label>
                      <Select value={movUserFilter} onValueChange={setMovUserFilter}>
                        <SelectTrigger data-testid="select-mov-user-filter">
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {usersData.filter(u => u.role !== "client").map((u) => (
                            <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Período</label>
                      <Select value={movPeriodFilter} onValueChange={setMovPeriodFilter}>
                        <SelectTrigger data-testid="select-mov-period-filter">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">Últimos 7 dias</SelectItem>
                          <SelectItem value="30">Últimos 30 dias</SelectItem>
                          <SelectItem value="90">Últimos 90 dias</SelectItem>
                          <SelectItem value="365">Último ano</SelectItem>
                          <SelectItem value="all">Todo o período</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {movementLoading ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-muted-foreground">Carregando relatório...</p>
                </div>
              ) : movementData ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card data-testid="card-total-movements">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                        <CardTitle className="text-sm font-medium">Total de Movimentações</CardTitle>
                        <MoveRight className="w-4 h-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold" data-testid="text-total-movements">{movementData.totalMovements}</div>
                        <p className="text-xs text-muted-foreground mt-1">cards movidos entre colunas</p>
                      </CardContent>
                    </Card>
                    <Card data-testid="card-active-users">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                        <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
                        <Users className="w-4 h-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold" data-testid="text-active-users">{movementData.totalUsersActive}</div>
                        <p className="text-xs text-muted-foreground mt-1">que moveram cards</p>
                      </CardContent>
                    </Card>
                    <Card data-testid="card-cards-with-movements">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                        <CardTitle className="text-sm font-medium">Cards Movimentados</CardTitle>
                        <BarChart3 className="w-4 h-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold" data-testid="text-cards-moved">{movementData.totalCardsWithMovements}</div>
                        <p className="text-xs text-muted-foreground mt-1">cards com histórico</p>
                      </CardContent>
                    </Card>
                  </div>

                  {movementData.columnTimeReport.some(ct => TIMED_COLUMNS.includes(ct.columnName)) && (
                    <Card data-testid="card-production-stages">
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">Tempo nas Etapas de Produção</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {TIMED_COLUMNS.map((colName) => {
                            const data = movementData.columnTimeReport.find(ct => ct.columnName === colName);
                            return (
                              <div key={colName} className="rounded-md border p-4" data-testid={`production-stage-${colName.replace(/\s/g, "-").toLowerCase()}`}>
                                <p className="text-sm font-medium text-foreground">{colName}</p>
                                <p className="text-2xl font-bold mt-1">{data ? formatHours(data.totalHours) : "0m"}</p>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-xs text-muted-foreground">Média: {data ? formatHours(data.avgHours) : "0m"}</span>
                                  <span className="text-xs text-muted-foreground">{data?.totalEntries || 0} passagens</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {columnTimeChartData.length > 0 && (
                    <Card data-testid="card-chart-column-time">
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">Tempo Total por Coluna (horas)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={columnTimeChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={80} />
                            <YAxis allowDecimals={false} />
                            <Tooltip formatter={(value: number) => [`${value}h`, ""]} />
                            <Bar dataKey="horas" name="Total (h)" fill="#84cc16" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="media" name="Média (h)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}

                  {movementData.userReports.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                      <p className="text-muted-foreground">Nenhuma movimentação registrada no período</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {movementData.userReports.map((userReport) => (
                        <Card key={userReport.userId} data-testid={`card-user-report-${userReport.userId}`}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-lg" data-testid={`text-user-name-${userReport.userId}`}>
                                  {userReport.userName}
                                </CardTitle>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="secondary">{userReport.totalMoves} movimentações</Badge>
                                <Badge variant="secondary">{userReport.totalCardsTouched} cards</Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleUser(userReport.userId)}
                                data-testid={`button-toggle-user-${userReport.userId}`}
                              >
                                {expandedUsers.has(userReport.userId) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </Button>
                            </div>
                          </CardHeader>
                          {expandedUsers.has(userReport.userId) && (
                            <CardContent className="space-y-4">
                              {Object.keys(userReport.columnMovements).length > 0 && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-2 font-medium">Movimentações por Destino</p>
                                  <div className="flex flex-wrap gap-2">
                                    {Object.entries(userReport.columnMovements)
                                      .sort(([, a], [, b]) => b - a)
                                      .map(([colName, count]) => (
                                        <Badge key={colName} variant="outline">
                                          {colName}: {count}
                                        </Badge>
                                      ))}
                                  </div>
                                </div>
                              )}

                              <div className="border-t pt-4">
                                <p className="text-xs text-muted-foreground mb-2 font-medium">Cards Trabalhados</p>
                                <div className="space-y-2">
                                  {userReport.cards.map((card) => {
                                    const cardKey = `${userReport.userId}-${card.cardId}`;
                                    const isExpanded = expandedCards.has(cardKey);
                                    return (
                                      <div key={card.cardId} className="rounded-md bg-muted/50">
                                        <div
                                          className="flex items-center justify-between gap-2 p-2 cursor-pointer"
                                          onClick={() => toggleCard(cardKey)}
                                          data-testid={`card-detail-${card.cardId}`}
                                        >
                                          <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm truncate">{card.cardTitle}</p>
                                            <p className="text-xs text-muted-foreground truncate">{card.clientName}</p>
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0">
                                            <Badge variant="secondary" className="text-xs">{card.totalMoves} mov.</Badge>
                                            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                          </div>
                                        </div>
                                        {isExpanded && (
                                          <div className="px-3 pb-3 space-y-1">
                                            {card.moves.map((move, idx) => (
                                              <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                                                <span className="text-foreground font-medium shrink-0">
                                                  {new Date(move.movedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                                </span>
                                                <span className="truncate">{move.from}</span>
                                                <ArrowRight className="w-3 h-3 shrink-0" />
                                                <span className="truncate">{move.to}</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}
                </>
              ) : null}
            </TabsContent>

            <TabsContent value="client-activity" className="space-y-6 mt-4">
              <Card data-testid="card-client-activity-filters">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Filtros
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`grid grid-cols-1 ${isClient ? "sm:grid-cols-2" : "sm:grid-cols-3"} gap-3`}>
                    {!isClient && (
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Cliente</label>
                        <Select value={actClientFilter} onValueChange={setActClientFilter}>
                          <SelectTrigger data-testid="select-act-client-filter">
                            <SelectValue placeholder="Todos os clientes" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos os clientes</SelectItem>
                            {clientsData.map((c) => (
                              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Mês</label>
                      <Select value={actMonth} onValueChange={setActMonth}>
                        <SelectTrigger data-testid="select-act-month">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"].map((m, i) => (
                            <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Ano</label>
                      <Select value={actYear} onValueChange={setActYear}>
                        <SelectTrigger data-testid="select-act-year">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[2024, 2025, 2026].map((y) => (
                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {activityLoading ? (
                <div className="flex items-center justify-center py-12" data-testid="loading-activity">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : activityData.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhum dado encontrado para o período selecionado</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {activityData.map((report) => {
                    const typeData = Object.entries(report.byType).map(([key, value]) => ({
                      name: CARD_TYPE_LABELS[key] || key,
                      value,
                    }));
                    const platformData = Object.entries(report.byPlatform).map(([key, value]) => ({
                      name: key.charAt(0).toUpperCase() + key.slice(1),
                      value,
                    }));

                    return (
                      <Card key={report.clientId} data-testid={`card-client-report-${report.clientId}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            {report.clientLogoUrl ? (
                              <img src={report.clientLogoUrl} alt={report.clientName} className="w-10 h-10 rounded-lg object-cover" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                                {report.clientName.charAt(0)}
                              </div>
                            )}
                            <div>
                              <CardTitle className="text-lg">{report.clientName}</CardTitle>
                              <p className="text-xs text-muted-foreground">
                                {["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"][report.period.month]} {report.period.year}
                              </p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-5">
                          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                            <div className="bg-muted/50 rounded-lg p-3 text-center">
                              <p className="text-2xl font-bold text-foreground">{report.totalCardsCreated}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Cards criados</p>
                            </div>
                            <div className="bg-emerald-500/10 rounded-lg p-3 text-center">
                              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{report.approvedCount}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Aprovados</p>
                            </div>
                            <div className="bg-blue-500/10 rounded-lg p-3 text-center">
                              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{report.pendingApprovalCount}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Em aprovação</p>
                            </div>
                            <div className="bg-cyan-500/10 rounded-lg p-3 text-center">
                              <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{report.scheduledCount}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Agendados</p>
                            </div>
                            <div className="bg-purple-500/10 rounded-lg p-3 text-center">
                              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{report.postedCount}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Postados</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-muted/30 rounded-lg p-3 text-center">
                              <p className="text-xl font-bold">{report.finishedCount}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Finalizados</p>
                            </div>
                            <div className="bg-amber-500/10 rounded-lg p-3 text-center">
                              <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{report.revisionCount}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Em revisão</p>
                            </div>
                            <div className="bg-red-500/10 rounded-lg p-3 text-center">
                              <p className="text-xl font-bold text-red-600 dark:text-red-400">{report.rejectedCount}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Reprovados</p>
                            </div>
                            <div className="bg-muted/30 rounded-lg p-3 text-center">
                              <p className="text-xl font-bold">{report.totalCardsAll}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Total acumulado</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t">
                            <div className="bg-muted/30 rounded-lg p-3 text-center">
                              <p className="text-xl font-bold">{report.totalPostsCreated}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Posts criados</p>
                            </div>
                            <div className="bg-cyan-500/10 rounded-lg p-3 text-center">
                              <p className="text-xl font-bold text-cyan-600 dark:text-cyan-400">{report.scheduledPostsCount}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Posts agendados</p>
                            </div>
                            <div className="bg-emerald-500/10 rounded-lg p-3 text-center">
                              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{report.publishedPostsCount}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Posts publicados</p>
                            </div>
                          </div>

                          {(typeData.length > 0 || platformData.length > 0) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                              {typeData.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Por tipo de card</p>
                                  <div className="h-48">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <PieChart>
                                        <Pie data={typeData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                                          {typeData.map((_, i) => (
                                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                          ))}
                                        </Pie>
                                        <Tooltip />
                                      </PieChart>
                                    </ResponsiveContainer>
                                  </div>
                                </div>
                              )}
                              {platformData.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Por plataforma</p>
                                  <div className="h-48">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <BarChart data={platformData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                                        <Tooltip />
                                        <Bar dataKey="value" fill="#84cc16" radius={[4, 4, 0, 0]} />
                                      </BarChart>
                                    </ResponsiveContainer>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
