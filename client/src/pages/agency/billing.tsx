import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Calendar,
  Check,
  CreditCard,
  Download,
  FileText,
  Loader2,
  Receipt,
  Save,
  Sparkles,
  Users,
} from "lucide-react";
import { useRole } from "@/hooks/use-role";
import {
  useCurrentOrganization,
  useOrgMembers,
  useBranches,
  usePlans,
} from "@/hooks/queries";
import { useUpdateOrganization } from "@/features/organization/api/use-organization-mutations";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { OwnerOnlyGate } from "./components/OwnerOnlyGate";
import { PageLoading } from "./components/PageLoading";
import { isMemberSuspended } from "./utils/role-helpers";
import type {
  OrganizationBillingContact,
  OrganizationSettings,
} from "@/features/organization/api/organization.api";
import type { Plan, PlanCode } from "@/features/organization/api/plan.api";

function formatPrice(cents: number): string {
  return `£${(cents / 100).toFixed(0)}`;
}

function formatPriceFull(cents: number): string {
  return `£${(cents / 100).toFixed(2)}`;
}

function formatLimit(limit: number | null, noun: string): string {
  if (limit === null) return `Unlimited ${noun}`;
  return `Up to ${limit} ${noun}`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addMonths(d: Date, months: number): Date {
  const next = new Date(d);
  next.setMonth(next.getMonth() + months);
  return next;
}

const BLANK_BILLING: OrganizationBillingContact = {
  contactEmail: "",
  companyName: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  postalCode: "",
  country: "",
  vatNumber: "",
};

export default function AgencyBillingPage() {
  const { can } = useRole();
  const { data: org, isLoading: orgLoading } = useCurrentOrganization();
  const { data: members } = useOrgMembers();
  const { data: branches } = useBranches();
  const { data: plans, isLoading: plansLoading } = usePlans();
  const updateOrg = useUpdateOrganization();
  const { toast } = useToast();
  const allowed = can("admin", "billing");

  const [billing, setBilling] = useState<OrganizationBillingContact>(BLANK_BILLING);

  useEffect(() => {
    if (!org) return;
    setBilling({ ...BLANK_BILLING, ...(org.settings?.billing ?? {}) });
  }, [org]);

  const billingDirty = useMemo(() => {
    const saved = { ...BLANK_BILLING, ...(org?.settings?.billing ?? {}) };
    return (Object.keys(BLANK_BILLING) as (keyof OrganizationBillingContact)[]).some(
      (k) => (billing[k] ?? "") !== (saved[k] ?? ""),
    );
  }, [billing, org]);

  if (!allowed) return <OwnerOnlyGate />;
  if (orgLoading || plansLoading || !org || !plans) return <PageLoading />;

  const currentPlanCode = (org.plan ?? "starter") as PlanCode;
  const currentPlan = plans.find((p) => p.code === currentPlanCode) ?? plans[0];
  if (!currentPlan) return <PageLoading />;

  const seatLimit = currentPlan.seatLimit;
  const branchLimit = currentPlan.branchLimit;
  const seatsUsed = (members ?? []).filter((m) => !isMemberSuspended(m)).length;
  const branchesUsed = (branches ?? []).length;
  const seatPct =
    seatLimit && seatLimit > 0
      ? Math.min(100, Math.round((seatsUsed / seatLimit) * 100))
      : 0;
  const branchPct =
    branchLimit && branchLimit > 0
      ? Math.min(100, Math.round((branchesUsed / branchLimit) * 100))
      : 0;

  const switchPlan = (p: Plan) => {
    const patch: { plan: PlanCode; seatLimit?: number } = { plan: p.code };
    if (p.seatLimit !== null) patch.seatLimit = p.seatLimit;
    updateOrg.mutate(patch);
  };

  const planFeatures = (p: Plan): string[] => [
    formatLimit(p.branchLimit, "branches"),
    formatLimit(p.seatLimit, "seats"),
    p.code === "starter"
      ? "Email support"
      : p.code === "growth"
        ? "Priority support"
        : "Dedicated CSM",
  ];

  const saveBilling = () => {
    const next: OrganizationBillingContact = Object.fromEntries(
      (Object.keys(BLANK_BILLING) as (keyof OrganizationBillingContact)[])
        .map((k) => [k, (billing[k] ?? "").trim()])
        .filter(([, v]) => v !== ""),
    ) as OrganizationBillingContact;
    const settings: OrganizationSettings = {
      ...(org.settings ?? {}),
      billing: next,
    };
    updateOrg.mutate(
      { settings },
      {
        onSuccess: () =>
          toast({ title: "Saved", description: "Billing details updated." }),
        onError: (err: any) =>
          toast({
            title: "Couldn't save",
            description: err?.message ?? "Something went wrong",
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <div className="space-y-6">
      <CurrentPlanCard
        plan={currentPlan}
        org={org}
        seatsUsed={seatsUsed}
        branchesUsed={branchesUsed}
        seatLimit={seatLimit}
        branchLimit={branchLimit}
        seatPct={seatPct}
        branchPct={branchPct}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <NextInvoiceCard plan={currentPlan} orgCreatedAt={org.createdAt} />
        <PaymentMethodCard />
      </div>

      <BillingContactCard
        billing={billing}
        onChange={setBilling}
        onSave={saveBilling}
        dirty={billingDirty}
        saving={updateOrg.isPending}
      />

      <InvoiceHistoryCard plan={currentPlan} orgCreatedAt={org.createdAt} />

      <div>
        <h3 className="mb-3 text-sm font-semibold">Upgrade or change plan</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {plans.map((p) => {
            const isCurrent = currentPlanCode === p.code;
            return (
              <div
                key={p.code}
                className={cn(
                  "rounded-2xl border p-5",
                  isCurrent
                    ? "border-blue-500 bg-blue-500/5"
                    : "border-black/10 bg-white dark:border-white/10 dark:bg-white/5",
                )}
                data-testid={`card-plan-${p.code}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-semibold">{p.name}</span>
                  {p.code === "growth" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      <Sparkles className="h-3 w-3" /> Popular
                    </span>
                  )}
                </div>
                <div className="mb-3">
                  <span className="text-2xl font-bold">{formatPrice(p.priceCents)}</span>
                  <span className="text-xs text-black/55 dark:text-white/55">/mo</span>
                </div>
                <ul className="mb-4 space-y-1 text-xs text-black/65 dark:text-white/65">
                  {planFeatures(p).map((f) => (
                    <li key={f} className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-emerald-600" /> {f}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <Button disabled className="w-full" variant="outline">
                    Current plan
                  </Button>
                ) : (
                  <Button
                    onClick={() => switchPlan(p)}
                    disabled={updateOrg.isPending}
                    className="w-full"
                    style={{ background: org.brandColor ?? undefined }}
                    data-testid={`button-switch-plan-${p.code}`}
                  >
                    Switch to {p.name}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CurrentPlanCard({
  plan,
  org,
  seatsUsed,
  branchesUsed,
  seatLimit,
  branchLimit,
  seatPct,
  branchPct,
}: {
  plan: Plan;
  org: { brandColor: string | null };
  seatsUsed: number;
  branchesUsed: number;
  seatLimit: number | null;
  branchLimit: number | null;
  seatPct: number;
  branchPct: number;
}) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-black/50 dark:text-white/50">
            Current plan
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-bold">{plan.name}</span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
              Active
            </span>
          </div>
          <div className="mt-1 text-sm text-black/60 dark:text-white/60">
            {formatPrice(plan.priceCents)} / month · billed monthly
          </div>
        </div>
        <Button variant="outline" disabled data-testid="button-manage-billing">
          <CreditCard className="mr-1 h-4 w-4" /> Manage billing (coming soon)
        </Button>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.02]">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4" /> Seats used
            </div>
            <span className="text-sm font-semibold" data-testid="text-seat-usage">
              {seatsUsed} / {seatLimit ?? "∞"}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${seatPct}%`, background: org.brandColor ?? undefined }}
              data-testid="bar-seat-usage"
            />
          </div>
          {seatLimit !== null && seatPct >= 80 && (
            <div className="mt-2 text-xs text-amber-700">
              You're approaching your seat limit. Consider upgrading.
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.02]">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Building2 className="h-4 w-4" /> Branches used
            </div>
            <span className="text-sm font-semibold" data-testid="text-branch-usage">
              {branchesUsed} / {branchLimit ?? "∞"}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${branchPct}%`, background: org.brandColor ?? undefined }}
              data-testid="bar-branch-usage"
            />
          </div>
          {branchLimit !== null && branchPct >= 80 && (
            <div className="mt-2 text-xs text-amber-700">
              You're approaching your branch limit. Consider upgrading.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NextInvoiceCard({
  plan,
  orgCreatedAt,
}: {
  plan: Plan;
  orgCreatedAt: string;
}) {
  const { cycleStart, cycleEnd, daysElapsed, daysTotal } = useMemo(() => {
    const created = new Date(orgCreatedAt);
    const today = startOfDay(new Date());
    const anchorDay = created.getDate();

    let start = new Date(today.getFullYear(), today.getMonth(), anchorDay);
    if (start > today) start = addMonths(start, -1);
    const end = addMonths(start, 1);

    const total = Math.max(
      1,
      Math.round((end.getTime() - start.getTime()) / 86400000),
    );
    const elapsed = Math.max(
      0,
      Math.min(total, Math.round((today.getTime() - start.getTime()) / 86400000)),
    );

    return { cycleStart: start, cycleEnd: end, daysElapsed: elapsed, daysTotal: total };
  }, [orgCreatedAt]);

  const cyclePct = Math.round((daysElapsed / daysTotal) * 100);
  const daysLeft = Math.max(0, daysTotal - daysElapsed);

  return (
    <div
      className="rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/5"
      data-testid="card-next-invoice"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-blue-500/10 p-2">
          <Calendar className="h-4 w-4 text-blue-600" />
        </div>
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wider text-black/50 dark:text-white/50">
            Next invoice
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold" data-testid="text-next-invoice-amount">
              {formatPriceFull(plan.priceCents)}
            </span>
            <span className="text-xs text-black/55 dark:text-white/55">
              on {formatDate(cycleEnd)}
            </span>
          </div>
          <div className="mt-1 text-sm text-black/60 dark:text-white/60">
            For your {plan.name} subscription.
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-xs text-black/60 dark:text-white/60">
          <span>Current cycle</span>
          <span className="tabular-nums">
            {formatDate(cycleStart)} → {formatDate(cycleEnd)}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${cyclePct}%` }}
            data-testid="bar-billing-cycle"
          />
        </div>
        <div className="mt-2 text-[11px] text-black/50 dark:text-white/50">
          {daysElapsed} of {daysTotal} days · {daysLeft} days remaining
        </div>
      </div>
    </div>
  );
}

function PaymentMethodCard() {
  return (
    <div
      className="rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/5"
      data-testid="card-payment-method"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-violet-500/10 p-2">
          <CreditCard className="h-4 w-4 text-violet-600" />
        </div>
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wider text-black/50 dark:text-white/50">
            Payment method
          </div>
          <div className="mt-1 text-sm text-black/60 dark:text-white/60">
            No card on file.
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-dashed border-black/10 p-5 dark:border-white/10">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-slate-900 to-slate-700 text-[10px] font-semibold uppercase tracking-wider text-white shadow">
            Card
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">•••• •••• •••• ••••</div>
            <div className="text-xs text-black/50 dark:text-white/50">
              Add a card to enable automatic charges.
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" disabled data-testid="button-add-card">
          <CreditCard className="mr-1 h-4 w-4" /> Add card (coming soon)
        </Button>
        <span className="text-[11px] text-black/50 dark:text-white/50">
          Charges are reconciled by our billing team for now.
        </span>
      </div>
    </div>
  );
}

function BillingContactCard({
  billing,
  onChange,
  onSave,
  dirty,
  saving,
}: {
  billing: OrganizationBillingContact;
  onChange: (next: OrganizationBillingContact) => void;
  onSave: () => void;
  dirty: boolean;
  saving: boolean;
}) {
  const set = <K extends keyof OrganizationBillingContact>(
    key: K,
    value: OrganizationBillingContact[K],
  ) => onChange({ ...billing, [key]: value });

  return (
    <div
      className="rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/5"
      data-testid="card-billing-contact"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-emerald-500/10 p-2">
            <Receipt className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-black/50 dark:text-white/50">
              Billing contact & VAT
            </div>
            <div className="mt-0.5 text-sm text-black/60 dark:text-white/60">
              Used on invoices and tax forms.
            </div>
          </div>
        </div>
        <Button
          onClick={onSave}
          disabled={!dirty || saving}
          data-testid="button-save-billing"
        >
          {saving ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1 h-4 w-4" />
          )}
          Save
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Billing email">
          <Input
            type="email"
            value={billing.contactEmail ?? ""}
            onChange={(e) => set("contactEmail", e.target.value)}
            placeholder="finance@yourcompany.com"
            data-testid="input-billing-email"
          />
        </Field>
        <Field label="Company name">
          <Input
            value={billing.companyName ?? ""}
            onChange={(e) => set("companyName", e.target.value)}
            placeholder="Your Travel Co. Ltd"
            data-testid="input-billing-company"
          />
        </Field>
        <Field label="Address line 1" className="md:col-span-2">
          <Input
            value={billing.addressLine1 ?? ""}
            onChange={(e) => set("addressLine1", e.target.value)}
            placeholder="123 High Street"
            data-testid="input-billing-address1"
          />
        </Field>
        <Field label="Address line 2" className="md:col-span-2">
          <Input
            value={billing.addressLine2 ?? ""}
            onChange={(e) => set("addressLine2", e.target.value)}
            placeholder="Suite 4"
            data-testid="input-billing-address2"
          />
        </Field>
        <Field label="City">
          <Input
            value={billing.city ?? ""}
            onChange={(e) => set("city", e.target.value)}
            data-testid="input-billing-city"
          />
        </Field>
        <Field label="Postal code">
          <Input
            value={billing.postalCode ?? ""}
            onChange={(e) => set("postalCode", e.target.value)}
            data-testid="input-billing-postal"
          />
        </Field>
        <Field label="Country">
          <Input
            value={billing.country ?? ""}
            onChange={(e) => set("country", e.target.value)}
            placeholder="United Kingdom"
            data-testid="input-billing-country"
          />
        </Field>
        <Field label="VAT number">
          <Input
            value={billing.vatNumber ?? ""}
            onChange={(e) => set("vatNumber", e.target.value)}
            placeholder="GB123456789"
            data-testid="input-billing-vat"
          />
        </Field>
      </div>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-medium text-black/65 dark:text-white/65">
        {label}
      </span>
      {children}
    </label>
  );
}

type InvoiceRow = {
  number: string;
  issuedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  amountCents: number;
};

function InvoiceHistoryCard({
  plan,
  orgCreatedAt,
}: {
  plan: Plan;
  orgCreatedAt: string;
}) {
  const invoices: InvoiceRow[] = useMemo(() => {
    const created = startOfDay(new Date(orgCreatedAt));
    const today = startOfDay(new Date());
    const anchorDay = created.getDate();

    const rows: InvoiceRow[] = [];
    let cursor = new Date(created);
    let n = 1;
    while (true) {
      const next = addMonths(cursor, 1);
      if (next > today) break;
      rows.push({
        number: `INV-${created.getFullYear()}-${String(n).padStart(4, "0")}`,
        issuedAt: new Date(next.getFullYear(), next.getMonth(), anchorDay),
        periodStart: new Date(cursor),
        periodEnd: new Date(next),
        amountCents: plan.priceCents,
      });
      cursor = next;
      n += 1;
      if (rows.length > 24) break;
    }
    return rows.reverse();
  }, [orgCreatedAt, plan.priceCents]);

  return (
    <div
      className="rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/5"
      data-testid="card-invoice-history"
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-xl bg-amber-500/10 p-2">
          <FileText className="h-4 w-4 text-amber-600" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-black/50 dark:text-white/50">
            Invoice history
          </div>
          <div className="mt-0.5 text-sm text-black/60 dark:text-white/60">
            {invoices.length === 0
              ? "No invoices yet — your first invoice will appear after your first billing cycle."
              : `${invoices.length} ${invoices.length === 1 ? "invoice" : "invoices"} issued so far.`}
          </div>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 p-8 text-center dark:border-white/10">
          <Receipt className="mx-auto mb-2 h-7 w-7 text-black/30 dark:text-white/30" />
          <div className="text-sm font-medium">No invoices issued</div>
          <div className="mt-1 text-xs text-black/50 dark:text-white/50">
            You'll find paid invoices and receipts here.
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/10">
          <table
            className="w-full text-sm"
            data-testid="table-invoice-history"
          >
            <thead>
              <tr className="bg-black/[0.03] dark:bg-white/[0.04]">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-black/55 dark:text-white/55">
                  Invoice
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-black/55 dark:text-white/55">
                  Issued
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-black/55 dark:text-white/55">
                  Period
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-black/55 dark:text-white/55">
                  Amount
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-black/55 dark:text-white/55">
                  Status
                </th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr
                  key={inv.number}
                  className="border-t border-black/5 dark:border-white/5"
                  data-testid={`row-invoice-${inv.number}`}
                >
                  <td className="px-4 py-3 font-medium tabular-nums">{inv.number}</td>
                  <td className="px-4 py-3 text-black/70 dark:text-white/70">
                    {formatDate(inv.issuedAt)}
                  </td>
                  <td className="px-4 py-3 text-xs text-black/60 dark:text-white/60">
                    {formatDate(inv.periodStart)} → {formatDate(inv.periodEnd)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {formatPriceFull(inv.amountCents)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      Paid
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled
                      data-testid={`button-download-invoice-${inv.number}`}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
