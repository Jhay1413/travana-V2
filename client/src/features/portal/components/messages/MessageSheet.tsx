import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { PortalSummary } from "@shared/portal-summary";
import { getPortalToken, useSendMessage } from "@/hooks/use-portal-api";
import { cn } from "@/lib/utils";
import { usePortalBookingList } from "../../api/use-portal-bookings";
import { usePortalQuoteList } from "../../api/use-portal-quotes";
import { portalSummaryKey } from "../../api/use-portal-summary";
import {
  EMPTY_DRAFT,
  MESSAGE_EXTRAS,
  MAX_MESSAGE_TEXT,
  REPLY_OPTIONS,
  SEND_FAILED_ERROR,
  agentInitials,
  agentWho,
  aboutFromPath,
  aboutKey,
  buildAboutOptions,
  composeMessage,
  orderedExtras,
  replyLine,
  resolveAbout,
  sentStamp,
  validateDraft,
  type MessageAbout,
  type MessageDraft,
} from "../../lib/message-sheet";
import { loadMessageSheetState, messageSheetKey, saveMessageSheetState, type SentBubble } from "../../lib/message-sheet-store";
import { agentFirstName } from "../../lib/quote-format";
import { usePortalBrandingValue } from "../../theme/PortalThemeProvider";
import { PortalButton } from "../brand";
import { PortalSheet } from "../PortalSheet";

export interface PortalMessageSheetApi {
  /** Opens the "Message <agent>" sheet over the current screen. With no `about`, a quote or booking screen preselects itself, else the next booking, the first quote or "Something else". */
  open: (about?: MessageAbout) => void;
  close: () => void;
  isOpen: boolean;
}

const NOOP_API: PortalMessageSheetApi = { open: () => undefined, close: () => undefined, isOpen: false };
const PortalMessageSheetContext = createContext<PortalMessageSheetApi>(NOOP_API);

/** Opens the Message sheet from any portal screen. Outside the portal shell it does nothing. */
export function usePortalMessageSheet(): PortalMessageSheetApi {
  return useContext(PortalMessageSheetContext);
}

/**
 * Mounts the "Message <agent>" sheet once for the whole portal shell and hands out `usePortalMessageSheet()`.
 * What the customer has typed survives closing the sheet AND changing page: each page mounts its own provider, so the
 * draft (subject, extras, text, reply-by) and this session's sent bubbles are held in a small module-level store
 * (lib/message-sheet-store) keyed to the signed-in customer and cleared on sign-out. A draft is cleared only by a successful send.
 */
export function PortalMessageSheetProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const sessionKey = messageSheetKey(localStorage.getItem("portal_client_id"), getPortalToken());
  const branding = usePortalBrandingValue();
  const send = useSendMessage();
  const [isOpen, setIsOpen] = useState(false);
  const [pref, setPref] = useState<string | null>(() => loadMessageSheetState(sessionKey).about);
  const [view, setView] = useState<"form" | "sent">("form");
  const [draft, setDraft] = useState<MessageDraft>(() => loadMessageSheetState(sessionKey).draft);
  const [thread, setThread] = useState<readonly SentBubble[]>(() => loadMessageSheetState(sessionKey).thread);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const locationRef = useRef(location);
  locationRef.current = location;
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // Whatever the customer has typed, chosen or sent follows them to the next page's sheet.
  useEffect(() => {
    saveMessageSheetState(sessionKey, { draft, about: pref, thread });
  }, [sessionKey, draft, pref, thread]);

  const agent = agentFirstName(branding.agentName);
  const named = agent !== "your agent";

  const open = useCallback((about?: MessageAbout) => {
    const active = document.activeElement;
    openerRef.current = active instanceof HTMLElement ? active : null;
    // The page the customer is on (or what opened the sheet) names the subject; otherwise a draft in progress keeps its own.
    const fromPage = about ? aboutKey(about) : aboutFromPath(locationRef.current);
    const hasDraft = draftRef.current.text.trim() !== "" || draftRef.current.extras.length > 0;
    setPref((previous) => fromPage ?? (hasDraft ? previous : null));
    setView("form");
    setError("");
    setIsOpen(true);
  }, []);
  const close = useCallback(() => setIsOpen(false), []);
  const api = useMemo<PortalMessageSheetApi>(() => ({ open, close, isOpen }), [open, close, isOpen]);

  const update = (patch: Partial<MessageDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError("");
  };

  const submit = async (aboutLabel: string) => {
    if (sendingRef.current) return;
    const problem = validateDraft(draft);
    if (problem) {
      setError(problem);
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setError("");
    const sentDraft = draft;
    try {
      await send.mutateAsync(composeMessage({ about: aboutLabel, draft: sentDraft }));
      setThread((t) => [...t, { about: aboutLabel, extras: orderedExtras(sentDraft.extras).join(" · "), text: sentDraft.text.trim(), at: sentStamp(new Date()) }]);
      // Cleared only when nothing was typed while it was sending; the reply choice stays.
      setDraft((d) => (d === sentDraft ? { ...EMPTY_DRAFT, via: d.via } : d));
      setView("sent");
    } catch {
      setError(SEND_FAILED_ERROR);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  // Focus returns to what opened the sheet; when that is gone (the menu closes as the sheet opens) to the header's Menu button.
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    const opener = openerRef.current;
    const target = opener && opener.isConnected ? opener : document.querySelector<HTMLElement>('[data-testid="button-portal-menu"]');
    target?.focus();
  };

  const who = agentWho(agent);
  return (
    <PortalMessageSheetContext.Provider value={api}>
      {children}
      <PortalSheet
        open={isOpen}
        onOpenChange={setIsOpen}
        label={named ? `Message ${agent}` : "Message your agent"}
        lead={view === "form" ? "Anything" : "Sent to"}
        italic={view === "form" ? "to add?" : `${who}.`}
        description={view === "form" ? `A room with a view, a birthday, airport parking: tell ${agent} what you’d like and they’ll sort it.` : undefined}
        testId="sheet-message"
        onCloseAutoFocus={restoreFocus}
      >
        <MessageSheetBody
          view={view}
          agent={agent}
          agentName={named ? (branding.agentName ?? "") : ""}
          pref={pref}
          onPref={(key) => {
            setPref(key);
            setError("");
          }}
          draft={draft}
          onDraft={update}
          thread={thread}
          error={error}
          sending={sending}
          onSend={(label) => void submit(label)}
          onAddMore={() => {
            setView("form");
            setError("");
          }}
          onDone={close}
          onOpenChat={() => {
            close();
            setLocation("/portal/messages");
          }}
        />
      </PortalSheet>
    </PortalMessageSheetContext.Provider>
  );
}

/** The sheet's content. It mounts only while the sheet is open, so the quotes and bookings are read only when needed. */
function MessageSheetBody({
  view,
  agent,
  agentName,
  pref,
  onPref,
  draft,
  onDraft,
  thread,
  error,
  sending,
  onSend,
  onAddMore,
  onDone,
  onOpenChat,
}: {
  view: "form" | "sent";
  agent: string;
  agentName: string;
  pref: string | null;
  onPref: (key: string) => void;
  draft: MessageDraft;
  onDraft: (patch: Partial<MessageDraft>) => void;
  thread: readonly SentBubble[];
  error: string;
  sending: boolean;
  onSend: (aboutLabel: string) => void;
  onAddMore: () => void;
  onDone: () => void;
  onOpenChat: () => void;
}) {
  const queryClient = useQueryClient();
  const bookings = usePortalBookingList();
  const quotes = usePortalQuoteList();
  // Home's summary is already loaded by the shell; read it, do not ask again.
  const summary = queryClient.getQueryData<PortalSummary>(portalSummaryKey);
  const options = useMemo(
    () => buildAboutOptions({ bookings: bookings.data, quotes: quotes.data, nextBooking: summary?.nextBooking ?? null, preferred: pref }),
    [bookings.data, quotes.data, summary?.nextBooking, pref],
  );
  // Until both lists have answered, the list cannot say what the message is about: no list, and no Send (a quick send must
  // never go out as "Something else" by accident).
  const loadingAbout = bookings.isLoading || quotes.isLoading;
  const chosen = resolveAbout(options, pref);
  const radios = useRef<Array<HTMLButtonElement | null>>([]);

  const moveRadio = (index: number, e: KeyboardEvent) => {
    const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + options.length) % options.length;
    onPref(options[next].key);
    radios.current[next]?.focus();
  };

  const who = agentWho(agent);

  if (view === "sent") {
    return (
      <div role="status" className="flex flex-col gap-[22px]" data-testid="message-sent">
        <div className="flex flex-col gap-3">
          {thread.map((m, i) => (
            <div key={i} className="flex max-w-[88%] flex-col gap-2 self-end bg-primary px-[18px] py-4 text-white" data-testid="message-sent-bubble">
              <span className="text-[10px] uppercase tracking-[0.22em] text-[#F2B27A]">About {m.about}</span>
              {m.extras && <span className="portal-serif text-[17px] italic leading-[1.35]">{m.extras}</span>}
              {m.text && <span className="whitespace-pre-line [overflow-wrap:anywhere] text-sm leading-[1.6]">{m.text}</span>}
              <span className="text-[11px] text-white/65">Sent {m.at}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 text-sm leading-[1.6] text-muted-foreground">
          <span aria-hidden className="portal-serif flex size-10 flex-none items-center justify-center rounded-full bg-[#EFE3D3] text-base text-primary">
            {agentInitials(agentName)}
          </span>
          <span data-testid="message-reply-line">{replyLine(agent, draft.via)}</span>
        </div>
        <PortalButton variant="link" className="self-start text-[11px]" onClick={onOpenChat} data-testid="message-open-chat">
          Open messages
        </PortalButton>
        <div className="grid grid-cols-2 gap-2">
          <PortalButton variant="navy" size="sm" onClick={onAddMore} data-testid="message-add-more">
            Add more
          </PortalButton>
          <PortalButton size="sm" onClick={onDone} data-testid="message-done">
            Done
          </PortalButton>
        </div>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-[26px]"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (loadingAbout) return;
        onSend(chosen.label);
      }}
      data-testid="message-form"
    >
      <fieldset className="m-0 flex min-w-0 flex-col border-0 p-0">
        <legend className="portal-caps-label mb-2 p-0">It&apos;s about</legend>
        {loadingAbout && (
          <p role="status" className="m-0 border-t border-[#E2D4C2] py-4 text-sm text-muted-foreground" data-testid="message-about-loading">
            Loading your trips and quotes…
          </p>
        )}
        <div role="radiogroup" aria-label="It's about" data-testid="message-about" hidden={loadingAbout}>
          {!loadingAbout && options.map((o, i) => {
            const on = o.key === chosen.key;
            return (
              <button
                key={o.key}
                ref={(el) => {
                  radios.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                onClick={() => onPref(o.key)}
                onKeyDown={(e) => moveRadio(i, e)}
                className="flex min-h-[50px] w-full items-center gap-3.5 border-0 border-t border-[#E2D4C2] bg-transparent py-2 text-left text-primary"
                data-testid={`message-about-${o.key}`}
              >
                <span
                  aria-hidden
                  className={cn(
                    "box-border size-4 flex-none rounded-full border-[1.5px] border-primary shadow-[inset_0_0_0_3px_hsl(var(--background))]",
                    on ? "bg-primary" : "bg-transparent",
                  )}
                />
                <span className="portal-serif min-w-0 text-[19px] leading-[1.2] [overflow-wrap:anywhere]">{o.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2.5">
        <div className="portal-caps-label" id="message-extras-label">
          Add quickly
        </div>
        <div role="group" aria-labelledby="message-extras-label" className="flex flex-wrap gap-2" data-testid="message-extras">
          {MESSAGE_EXTRAS.map((e) => {
            const on = draft.extras.includes(e);
            return (
              <button
                key={e}
                type="button"
                aria-pressed={on}
                onClick={() => onDraft({ extras: on ? draft.extras.filter((x) => x !== e) : [...draft.extras, e] })}
                className="portal-chip min-h-11 text-[13px] normal-case tracking-[0.02em]"
                data-testid={`message-extra-${e.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {e}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="portal-message-sheet-text" className="portal-caps-label">
          Your message
        </label>
        <textarea
          id="portal-message-sheet-text"
          value={draft.text}
          maxLength={MAX_MESSAGE_TEXT}
          rows={3}
          onChange={(e) => onDraft({ text: e.target.value })}
          placeholder="It's our anniversary, could we have a sea view?"
          aria-describedby={error ? "message-sheet-error" : undefined}
          className="portal-textarea min-h-24 leading-[1.3]"
          data-testid="message-text"
        />
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="portal-caps-label" id="message-reply-label">
          {who} will reply by
        </div>
        <div role="group" aria-labelledby="message-reply-label" className="flex flex-wrap gap-2" data-testid="message-reply-by">
          {REPLY_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={draft.via === o.key}
              onClick={() => onDraft({ via: o.key })}
              className="portal-chip min-h-11"
              data-testid={`message-via-${o.key}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p id="message-sheet-error" role="alert" className="portal-text-danger text-[13px]" data-testid="message-error">
          {error}
        </p>
      )}
      <PortalButton type="submit" size="lg" className="w-full" disabled={sending || loadingAbout} data-testid="message-send">
        {sending ? "Sending..." : agent === "your agent" ? "Send to your agent" : `Send to ${agent}`}
      </PortalButton>
    </form>
  );
}
