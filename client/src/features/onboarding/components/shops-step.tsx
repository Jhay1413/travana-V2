import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { requestErrorMessage } from "@/lib/request-error";
import { useCreateShops } from "../api/use-onboarding-mutations";
import { visibleBranches } from "../lib/branches";
import { blankShop, isBlankShop, updateRow } from "../lib/rows";
import { shopSchema } from "../lib/schemas";
import { SheetError, readSheetFile, tableToShops } from "../lib/sheet";
import { addEmails } from "../lib/sent";
import { failureText, splitShopResults, type RowFailure } from "../lib/shop-results";
import { downloadOnboardingTemplate } from "../lib/templates";
import { validateRows } from "../lib/validation";
import { useOnboarding } from "../state/onboarding-context";
import type { ShopRow } from "../types";
import { Field } from "./field";
import { CARD_CLASS, ERROR_TEXT, INPUT_CLASS, LINK_BUTTON, MUTED_LINK_BUTTON } from "./styles";
import { StepLayout } from "./step-layout";
import { UploadBox } from "./upload-box";
import { WizardFooter } from "./wizard-footer";

export function ShopsStep() {
  const { state, server, patch, goto } = useOnboarding();
  const { shops } = state;
  const created = useMemo(() => visibleBranches(server.branches), [server.branches]);
  const active = shops.find((s) => s.id === state.activeShopId) ?? shops[shops.length - 1];
  const formRef = useRef<HTMLDivElement>(null);
  const createShops = useCreateShops();
  const [showErrors, setShowErrors] = useState(false);
  const [reading, setReading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [failures, setFailures] = useState<Record<string, RowFailure>>({});
  const [warnings, setWarnings] = useState<string[]>([]);

  // Opening this step (or coming back to it) always leaves a fresh empty form at the bottom.
  useEffect(() => {
    if (shops.length === 0 || shops.every((s) => !isBlankShop(s))) {
      const fresh = blankShop();
      patch({ shops: [...shops, fresh], activeShopId: fresh.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const results = useMemo(
    () =>
      validateRows(shops, {
        schema: shopSchema,
        isBlank: isBlankShop,
        unique: [
          {
            field: "name",
            message: "Another shop already uses this name.",
            alsoTaken: created.map((b) => b.name),
          },
        ],
      }),
    [shops, created],
  );
  const activeResult = results.find((r) => r.id === active?.id);
  const busy = createShops.isPending;

  function focusFirstInvalid() {
    setTimeout(() => {
      const root = formRef.current;
      (root?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? root?.querySelector<HTMLElement>("input"))?.focus();
    }, 0);
  }

  const update = (id: string, change: Partial<ShopRow>) => patch({ shops: updateRow(shops, id, change) });

  function addShop() {
    if (!active) return;
    setFormError(null);
    if (!activeResult?.data) {
      setShowErrors(true);
      focusFirstInvalid();
      return;
    }
    const fresh = blankShop();
    patch({ shops: [...shops, fresh], activeShopId: fresh.id });
    setShowErrors(false);
    focusFirstInvalid();
  }

  function edit(id: string) {
    if (!active || id === active.id) return;
    setFormError(null);
    if (isBlankShop(active)) {
      // Nothing typed in the open form: drop it and open the one they chose.
      patch({ shops: shops.filter((s) => s.id !== active.id), activeShopId: id });
    } else if (activeResult?.data) {
      patch({ activeShopId: id });
    } else {
      setShowErrors(true);
      focusFirstInvalid();
      return;
    }
    setShowErrors(false);
  }

  function remove(id: string) {
    const rest = shops.filter((s) => s.id !== id);
    if (rest.length === 0) {
      const fresh = blankShop();
      patch({ shops: [fresh], activeShopId: fresh.id });
    } else {
      patch({ shops: rest, activeShopId: rest[rest.length - 1]?.id ?? "" });
    }
    setShowErrors(false);
  }

  async function handleFile(file: File) {
    setUploadError(null);
    setReading(true);
    try {
      const rows = tableToShops(await readSheetFile(file));
      patch({ review: { kind: "shops", fileName: file.name, rows }, step: "shops-review" });
    } catch (e) {
      setUploadError(e instanceof SheetError ? e.message : "We couldn't read that file. Save it as .csv and try again.");
    } finally {
      setReading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const bad = results.find((r) => !r.blank && !r.data);
    if (bad) {
      patch({ activeShopId: bad.id });
      setShowErrors(true);
      focusFirstInvalid();
      return;
    }
    const filled = results.filter((r) => !r.blank && r.data);
    if (filled.length === 0) {
      if (created.length === 0) {
        setFormError("Add at least one shop, or skip for now.");
        return;
      }
      goto("team");
      return;
    }
    const rowIds = filled.map((r) => r.id);
    try {
      const { results: shopResults } = await createShops.mutateAsync(
        filled.flatMap((r) => (r.data ? [r.data] : [])),
      );
      const { saved, failures: failed, managerWarnings, managerInvitedRows } = splitShopResults(rowIds, shopResults);
      // Remember who was invited as a shop manager, so the Team step never invites them twice.
      const invitedManagers = managerInvitedRows.flatMap((id) => {
        const email = shops.find((x) => x.id === id)?.managerEmail;
        return email ? [email] : [];
      });
      if (invitedManagers.length > 0) patch({ managerInvited: addEmails(state.managerInvited, invitedManagers) });
      const nextShops = shops.filter((s) => !saved.includes(s.id));
      setFailures(failed);
      const warningLines = saved.flatMap((id) => {
        const name = shops.find((s) => s.id === id)?.name ?? "A shop";
        return managerWarnings[id] ? [`${name}: ${managerWarnings[id]}`] : [];
      });
      setWarnings(warningLines);
      const firstFailed = Object.keys(failed)[0];
      const withSpare = nextShops.some(isBlankShop) ? nextShops : [...nextShops, blankShop()];
      patch({ shops: withSpare, activeShopId: firstFailed ?? withSpare[withSpare.length - 1]?.id ?? "" });
      if (firstFailed) {
        setFormError("Some shops couldn't be created. The ones that worked are saved.");
        return;
      }
      if (warningLines.length > 0) {
        setFormError("Your shops are saved, but some manager invites didn't send. You can resend them from Team.");
        return;
      }
      goto("team");
    } catch (error) {
      setFormError(requestErrorMessage(error, "We couldn't save your shops. Try again."));
    }
  }

  const errors = showErrors && activeResult ? activeResult.errors : {};
  const activeFailure = active ? failures[active.id] : undefined;
  const offset = created.length;

  return (
    <StepLayout
      title="Add your shops"
      subtitle="Tell us about each branch. Add as many as you need."
      tips={{
        title: "Adding shops",
        items: [
          "Add every branch you operate.",
          "A manager email gets that shop's Branch Manager invite. Leave it blank to invite them later.",
          "You can add or edit shops later in Settings.",
        ],
      }}
    >
      <form noValidate onSubmit={onSubmit}>
        <UploadBox
          description="Upload a CSV file with shop name, address, email, phone and manager email, or drag and drop it here."
          onFile={handleFile}
          onDownloadTemplate={() => downloadOnboardingTemplate("shops")}
          error={uploadError}
          busy={reading}
        />

        {created.map((branch, i) => (
          <div
            key={branch.id}
            className="mb-3.5 flex items-center justify-between rounded-xl border border-social-border bg-card px-5 py-4"
          >
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold">
                Shop {i + 1}: {branch.name}
              </div>
              <div className="truncate text-[12px] text-social-muted">{branch.email}</div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-status-posted-bg px-2.5 py-0.5 text-[12px] font-semibold text-status-posted-fg">
              <Check className="size-3.5" aria-hidden /> Created
            </span>
          </div>
        ))}

        {shops.map((shop, i) => {
          const n = offset + i + 1;
          const failure = failures[shop.id];
          if (shop.id !== active?.id) {
            return (
              <div
                key={shop.id}
                className={cn(
                  "mb-3.5 flex items-center justify-between rounded-xl border bg-card px-5 py-4",
                  failure ? "border-status-failed-fg" : "border-social-border",
                )}
              >
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold">
                    Shop {n}: {shop.name}
                  </div>
                  <div className="truncate text-[12px] text-social-muted">{shop.managerEmail}</div>
                  {failure && <div className={ERROR_TEXT}>{failureText(failure)}</div>}
                </div>
                <button type="button" className={LINK_BUTTON} onClick={() => edit(shop.id)} aria-label={`Edit shop ${n}, ${shop.name}`}>
                  Edit
                </button>
              </div>
            );
          }
          return (
            <div
              key={shop.id}
              ref={formRef}
              role="group"
              aria-label={`Shop ${n}`}
              className={cn(CARD_CLASS, "mb-3.5 border-[1.5px] !p-5", activeFailure ? "border-status-failed-fg" : "border-social-orange")}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="text-[14px] font-semibold">Shop {n}</div>
                {!isBlankShop(shop) && (
                  <button type="button" className={MUTED_LINK_BUTTON} onClick={() => remove(shop.id)}>
                    Remove
                  </button>
                )}
              </div>
              {activeFailure && (
                <p role="alert" className={`${ERROR_TEXT} -mt-2 mb-3`}>
                  {failureText(activeFailure)}
                </p>
              )}
              <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2">
                <Field id="shop-name" label="Shop name" error={errors.name}>
                  <Input
                    id="shop-name"
                    placeholder="e.g. Houghton"
                    value={shop.name}
                    className={INPUT_CLASS}
                    aria-invalid={errors.name ? true : undefined}
                    onChange={(e) => update(shop.id, { name: e.target.value })}
                  />
                </Field>
                <Field id="shop-phone" label="Phone" error={errors.phone}>
                  <Input
                    id="shop-phone"
                    type="tel"
                    value={shop.phone}
                    className={INPUT_CLASS}
                    aria-invalid={errors.phone ? true : undefined}
                    onChange={(e) => update(shop.id, { phone: e.target.value })}
                  />
                </Field>
                <Field id="shop-address" label="Address" error={errors.address} className="sm:col-span-2">
                  <Input
                    id="shop-address"
                    placeholder="Start typing the shop address"
                    value={shop.address}
                    className={INPUT_CLASS}
                    aria-invalid={errors.address ? true : undefined}
                    onChange={(e) => update(shop.id, { address: e.target.value })}
                  />
                </Field>
                <Field id="shop-email" label="Shop email" error={errors.email}>
                  <Input
                    id="shop-email"
                    type="email"
                    placeholder="shop@"
                    value={shop.email}
                    className={INPUT_CLASS}
                    aria-invalid={errors.email ? true : undefined}
                    onChange={(e) => update(shop.id, { email: e.target.value })}
                  />
                </Field>
                <Field id="shop-manager-email" label="Manager email (optional)" error={errors.managerEmail}>
                  <Input
                    id="shop-manager-email"
                    type="email"
                    placeholder="manager@ (leave blank for no invite)"
                    value={shop.managerEmail}
                    className={INPUT_CLASS}
                    aria-invalid={errors.managerEmail ? true : undefined}
                    onChange={(e) => update(shop.id, { managerEmail: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          );
        })}

        <Button
          type="button"
          variant="outline"
          className="h-11 w-full rounded-[10px] border-dashed border-social-border bg-transparent text-[14px] font-semibold"
          onClick={addShop}
          disabled={busy}
        >
          + Add shop
        </Button>

        {warnings.length > 0 && (
          <ul role="status" className="mb-0 mt-4 list-disc pl-5 text-[13px] text-status-scheduled-fg">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}

        <WizardFooter
          onBack={() => goto("business")}
          skipLabel="Skip for now"
          onSkip={() => goto("team")}
          primaryLabel={busy ? "Saving…" : <>Next: add your team &rarr;</>}
          busy={busy}
          error={formError}
        />
      </form>
    </StepLayout>
  );
}
