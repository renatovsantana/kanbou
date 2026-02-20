import { useQuery } from "@tanstack/react-query";
import { usePosts } from "@/hooks/use-posts";
import { useAuth } from "@/lib/auth";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Plus,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  Clock,
  FileEdit,
  Users,
  CheckSquare,
  AlertCircle,
  Eye,
  CalendarDays,
  Instagram,
  ExternalLink,
  Hash,
  Copy,
  Target,
  Zap,
  BarChart3,
  Activity,
  Globe,
  Percent,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { StatusBadge } from "@/components/status-badge";
import { PlatformIcon } from "@/components/platform-icon";
import type { ApprovalPost, Client, Competitor } from "@shared/schema";
import { CARD_TYPE_LABELS, CARD_TYPE_COLORS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface ClientSummary {
  columns: { id: number; title: string; count: number }[];
  recentCards: { id: number; title: string; cardType: string; columnTitle: string; updatedAt: string }[];
  totalCards: number;
  pendingApproval: number;
  approved: number;
  revision: number;
  rejected: number;
  scheduled: number;
  posted: number;
  finished: number;
  inProgress: number;
}

interface InsightsData {
  approvalRate: number;
  totalPosts: number;
  totalApprovals: number;
  approvedCount: number;
  monthlyData: { month: string; posts: number; approvals: number }[];
  platformBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
}

const HASHTAG_CATEGORIES: Record<string, { label: string; tags: string[] }> = {
  moda: {
    label: "Moda & Beleza",
    tags: ["#moda", "#fashion", "#lookdodia", "#style", "#tendencia", "#modafeminina", "#ootd", "#beleza", "#beauty", "#skincare", "#makeup", "#estilo", "#modabrasileira"],
  },
  gastronomia: {
    label: "Gastronomia",
    tags: ["#foodie", "#gastronomia", "#comida", "#receita", "#chef", "#restaurante", "#foodporn", "#instafood", "#culinaria", "#sabor", "#gourmet", "#delivery", "#comidaboa"],
  },
  tecnologia: {
    label: "Tecnologia",
    tags: ["#tech", "#tecnologia", "#inovacao", "#digital", "#startup", "#empreendedorismo", "#marketingdigital", "#ti", "#programacao", "#ia", "#inteligenciaartificial", "#cybersecurity"],
  },
  fitness: {
    label: "Fitness & Saúde",
    tags: ["#fitness", "#saude", "#treino", "#academia", "#gym", "#workout", "#vidasaudavel", "#dieta", "#nutrition", "#crossfit", "#corrida", "#bemestar", "#personaltrainer"],
  },
  marketing: {
    label: "Marketing Digital",
    tags: ["#marketing", "#marketingdigital", "#socialmedia", "#branding", "#conteudo", "#estrategia", "#leads", "#vendas", "#negocios", "#empreender", "#growthhacking", "#seo", "#trafegopago"],
  },
  brasil: {
    label: "Tendências Brasil",
    tags: ["#brasil", "#brazil", "#saopaulo", "#riodejaneiro", "#empreendedorismo", "#pme", "#negocioslocais", "#feito nobrasil", "#compredopequeno", "#apoieolocal", "#brasileiros", "#comunidade"],
  },
};

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: posts, isLoading: postsLoading } = usePosts();
  const { data: approvals = [], isLoading: approvalsLoading } = useQuery<ApprovalPost[]>({
    queryKey: ["/api/approvals"],
    refetchInterval: 30000,
  });
  const { data: clientsList = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    refetchInterval: 30000,
  });
  const { data: insights, isLoading: insightsLoading } = useQuery<InsightsData>({
    queryKey: ["/api/insights/overview"],
    refetchInterval: 30000,
  });
  const { data: allCompetitors = [] } = useQuery<Competitor[]>({
    queryKey: ["/api/competitors"],
    refetchInterval: 30000,
  });
  const { data: clientSummary, isLoading: clientSummaryLoading } = useQuery<ClientSummary>({
    queryKey: ["/api/dashboard/client-summary"],
    enabled: user?.role === "client",
    refetchInterval: 30000,
  });

  const [selectedHashtagCategory, setSelectedHashtagCategory] = useState("marketing");

  const isLoading = postsLoading || approvalsLoading || clientsLoading || insightsLoading || (user?.role === "client" && clientSummaryLoading);
  const userRole = user?.role || "admin";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  const allPosts = posts || [];
  const totalPosts = allPosts.length;
  const published = allPosts.filter(p => p.status === 'Publicado').length;
  const scheduled = allPosts.filter(p => p.status === 'Agendado').length;

  const totalApprovals = approvals.length;
  const pendingApprovals = approvals.filter(a => a.status === "Pendente").length;
  const approvedApprovals = approvals.filter(a => a.status === "Aprovado").length;
  const revisionApprovals = approvals.filter(a => a.status === "Revisão").length;

  const activeClients = clientsList.filter(c => c.isActive).length;

  const recentPosts = [...allPosts]
    .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())
    .slice(0, 5);

  const recentApprovals = [...approvals]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 5);

  const COLORS = ['hsl(135, 55%, 58%)', 'hsl(210, 60%, 55%)', 'hsl(280, 50%, 55%)', 'hsl(30, 80%, 55%)', 'hsl(350, 70%, 55%)', 'hsl(170, 50%, 50%)', 'hsl(45, 80%, 55%)'];

  const mainStats = userRole === "client" ? [
    { label: "Total Materiais", value: clientSummary?.totalCards || 0, icon: FileEdit, accent: false },
    { label: "Em Aprovação", value: clientSummary?.pendingApproval || 0, icon: Clock, accent: (clientSummary?.pendingApproval || 0) > 0 },
    { label: "Aprovados", value: clientSummary?.approved || 0, icon: CheckCircle2, accent: false },
    { label: "Agendados", value: clientSummary?.scheduled || 0, icon: CalendarDays, accent: false },
  ] : [
    { label: "Total Posts", value: totalPosts, icon: TrendingUp, accent: false },
    { label: "Publicados", value: published, icon: CheckCircle2, accent: true },
    { label: "Agendados", value: scheduled, icon: Clock, accent: false },
    { label: "Clientes Ativos", value: activeClients, icon: Users, accent: false },
  ];

  function ApprovalStatusIcon({ status }: { status: string }) {
    switch (status) {
      case "Aprovado":
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
      case "Revisão":
        return <AlertCircle className="w-3.5 h-3.5 text-primary" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  }

  const approvalRate = insights?.approvalRate ?? 0;
  const monthlyData = insights?.monthlyData ?? [];
  const platformBreakdown = insights?.platformBreakdown ?? {};
  const platformData = Object.entries(platformBreakdown).map(([name, value]) => ({ name, value }));

  const clientInstagram = userRole === "client"
    ? clientsList.find(c => c.id === user?.clientId)?.instagram
    : null;

  const clientsWithInstagram = clientsList.filter(c => c.instagram);

  function copyHashtags(tags: string[]) {
    navigator.clipboard.writeText(tags.join(" "));
    toast({ title: "Hashtags copiadas!", description: "Cole onde preferir." });
  }

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div>
          <h1 className="section-title" data-testid="text-page-title">Dashboard</h1>
          <p className="section-subtitle">
            {userRole === "client"
              ? "Acompanhe as postagens enviadas para sua aprovação"
              : "Visão geral completa da agência"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {mainStats.map((stat) => (
          <Card
            key={stat.label}
            className={stat.accent ? "bg-primary/10 border-primary/20" : ""}
            data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, '-')}`}
          >
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.accent ? 'bg-primary/20' : 'bg-muted'}`}>
                  <stat.icon className={`w-5 h-5 ${stat.accent ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                </div>
              </div>
              <p className="text-3xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {userRole === "client" ? (
          <>
            <Card>
              <CardContent className="pt-5 pb-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{clientSummary?.inProgress || 0}</p>
                  <p className="text-xs text-muted-foreground">Em Produção</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{clientSummary?.revision || 0}</p>
                  <p className="text-xs text-muted-foreground">Em Revisão</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-green-500/10 dark:bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{clientSummary?.finished || 0}</p>
                  <p className="text-xs text-muted-foreground">Finalizados</p>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardContent className="pt-5 pb-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center">
                  <Percent className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{approvalRate}%</p>
                  <p className="text-xs text-muted-foreground">Taxa de Aprovação</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center">
                  <CheckSquare className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingApprovals}</p>
                  <p className="text-xs text-muted-foreground">Aprovações Pendentes</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-rose-500 dark:text-rose-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{revisionApprovals}</p>
                  <p className="text-xs text-muted-foreground">Em Revisão</p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              Atividade Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Sem dados.</div>
            ) : (
              <>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={30} />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Bar dataKey="posts" name="Posts" fill="hsl(135, 55%, 58%)" radius={[4, 4, 0, 0]} maxBarSize={24} />
                      <Bar dataKey="approvals" name="Aprovações" fill="hsl(210, 60%, 55%)" radius={[4, 4, 0, 0]} maxBarSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "hsl(135, 55%, 58%)" }} />
                    <span className="text-xs text-muted-foreground">Posts</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "hsl(210, 60%, 55%)" }} />
                    <span className="text-xs text-muted-foreground">Aprovações</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              Por Plataforma
            </CardTitle>
          </CardHeader>
          <CardContent>
            {platformData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Sem dados.</div>
            ) : (
              <>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={platformData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {platformData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-3 mt-3">
                  {platformData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-xs text-muted-foreground">{entry.name} ({entry.value})</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {userRole !== "client" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
              <CardTitle className="text-base font-semibold">Próximas Publicações</CardTitle>
              <Link href="/calendar" className="inline-flex items-center text-xs font-medium text-muted-foreground transition-colors" data-testid="link-view-all-posts">
                Ver todos <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentPosts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Nenhum post encontrado.
                </div>
              ) : (
                recentPosts.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 hover-elevate transition-colors"
                    data-testid={`post-row-${post.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-card flex items-center justify-center gap-0.5 border border-border flex-shrink-0">
                        {(Array.isArray(post.platform) ? post.platform.slice(0, 2) : [post.platform]).map((p: string) => (
                          <PlatformIcon key={p} platform={p} />
                        ))}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{post.clientName}</p>
                        <p className="text-xs text-muted-foreground truncate">{post.title}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs font-medium">
                          {format(new Date(post.scheduledDate), "dd MMM", { locale: ptBR })}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {format(new Date(post.scheduledDate), "HH:mm")}
                        </p>
                      </div>
                      <StatusBadge status={post.status} />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
              <CardTitle className="text-base font-semibold">Aprovações Recentes</CardTitle>
              <Link href="/approvals" className="inline-flex items-center text-xs font-medium text-muted-foreground transition-colors" data-testid="link-view-approvals">
                Ver todas <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentApprovals.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma aprovação.</div>
              ) : (
                recentApprovals.map((approval) => (
                  <Link key={approval.id} href="/approvals">
                    <div
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 hover-elevate transition-colors"
                      data-testid={`approval-row-${approval.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-muted overflow-hidden flex-shrink-0">
                          {approval.imageUrl ? (
                            <img src={approval.imageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Eye className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{approval.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{approval.clientName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <ApprovalStatusIcon status={approval.status} />
                        <span className="text-xs text-muted-foreground">{approval.status}</span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {userRole === "client" && clientSummary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                Status dos Materiais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: "Em produção", value: clientSummary.inProgress, color: "bg-blue-500" },
                  { label: "Em aprovação", value: clientSummary.pendingApproval, color: "bg-amber-500" },
                  { label: "Aprovados", value: clientSummary.approved, color: "bg-emerald-500" },
                  { label: "Em revisão", value: clientSummary.revision, color: "bg-orange-500" },
                  { label: "Reprovados", value: clientSummary.rejected, color: "bg-red-500" },
                  { label: "Agendados", value: clientSummary.scheduled, color: "bg-cyan-500" },
                  { label: "Postados", value: clientSummary.posted, color: "bg-green-600" },
                  { label: "Finalizados", value: clientSummary.finished, color: "bg-gray-500" },
                ].filter(item => item.value > 0).map(item => (
                  <div key={item.label} className="flex items-center justify-between gap-3" data-testid={`client-status-${item.label}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full ${item.color} flex-shrink-0`} />
                      <span className="text-sm text-foreground">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${item.color}`}
                          style={{ width: `${Math.min(100, (item.value / (clientSummary.totalCards || 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold w-8 text-right">{item.value}</span>
                    </div>
                  </div>
                ))}
                {clientSummary.totalCards === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Nenhum material encontrado.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileEdit className="w-4 h-4 text-muted-foreground" />
                Materiais Recentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(clientSummary.recentCards || []).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhum material recente.
                </div>
              ) : (
                clientSummary.recentCards.map((card) => {
                  const typeLabel = CARD_TYPE_LABELS[card.cardType as keyof typeof CARD_TYPE_LABELS] || card.cardType;
                  const STRIPE_COLORS: Record<string, string> = {
                    post: "#3b82f6", material_offline: "#f59e0b", material_digital: "#a855f7",
                    copy: "#10b981", roteiro: "#ef4444", identidade_visual: "#ec4899", geral: "#6b7280",
                  };
                  const stripeColor = STRIPE_COLORS[card.cardType] || "#6b7280";
                  return (
                    <div
                      key={card.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 transition-colors"
                      data-testid={`client-card-${card.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: stripeColor }} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{card.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{typeLabel}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[11px] flex-shrink-0">
                        {card.columnTitle}
                      </Badge>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Instagram className="w-4 h-4 text-muted-foreground" />
              Feed Instagram
            </CardTitle>
          </CardHeader>
          <CardContent>
            {userRole === "client" ? (
              clientInstagram ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
                      <Instagram className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{clientInstagram}</p>
                      <p className="text-xs text-muted-foreground">Seu perfil no Instagram</p>
                    </div>
                    <a
                      href={`https://instagram.com/${clientInstagram.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="link-instagram-profile"
                    >
                      <Button variant="outline" size="sm">
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                        Abrir
                      </Button>
                    </a>
                  </div>
                  <div className="rounded-xl border border-border overflow-hidden">
                    <iframe
                      src={`https://www.instagram.com/${clientInstagram.replace('@', '')}/embed`}
                      className="w-full h-[400px] border-0"
                      title="Instagram Feed"
                      loading="lazy"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Instagram className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Perfil do Instagram não configurado.</p>
                  <p className="text-xs mt-1">Peça ao administrador para adicionar seu @ nas configurações do cliente.</p>
                </div>
              )
            ) : (
              clientsWithInstagram.length > 0 ? (
                <div className="space-y-2">
                  {clientsWithInstagram.slice(0, 6).map((client) => (
                    <div
                      key={client.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover-elevate transition-colors"
                      data-testid={`instagram-client-${client.id}`}
                    >
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center flex-shrink-0">
                        <Instagram className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{client.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{client.instagram}</p>
                      </div>
                      <a
                        href={`https://instagram.com/${(client.instagram || '').replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid={`link-instagram-${client.id}`}
                      >
                        <Button variant="ghost" size="icon">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Instagram className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Nenhum cliente com Instagram cadastrado.</p>
                  <p className="text-xs mt-1">Adicione o @ do Instagram nas configurações dos clientes.</p>
                </div>
              )
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              Concorrentes
            </CardTitle>
            {(userRole === "admin" || userRole === "designer") && (
              <Link href="/clients" className="inline-flex items-center text-xs font-medium text-muted-foreground transition-colors" data-testid="link-manage-competitors">
                Gerenciar <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            )}
          </CardHeader>
          <CardContent>
            {allCompetitors.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>Nenhum concorrente cadastrado.</p>
                {(userRole === "admin" || userRole === "designer") && (
                  <p className="text-xs mt-1">Adicione concorrentes na página de clientes.</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {allCompetitors.slice(0, 8).map((comp) => {
                  const client = clientsList.find(c => c.id === comp.clientId);
                  return (
                    <div
                      key={comp.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-muted/40"
                      data-testid={`competitor-${comp.id}`}
                    >
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <Target className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{comp.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {client?.name || ""}
                          {comp.instagram ? ` · ${comp.instagram}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {comp.instagram && (
                          <a href={`https://instagram.com/${comp.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" data-testid={`link-comp-ig-${comp.id}`}>
                              <Instagram className="w-3.5 h-3.5" />
                            </Button>
                          </a>
                        )}
                        {comp.website && (
                          <a href={comp.website.startsWith('http') ? comp.website : `https://${comp.website}`} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" data-testid={`link-comp-web-${comp.id}`}>
                              <Globe className="w-3.5 h-3.5" />
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Hash className="w-4 h-4 text-muted-foreground" />
            Hashtags em Alta
          </CardTitle>
          <div className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs text-muted-foreground">Sugestões populares</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(HASHTAG_CATEGORIES).map(([key, cat]) => (
              <Button
                key={key}
                variant={selectedHashtagCategory === key ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedHashtagCategory(key)}
                data-testid={`button-hashtag-cat-${key}`}
                className="toggle-elevate"
              >
                {cat.label}
              </Button>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {HASHTAG_CATEGORIES[selectedHashtagCategory]?.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="cursor-pointer text-xs"
                  onClick={() => {
                    navigator.clipboard.writeText(tag);
                    toast({ title: `${tag} copiada!` });
                  }}
                  data-testid={`hashtag-${tag.replace('#', '')}`}
                >
                  {tag}
                </Badge>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyHashtags(HASHTAG_CATEGORIES[selectedHashtagCategory]?.tags || [])}
                data-testid="button-copy-all-hashtags"
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                Copiar Todas
              </Button>
              <span className="text-xs text-muted-foreground">
                {HASHTAG_CATEGORIES[selectedHashtagCategory]?.tags.length || 0} hashtags
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
