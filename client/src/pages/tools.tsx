import { useEffect, useState } from "react";
import { Check, Copy, Download, Loader2, Stethoscope } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Both tools are built from source into client/public by
// `npx tsx scripts/build-bookmarklet.ts`, so this page always serves whatever
// was last built — no version numbers to keep in sync by hand.
const CAPTURE_URL = "/capture-bookmarklet.txt";
const PROBE_URL = "/flights-probe.txt";

interface Tool {
  code: string;
  version: string;
}

function useBookmarkletSource(url: string, isBookmarklet: boolean): Tool | null | undefined {
  const [tool, setTool] = useState<Tool | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((text) => {
        if (cancelled) return;
        const code = text.trim();
        // The source carries its own version marker; read it back rather than
        // duplicating it here where it would drift.
        const decoded = isBookmarklet ? decodeURIComponent(code.replace(/^javascript:/, "")) : code;
        const version = /VERSION\s*=\s*'([^']+)'/.exec(decoded)?.[1] ?? "";
        setTool({ code, version });
      })
      .catch(() => !cancelled && setTool(null));
    return () => {
      cancelled = true;
    };
  }, [url, isBookmarklet]);
  return tool;
}

function CopyButton({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast({
            title: "Could not copy",
            description: "Your browser blocked clipboard access — select the code below and copy it manually.",
            variant: "destructive",
          });
        }
      }}
      className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-medium text-black/70 transition hover:bg-black/5"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}

export default function ToolsPage() {
  const capture = useBookmarkletSource(CAPTURE_URL, true);
  const probe = useBookmarkletSource(PROBE_URL, false);

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <header>
        <h1 className="text-xl font-semibold text-black/80">Tools</h1>
        <p className="mt-1 text-sm text-black/50">
          Browser tools for importing supplier deals that sit behind a login.
        </p>
      </header>

      {/* ── Capture bookmarklet ─────────────────────────────────────────── */}
      <section className="rounded-2xl border border-black/10 bg-white/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-black/50" />
            <h2 className="text-sm font-semibold text-black/80">Capture deal page</h2>
            {capture?.version && (
              <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-medium text-black/60">
                {capture.version}
              </span>
            )}
          </div>
          {capture && <CopyButton code={capture.code} label="Copy" />}
        </div>

        <p className="mt-3 text-sm text-black/60">
          Reads the deal page you're looking at — including the operator's embedded booking JSON — and copies it to
          your clipboard. Paste it into <strong>Capture</strong> on the quote form.
        </p>

        {capture === undefined && (
          <p className="mt-4 flex items-center gap-2 text-xs text-black/40">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </p>
        )}
        {capture === null && (
          <p className="mt-4 text-xs font-medium text-red-600">
            Couldn't load the tool. Run <code>npx tsx scripts/build-bookmarklet.ts</code> and redeploy.
          </p>
        )}

        {capture && (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-black/15 bg-black/[0.02] p-4">
              {/* Dragging this link onto the bookmarks bar is the only way a web
                  page can install a bookmarklet — the browser gives no API for
                  writing bookmarks, so a real "install" button is impossible.

                  The href is set on the DOM node rather than through React's
                  href prop: React refuses to render a "javascript:" URL and
                  substitutes a stub that throws "React has blocked a
                  javascript: URL as a security precaution". Its concern is
                  injected URLs — this one is our own build output, fetched from
                  our own origin, and is never executed by this page; the
                  browser only stores it as a bookmark. */}
              <a
                ref={(el) => {
                  if (el) el.setAttribute("href", capture.code);
                }}
                onClick={(e) => e.preventDefault()}
                draggable
                className="cursor-grab rounded-xl bg-black/80 px-4 py-2 text-sm font-medium text-white transition hover:bg-black active:cursor-grabbing"
                title="Drag me to your bookmarks bar"
              >
                Capture deal page
              </a>
              <span className="text-xs text-black/50">
                ← drag onto your bookmarks bar. Already have it? Drag this on top of the old one, or right-click it →
                Edit and paste the copied code.
              </span>
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-xs font-medium text-black/50">Show the code</summary>
              <textarea
                readOnly
                value={capture.code}
                onFocus={(e) => e.currentTarget.select()}
                className="mt-2 h-24 w-full rounded-xl border border-black/10 bg-white/70 p-2 font-mono text-[10px] text-black/60"
              />
            </details>
          </>
        )}
      </section>

      {/* ── Diagnostic probe ────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-black/10 bg-white/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-black/50" />
            <h2 className="text-sm font-semibold text-black/80">Flights probe</h2>
          </div>
          {probe && <CopyButton code={probe.code} label="Copy" />}
        </div>
        <p className="mt-3 text-sm text-black/60">
          Only needed when a capture comes back without flight times. Copy this, open the supplier page, press{" "}
          <kbd className="rounded border border-black/15 px-1 text-[11px]">F12</kbd> → Console, paste, and send the
          output to whoever is fixing the supplier.
        </p>
      </section>

      <section className="rounded-2xl border border-black/10 bg-white/60 p-5">
        <h2 className="text-sm font-semibold text-black/80">How to use it</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-black/60">
          <li>Log in to the supplier in this browser as you normally would.</li>
          <li>Open the deal page and let the price finish loading.</li>
          <li>Click the <strong>Capture deal page</strong> bookmark. It'll confirm what it found.</li>
          <li>In the quote form, press <strong>Capture</strong>, paste, and import.</li>
        </ol>
        <p className="mt-3 text-xs text-black/45">
          A supplier we haven't seen before is set up automatically from the page — its extraction rules are
          AI-generated from that first capture and flagged for review in supplier settings.
        </p>
      </section>
    </div>
  );
}
