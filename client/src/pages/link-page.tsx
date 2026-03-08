/**
 * @module link-page
 * Public "link in bio" page for clients.
 * Renders a branded landing page with the client's logo, bio, social links,
 * custom links, and an optional dark/light mode toggle. Accessible via `/link/:slug`.
 */
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import {
  Loader2, Phone, Mail, Globe, ChevronDown, Sun, Moon,
  Link as LinkIcon, ShoppingBag, Calendar, FileText, MapPin,
  Headphones, Video, Music, Gift, Star, Heart,
  MessageCircle, BookOpen, Briefcase, UtensilsCrossed,
} from "lucide-react";
import { SiInstagram, SiFacebook, SiTiktok, SiLinkedin, SiYoutube, SiWhatsapp } from "react-icons/si";
import { RichTextDisplay } from "@/components/rich-text-editor";

/** Maps icon key strings to their Lucide icon components for custom link rendering. */
const ICON_MAP: Record<string, any> = {
  link: LinkIcon,
  "shopping-bag": ShoppingBag,
  calendar: Calendar,
  "file-text": FileText,
  "map-pin": MapPin,
  headphones: Headphones,
  video: Video,
  music: Music,
  gift: Gift,
  star: Star,
  heart: Heart,
  "message-circle": MessageCircle,
  "book-open": BookOpen,
  briefcase: Briefcase,
  utensils: UtensilsCrossed,
};

/** A single custom link entry on the link page. */
interface CustomLink {
  name: string;
  url: string;
  icon: string;
}

/** Full data model for a client's public link page returned by the API. */
interface LinkPageData {
  name: string;
  bio: string | null;
  about: string | null;
  logoUrl: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  linkedin: string | null;
  youtube: string | null;
  primaryColor: string;
  secondaryColor: string;
  products: { name: string; description: string | null }[];
  services: { name: string; description: string | null }[];
  customLinks: CustomLink[];
  visibility: Record<string, boolean>;
  defaultTheme: "auto" | "light" | "dark";
}

function resolveInitialDark(defaultTheme: string): boolean {
  if (defaultTheme === "dark") return true;
  if (defaultTheme === "light") return false;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch { return false; }
}

export default function LinkPage() {
  const params = useParams<{ slug: string }>();
  const [activeSection, setActiveSection] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [themeInitialized, setThemeInitialized] = useState(false);

  const { data, isLoading, error } = useQuery<LinkPageData>({
    queryKey: ["/api/linkpage", params.slug],
    enabled: !!params.slug,
  });

  useEffect(() => {
    if (data && !themeInitialized) {
      setDark(resolveInitialDark(data.defaultTheme));
      setThemeInitialized(true);
      const aboutContent = data.about?.replace(/<[^>]*>/g, "").trim() || "";
      if (aboutContent.length > 0) {
        setActiveSection("sobre");
      } else if (data.products.length > 0) {
        setActiveSection("produtos");
      } else if (data.services.length > 0) {
        setActiveSection("servicos");
      }
    }
  }, [data, themeInitialized]);

  const toggleTheme = () => setDark(d => !d);

  useEffect(() => {
    if (data) {
      document.title = `${data.name}`;
    }
  }, [data]);

  const t = {
    bg: dark ? "#111114" : "#f8f9fa",
    card: dark ? "#1c1c21" : "#ffffff",
    cardBorder: dark ? "#2a2a30" : "#f0f0f0",
    text: dark ? "#e4e4e7" : "#1a1a2e",
    textSecondary: dark ? "#a1a1aa" : "#6b7280",
    textMuted: dark ? "#71717a" : "#9ca3af",
    footerText: dark ? "#52525b" : "#c0c0c0",
    headerBg: (secondary: string) => dark ? "#18181b" : secondary,
    proseText: dark ? "#d4d4d8" : "#374151",
    proseBold: dark ? "#fafafa" : "#111827",
    proseLink: dark ? "#60a5fa" : "#2563eb",
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: t.bg }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: t.textMuted }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: t.bg }}>
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2" style={{ color: t.text }}>Pagina nao encontrada</h1>
          <p style={{ color: t.textSecondary }}>O link que voce acessou nao existe ou foi desativado.</p>
        </div>
      </div>
    );
  }

  const primary = data.primaryColor;
  const secondary = data.secondaryColor;
  const hasProducts = data.products.length > 0;
  const hasServices = data.services.length > 0;
  const hasCustomLinks = (data.customLinks || []).length > 0;
  const hasAbout = !!(data.about && data.about.replace(/<[^>]*>/g, "").trim().length > 0);

  const menuItems = [
    ...(hasAbout ? [{ id: "sobre", label: "Sobre", always: true }] : []),
    ...(hasProducts ? [{ id: "produtos", label: "Produtos", always: false }] : []),
    ...(hasServices ? [{ id: "servicos", label: "Servicos", always: false }] : []),
  ];

  const socialLinks = [
    { url: data.whatsapp, icon: SiWhatsapp, label: "WhatsApp", href: `https://wa.me/${data.whatsapp?.replace(/\D/g, "")}` },
    { url: data.instagram, icon: SiInstagram, label: "Instagram", href: data.instagram?.startsWith("http") ? data.instagram : `https://instagram.com/${data.instagram?.replace("@", "")}` },
    { url: data.facebook, icon: SiFacebook, label: "Facebook", href: data.facebook?.startsWith("http") ? data.facebook : `https://facebook.com/${data.facebook}` },
    { url: data.tiktok, icon: SiTiktok, label: "TikTok", href: data.tiktok?.startsWith("http") ? data.tiktok : `https://tiktok.com/@${data.tiktok?.replace("@", "")}` },
    { url: data.linkedin, icon: SiLinkedin, label: "LinkedIn", href: data.linkedin?.startsWith("http") ? data.linkedin : `https://linkedin.com/in/${data.linkedin}` },
    { url: data.youtube, icon: SiYoutube, label: "YouTube", href: data.youtube?.startsWith("http") ? data.youtube : `https://youtube.com/${data.youtube}` },
  ].filter(l => l.url);

  const contactLinks = [
    { url: data.phone, icon: Phone, label: data.phone, href: `tel:${data.phone}` },
    { url: data.email, icon: Mail, label: data.email, href: `mailto:${data.email}` },
    { url: data.website, icon: Globe, label: data.website?.replace(/^https?:\/\//, ""), href: data.website?.startsWith("http") ? data.website : `https://${data.website}` },
  ].filter(l => l.url);

  return (
    <div className="min-h-screen transition-colors duration-300" style={{ backgroundColor: t.bg }}>
      <header
        className="sticky top-0 z-50 shadow-md transition-colors duration-300"
        style={{ backgroundColor: t.headerBg(secondary), color: "#fff" }}
      >
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              {data.logoUrl && (
                <img
                  src={data.logoUrl}
                  alt={data.name}
                  className="w-8 h-8 rounded-full object-cover bg-white/20"
                  data-testid="img-linkpage-logo"
                />
              )}
              <span className="font-bold text-lg truncate" data-testid="text-linkpage-name">{data.name}</span>
            </div>

            <div className="flex items-center gap-2">
              {menuItems.length > 0 && (
                <nav className="hidden sm:flex items-center gap-1" data-testid="nav-linkpage-desktop">
                  {menuItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: activeSection === item.id ? primary : "transparent",
                        color: activeSection === item.id ? "#fff" : "rgba(255,255,255,0.8)",
                      }}
                      data-testid={`button-linkpage-menu-${item.id}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </nav>
              )}

              {menuItems.length > 0 && (
                <button
                  className="sm:hidden flex items-center gap-1 text-sm"
                  onClick={() => setMenuOpen(!menuOpen)}
                  data-testid="button-linkpage-mobile-menu"
                >
                  {menuItems.find(m => m.id === activeSection)?.label}
                  <ChevronDown className="w-4 h-4" style={{ transform: menuOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                </button>
              )}

              <button
                onClick={toggleTheme}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
                title={dark ? "Modo claro" : "Modo escuro"}
                data-testid="button-linkpage-theme-toggle"
              >
                {dark ? <Sun className="w-4 h-4 text-yellow-300" /> : <Moon className="w-4 h-4 text-white" />}
              </button>
            </div>
          </div>

          {menuOpen && (
            <div className="sm:hidden pb-2 space-y-1" data-testid="nav-linkpage-mobile">
              {menuItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setActiveSection(item.id); setMenuOpen(false); }}
                  className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: activeSection === item.id ? primary : "transparent",
                    color: activeSection === item.id ? "#fff" : "rgba(255,255,255,0.8)",
                  }}
                  data-testid={`button-linkpage-mobile-${item.id}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          {data.logoUrl && (
            <div className="flex justify-center mb-4">
              <div
                className="w-24 h-24 rounded-full overflow-hidden border-4 shadow-lg"
                style={{ borderColor: primary }}
              >
                <img src={data.logoUrl} alt={data.name} className="w-full h-full object-cover" />
              </div>
            </div>
          )}
          <h1 className="text-2xl font-bold mb-1" style={{ color: t.text }} data-testid="text-linkpage-title">{data.name}</h1>
          {data.bio && <p className="max-w-md mx-auto" style={{ color: t.textSecondary }} data-testid="text-linkpage-bio">{data.bio}</p>}
        </div>

        {socialLinks.length > 0 && (
          <div className="flex justify-center gap-3 mb-8 flex-wrap" data-testid="section-linkpage-social">
            {socialLinks.map((link, i) => (
              <a
                key={i}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-12 h-12 rounded-full text-white shadow-md transition-transform hover:scale-105"
                style={{ backgroundColor: primary }}
                title={link.label}
                data-testid={`link-social-${link.label?.toLowerCase()}`}
              >
                <link.icon className="w-5 h-5" />
              </a>
            ))}
          </div>
        )}

        {contactLinks.length > 0 && (
          <div className="space-y-3 mb-8" data-testid="section-linkpage-contacts">
            {contactLinks.map((link, i) => (
              <a
                key={i}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 rounded-xl shadow-sm transition-all hover:shadow-md"
                style={{ backgroundColor: t.card, borderColor: t.cardBorder, borderWidth: 1 }}
                data-testid={`link-contact-${i}`}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${primary}20`, color: primary }}
                >
                  <link.icon className="w-5 h-5" />
                </div>
                <span className="font-medium truncate" style={{ color: t.text }}>{link.label}</span>
              </a>
            ))}
          </div>
        )}

        {hasCustomLinks && (
          <div className="space-y-3 mb-8" data-testid="section-linkpage-custom-links">
            {data.customLinks.map((cl, i) => {
              const IconComp = ICON_MAP[cl.icon] || LinkIcon;
              return (
                <a
                  key={i}
                  href={cl.url.startsWith("http") ? cl.url : `https://${cl.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 rounded-xl shadow-sm transition-all hover:shadow-md"
                  style={{ backgroundColor: t.card, borderColor: t.cardBorder, borderWidth: 1 }}
                  data-testid={`link-custom-${i}`}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${primary}20`, color: primary }}
                  >
                    <IconComp className="w-5 h-5" />
                  </div>
                  <span className="font-medium truncate" style={{ color: t.text }}>{cl.name}</span>
                </a>
              );
            })}
          </div>
        )}

        {activeSection === "sobre" && data.about && (
          <section className="mb-8" data-testid="section-linkpage-about">
            <h2
              className="text-lg font-bold mb-4 pb-2 border-b-2"
              style={{ borderColor: primary, color: dark ? "#e4e4e7" : secondary }}
            >
              Sobre
            </h2>
            <div
              className="rounded-xl p-5 shadow-sm"
              style={{ backgroundColor: t.card, borderColor: t.cardBorder, borderWidth: 1 }}
            >
              <div
                style={{ color: t.proseText }}
                className="[&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-bold [&_a]:underline"
              >
                <div
                  style={{
                    ["--tw-prose-body" as any]: t.proseText,
                    ["--tw-prose-headings" as any]: t.proseBold,
                    ["--tw-prose-bold" as any]: t.proseBold,
                    ["--tw-prose-links" as any]: t.proseLink,
                  }}
                >
                  <RichTextDisplay content={data.about} />
                </div>
              </div>
            </div>
          </section>
        )}

        {activeSection === "produtos" && hasProducts && (
          <section className="mb-8" data-testid="section-linkpage-products">
            <h2
              className="text-lg font-bold mb-4 pb-2 border-b-2"
              style={{ borderColor: primary, color: dark ? "#e4e4e7" : secondary }}
            >
              Produtos
            </h2>
            <div className="grid gap-3">
              {data.products.map((p, i) => (
                <div
                  key={i}
                  className="rounded-xl p-5 shadow-sm"
                  style={{ backgroundColor: t.card, borderColor: t.cardBorder, borderWidth: 1 }}
                  data-testid={`card-product-${i}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ backgroundColor: primary }} />
                    <div>
                      <h3 className="font-semibold" style={{ color: t.text }}>{p.name}</h3>
                      {p.description && <p className="text-sm mt-1" style={{ color: t.textSecondary }}>{p.description}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeSection === "servicos" && hasServices && (
          <section className="mb-8" data-testid="section-linkpage-services">
            <h2
              className="text-lg font-bold mb-4 pb-2 border-b-2"
              style={{ borderColor: primary, color: dark ? "#e4e4e7" : secondary }}
            >
              Servicos
            </h2>
            <div className="grid gap-3">
              {data.services.map((s, i) => (
                <div
                  key={i}
                  className="rounded-xl p-5 shadow-sm"
                  style={{ backgroundColor: t.card, borderColor: t.cardBorder, borderWidth: 1 }}
                  data-testid={`card-service-${i}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ backgroundColor: primary }} />
                    <div>
                      <h3 className="font-semibold" style={{ color: t.text }}>{s.name}</h3>
                      {s.description && <p className="text-sm mt-1" style={{ color: t.textSecondary }}>{s.description}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="text-center py-6 text-xs" style={{ color: t.footerText }}>
        <span>Powered by Shift Agency</span>
      </footer>
    </div>
  );
}
