import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axiosClient from "@/api/client/axios-client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Link2,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Share2,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";

interface ShareQuotePanelProps {
  quoteId: string;
  quoteTitle: string;
  destinationName: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  agentName?: string;
}

export function ShareQuotePanel({
  quoteId,
  quoteTitle,
  destinationName,
  clientName,
  clientEmail,
  clientPhone,
  agentName,
}: ShareQuotePanelProps) {
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateTokenMutation = useMutation({
    mutationFn: async () => {
      const res = await axiosClient.post(`/api/quote-share/${quoteId}/generate-token`);
      return res.data;
    },
    onSuccess: (data: { token: string }) => {
      setToken(data.token);
    },
  });

  const markSentMutation = useMutation({
    mutationFn: async (sentVia: string) => {
      await axiosClient.patch(`/api/quote-share/${quoteId}/sent`, { sentVia });
    },
  });

  const getQuoteUrl = (t: string) => {
    const base = window.location.origin;
    return `${base}/view-quote/${t}`;
  };

  const ensureToken = async (): Promise<string> => {
    if (token) return token;
    const res = await axiosClient.post(`/api/quote-share/${quoteId}/generate-token`);
    const t = res.data.token;
    setToken(t);
    return t;
  };

  const firstName = clientName?.split(" ")[0] || "there";

  const handleCopyLink = async () => {
    try {
      const t = await ensureToken();
      await navigator.clipboard.writeText(getQuoteUrl(t));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      markSentMutation.mutate("link");
      toast({ title: "Link copied!" });
    } catch {
      toast({ title: "Failed to copy link", variant: "destructive" });
    }
  };

  const handleEmail = async () => {
    try {
      const t = await ensureToken();
      const url = getQuoteUrl(t);
      const subject = encodeURIComponent(`Your Holiday Quote — ${destinationName || quoteTitle}`);
      const body = encodeURIComponent(
        `Hi ${firstName},\n\nI've put together a great option for your ${destinationName || "holiday"}.\n\nYou can view the full details including flights, accommodation and your complete itinerary here:\n\n${url}\n\nLet me know what you think or if you'd like me to secure the price.\n\nBest regards,\n${agentName || "Your Travel Agent"}`
      );
      const mailto = `mailto:${clientEmail || ""}?subject=${subject}&body=${body}`;
      window.open(mailto, "_self");
      markSentMutation.mutate("email");
    } catch {
      toast({ title: "Failed to prepare email", variant: "destructive" });
    }
  };

  const handleWhatsApp = async () => {
    try {
      const t = await ensureToken();
      const url = getQuoteUrl(t);
      const phone = (clientPhone || "").replace(/[\s()-]/g, "").replace(/^0/, "+44");
      const message = encodeURIComponent(
        `Hi ${firstName},\n\nI've found a great option for your ${destinationName || "holiday"}.\n\nView your full quote here:\n${url}\n\nLet me know if you'd like me to secure it!`
      );
      window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
      markSentMutation.mutate("whatsapp");
    } catch {
      toast({ title: "Failed to prepare WhatsApp", variant: "destructive" });
    }
  };

  const handleSMS = async () => {
    try {
      const t = await ensureToken();
      const url = getQuoteUrl(t);
      const phone = (clientPhone || "").replace(/[\s()-]/g, "");
      const message = encodeURIComponent(
        `Your ${destinationName || "holiday"} quote is ready! View it here: ${url}`
      );
      window.open(`sms:${phone}?body=${message}`, "_self");
      markSentMutation.mutate("sms");
    } catch {
      toast({ title: "Failed to prepare SMS", variant: "destructive" });
    }
  };

  const handleMessenger = async () => {
    try {
      const t = await ensureToken();
      const url = getQuoteUrl(t);
      const message = `Hi ${firstName},\n\nI've found a great option for your ${destinationName || "holiday"}.\n\nView your full quote here:\n${url}\n\nLet me know if you'd like me to secure it!`;
      await navigator.clipboard.writeText(message);
      toast({ title: "Message copied — paste in Messenger" });
      markSentMutation.mutate("messenger");
    } catch {
      toast({ title: "Failed to copy message", variant: "destructive" });
    }
  };

  const handlePreview = async () => {
    try {
      const t = await ensureToken();
      window.open(getQuoteUrl(t), "_blank");
    } catch {
      toast({ title: "Failed to generate link", variant: "destructive" });
    }
  };

  return (
    <Card className="rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-share-quote">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Share2 className="h-4 w-4 text-black/50" />
          <h3 className="text-sm font-semibold" data-testid="text-share-title">Share Quote</h3>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-xs text-blue-600 hover:text-blue-700"
          onClick={handlePreview}
          data-testid="button-preview-quote"
        >
          <ExternalLink className="h-3 w-3" />
          Preview
        </Button>
      </div>

      {token && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2">
          <Link2 className="h-3.5 w-3.5 shrink-0 text-black/40" />
          <span className="truncate text-xs text-black/60 font-mono" data-testid="text-quote-link">
            {getQuoteUrl(token)}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2" data-testid="grid-share-buttons">
        <Button
          size="sm"
          variant="outline"
          className="h-9 rounded-xl border-black/10 bg-white/70 text-xs gap-1.5"
          onClick={handleCopyLink}
          data-testid="button-copy-link"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied!" : "Copy Link"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-9 rounded-xl border-black/10 bg-white/70 text-xs gap-1.5"
          onClick={handleEmail}
          data-testid="button-send-email"
        >
          <Mail className="h-3.5 w-3.5" />
          Email
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-9 rounded-xl border-green-500/20 bg-green-50/50 text-xs gap-1.5 text-green-700 hover:bg-green-50"
          onClick={handleWhatsApp}
          data-testid="button-send-whatsapp"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          WhatsApp
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-9 rounded-xl border-black/10 bg-white/70 text-xs gap-1.5"
          onClick={handleSMS}
          data-testid="button-send-sms"
        >
          <Phone className="h-3.5 w-3.5" />
          SMS
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="col-span-2 h-9 rounded-xl border-blue-500/20 bg-blue-50/50 text-xs gap-1.5 text-blue-700 hover:bg-blue-50"
          onClick={handleMessenger}
          data-testid="button-send-messenger"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Messenger
        </Button>
      </div>
    </Card>
  );
}
