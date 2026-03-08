/**
 * @module platform-icon
 * Renders a coloured Lucide icon representing a social-media platform.
 */
import { Instagram, Facebook, Linkedin, Video, Globe, FileText } from "lucide-react";

/**
 * Renders the appropriate platform icon based on the platform name string.
 * Falls back to a generic globe icon for unknown platforms.
 *
 * @param platform - The platform identifier (e.g. "instagram", "facebook").
 */
export function PlatformIcon({ platform }: { platform: string }) {
  if (!platform || typeof platform !== 'string') return null;
  switch (platform.toLowerCase()) {
    case 'instagram':
      return <Instagram className="w-4 h-4 text-pink-600" />;
    case 'facebook':
      return <Facebook className="w-4 h-4 text-blue-600" />;
    case 'linkedin':
      return <Linkedin className="w-4 h-4 text-blue-700" />;
    case 'tiktok':
      return <Video className="w-4 h-4 text-slate-900" />; // Generic video icon for TikTok
    case 'blog':
      return <FileText className="w-4 h-4 text-orange-600" />;
    default:
      return <Globe className="w-4 h-4 text-slate-500" />;
  }
}
