import {
  Users, Image, FileText, ClipboardList, Building2, Lightbulb, HeartPulse, Ticket,
  BookOpen, FileBadge, MessageCircle, LayoutGrid, Wallet, UserCog, MonitorCog,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  Users, Image, FileText, ClipboardList, Building2, Lightbulb, HeartPulse, Ticket,
  BookOpen, FileBadge, MessageCircle, LayoutGrid, Wallet, UserCog, MonitorCog,
};

export default function Icon({ name, className }: { name: string; className?: string }) {
  const Cmp = MAP[name] ?? FileText;
  return <Cmp className={className} />;
}
