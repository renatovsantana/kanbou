import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

type BrandingData = {
  systemName: string;
  systemLogo: string;
  systemFavicon: string;
  systemTheme: string;
};

export default function LoginPage() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: branding } = useQuery<BrandingData>({
    queryKey: ["/api/settings/branding"],
    staleTime: 5 * 60 * 1000,
  });

  const sysName = branding?.systemName || "Shift";
  const sysLogo = branding?.systemLogo || "";
  const sysInitial = sysName.charAt(0).toUpperCase();
  const [email, setEmail] = useState(() => localStorage.getItem("remembered_email") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem("remembered_email"));
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (rememberMe) {
        localStorage.setItem("remembered_email", email);
      } else {
        localStorage.removeItem("remembered_email");
      }
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
            {sysLogo ? (
              <img src={sysLogo} alt={sysName} className="w-12 h-12 rounded-xl object-contain" />
            ) : (
              <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl" style={{ background: 'hsl(var(--primary))', color: 'hsl(0 0% 100%)' }}>
                {sysInitial}
              </div>
            )}
            <div>
              <h2 className="font-display text-2xl font-bold" style={{ color: 'hsl(0 0% 92%)' }}>{sysName}</h2>
              <p className="text-sm" style={{ color: 'hsl(0 0% 55%)' }}>Agency Manager</p>
            </div>
          </div>
          <div className="space-y-4">
            <h1 className="font-display text-4xl font-bold leading-tight" style={{ color: 'hsl(0 0% 92%)' }}>
              Gerencie suas redes sociais em um so lugar
            </h1>
            <p className="text-lg leading-relaxed" style={{ color: 'hsl(0 0% 50%)' }}>
              Agende posts, aprove conteudos e acompanhe metricas de todos os seus clientes.
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
              Usado por agencias em todo o Brasil
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden text-center space-y-3">
            {sysLogo ? (
              <img src={sysLogo} alt={sysName} className="w-12 h-12 rounded-xl mx-auto object-contain" />
            ) : (
              <div className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center font-bold text-xl bg-primary text-primary-foreground">
                {sysInitial}
              </div>
            )}
            <h1 className="font-display text-2xl font-bold text-foreground" data-testid="text-login-title">
              {sysName}
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
                    autoComplete="email"
                    className="h-11"
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      minLength={6}
                      className="h-11 pr-10"
                      data-testid="input-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      data-testid="button-toggle-password"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                    data-testid="checkbox-remember"
                  />
                  <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                    Lembrar meu e-mail
                  </Label>
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
        </div>
      </div>
    </div>
  );
}
