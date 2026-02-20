import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, User, Palette } from "lucide-react";

interface QuickAccount {
  id: number;
  name: string;
  email: string;
  role: string;
  clientName?: string | null;
}

const ROLE_ICONS: Record<string, typeof Shield> = {
  admin: Shield,
  designer: Palette,
  client: User,
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  designer: "Designer",
  client: "Cliente",
};

export default function LoginPage() {
  const { login, quickLogin } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [quickLoading, setQuickLoading] = useState<number | null>(null);
  const [quickAccounts, setQuickAccounts] = useState<QuickAccount[]>([]);

  useEffect(() => {
    fetch("/api/auth/quick-accounts")
      .then((r) => r.json())
      .then((data) => setQuickAccounts(data))
      .catch(() => {});
  }, []);

  const handleQuickLogin = async (userId: number) => {
    setQuickLoading(userId);
    try {
      await quickLogin(userId);
      setLocation("/");
    } catch (err: any) {
      toast({
        title: "Erro",
        description: "Falha no acesso rápido",
        variant: "destructive",
      });
    } finally {
      setQuickLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email, password);
      setLocation("/");
    } catch (err: any) {
      const msg = err?.message || "Erro ao fazer login";
      let parsed = msg;
      try {
        const json = JSON.parse(msg.replace(/^\d+:\s*/, ""));
        parsed = json.message || msg;
      } catch {}
      toast({
        title: "Erro",
        description: parsed,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12" style={{ background: 'hsl(0 0% 10%)' }}>
        <div className="max-w-md space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl" style={{ background: 'hsl(135 55% 58%)', color: 'hsl(0 0% 10%)' }}>
              S
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold" style={{ color: 'hsl(0 0% 92%)' }}>Shift</h2>
              <p className="text-sm" style={{ color: 'hsl(0 0% 55%)' }}>Agency Manager</p>
            </div>
          </div>
          <div className="space-y-4">
            <h1 className="font-display text-4xl font-bold leading-tight" style={{ color: 'hsl(0 0% 92%)' }}>
              Gerencie suas redes sociais em um só lugar
            </h1>
            <p className="text-lg leading-relaxed" style={{ color: 'hsl(0 0% 50%)' }}>
              Agende posts, aprove conteúdos e acompanhe métricas de todos os seus clientes.
            </p>
          </div>
          <div className="flex gap-4">
            <div className="flex -space-x-2">
              {["MA", "JC", "RS"].map((initials, i) => (
                <div
                  key={i}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-white/10"
                  style={{
                    background: i === 0 ? 'hsl(135 55% 58%)' : i === 1 ? 'hsl(210 60% 55%)' : 'hsl(280 50% 55%)',
                    color: 'hsl(0 0% 100%)',
                  }}
                >
                  {initials}
                </div>
              ))}
            </div>
            <p className="text-sm self-center" style={{ color: 'hsl(0 0% 50%)' }}>
              Usado por agências em todo o Brasil
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden text-center space-y-3">
            <div className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center font-bold text-xl bg-primary text-primary-foreground">
              S
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground" data-testid="text-login-title">
              Shift Agency
            </h1>
          </div>

          <div className="hidden lg:block space-y-2">
            <h2 className="font-display text-2xl font-bold text-foreground" data-testid="text-login-title">
              Bem-vindo de volta
            </h2>
            <p className="text-sm text-muted-foreground">
              Entre com suas credenciais para acessar o sistema
            </p>
          </div>

          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6 pb-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11"
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11"
                    data-testid="input-password"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-11"
                  disabled={isLoading}
                  data-testid="button-login"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Entrar
                </Button>
              </form>
            </CardContent>
          </Card>

          {quickAccounts.length > 0 && (
            <div className="space-y-3">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Acesso Rápido</span>
                </div>
              </div>
              <div className="grid gap-2">
                {quickAccounts.map((account) => {
                  const Icon = ROLE_ICONS[account.role] || User;
                  const roleLabel = ROLE_LABELS[account.role] || account.role;
                  return (
                    <Button
                      key={account.id}
                      variant="outline"
                      className="w-full justify-start gap-3"
                      disabled={quickLoading === account.id}
                      onClick={() => handleQuickLogin(account.id)}
                      data-testid={`button-quick-login-${account.id}`}
                    >
                      {quickLoading === account.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                      <span className="flex-1 text-left truncate">
                        {account.name}
                        {account.clientName && (
                          <span className="text-muted-foreground text-xs ml-1">({account.clientName})</span>
                        )}
                      </span>
                      <Badge variant="secondary" className="text-[10px] no-default-hover-elevate no-default-active-elevate">
                        {roleLabel}
                      </Badge>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
