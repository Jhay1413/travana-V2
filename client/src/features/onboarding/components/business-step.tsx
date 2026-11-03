import { useRef, useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { requestErrorMessage } from "@/lib/request-error";
import { useSaveBusiness } from "../api/use-onboarding-mutations";
import { syncAgents } from "../lib/rows";
import { MAX_AGENTS, businessSchema, type BusinessDraft } from "../lib/schemas";
import { validateObject } from "../lib/validation";
import { useOnboarding } from "../state/onboarding-context";
import { Field } from "./field";
import { OptionSelect } from "./option-select";
import { CARD_CLASS, INPUT_CLASS, LINK_BUTTON } from "./styles";
import { StepLayout } from "./step-layout";
import { WizardFooter } from "./wizard-footer";

const COUNT_OPTIONS = Array.from({ length: MAX_AGENTS }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));

export function BusinessStep() {
  const { state, server, patch } = useOnboarding();
  const b = state.business;
  const save = useSaveBusiness();
  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const { errors } = validateObject(businessSchema, b);
  const err = (name: keyof BusinessDraft) => (submitted || touched[name] ? errors[name] : undefined);
  const blur = (name: keyof BusinessDraft) => () => setTouched((t) => ({ ...t, [name]: true }));
  const set = <K extends keyof BusinessDraft>(key: K, value: BusinessDraft[K]) =>
    patch({ business: { ...b, [key]: value } });
  const multi = b.businessType === "multi";
  const ownerEmail = server.owner.email ?? "";
  const usingSignUpEmail = ownerEmail !== "" && b.email === ownerEmail;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setFormError(null);
    const { data } = validateObject(businessSchema, b);
    if (!data) {
      // Wait for the errors to render, then jump to the first one.
      setTimeout(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
      return;
    }
    try {
      await save.mutateAsync({
        businessType: data.businessType,
        businessName: data.businessName,
        phone: data.phone,
        address: data.address,
        website: data.website,
        email: data.email,
      });
    } catch (error) {
      setFormError(requestErrorMessage(error, "We couldn't save your business details. Try again."));
      return;
    }
    if (data.businessType === "multi") patch({ step: "shops" });
    else patch({ step: "agents", agents: syncAgents(state.agents, b) });
  }

  const input = (name: keyof BusinessDraft, id: string) => ({
    id,
    value: String(b[name]),
    className: INPUT_CLASS,
    "aria-invalid": err(name) ? (true as const) : undefined,
    "aria-describedby": err(name) ? `${id}-error` : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(name, e.target.value as never),
    onBlur: blur(name),
  });

  return (
    <StepLayout
      title="Welcome to Travana"
      subtitle="Tell us about your business so we can set up your account."
      tips={{
        title: "What happens next",
        items: [
          multi ? "Next you'll add each shop and its manager." : "Next you'll add your agents so they can log in.",
          "Choosing Multi Shops lets you add each shop and its manager.",
          "Homeworkers get their own login too.",
        ],
      }}
    >
      <form ref={formRef} noValidate onSubmit={onSubmit}>
        <div className={CARD_CLASS}>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <Field id="business-type" label="Business type" labelOnly className="sm:col-span-2">
              <Segmented
                label="Business type"
                value={b.businessType}
                onChange={(v) => set("businessType", v)}
                items={[
                  { value: "single", label: "Single Shop" },
                  { value: "multi", label: "Multi Shops" },
                ]}
              />
            </Field>

            <Field id="business-name" label="Business name" error={err("businessName")}>
              <Input autoComplete="organization" {...input("businessName", "business-name")} />
            </Field>

            <Field id="business-phone" label="Phone" error={err("phone")}>
              <Input type="tel" autoComplete="tel" placeholder="e.g. 0191 000 0000" {...input("phone", "business-phone")} />
            </Field>

            <Field id="business-address" label="Address" error={err("address")} className="sm:col-span-2">
              <Input autoComplete="street-address" placeholder="Start typing your address" {...input("address", "business-address")} />
            </Field>

            <Field id="business-website" label="Website URL" error={err("website")}>
              <Input inputMode="url" autoComplete="url" placeholder="https://" {...input("website", "business-website")} />
            </Field>

            <Field
              id="business-email"
              label="Main email address"
              error={err("email")}
              className="sm:col-span-2"
              action={
                ownerEmail ? (
                  <button
                    type="button"
                    className={LINK_BUTTON}
                    onClick={() => {
                      if (usingSignUpEmail) {
                        set("email", "");
                        emailRef.current?.focus();
                      } else {
                        set("email", ownerEmail);
                      }
                    }}
                  >
                    {usingSignUpEmail ? "Use a different email" : "Use my sign-up email"}
                  </button>
                ) : null
              }
            >
              <Input ref={emailRef} type="email" autoComplete="email" {...input("email", "business-email")} />
            </Field>

            {multi ? (
              <p className="m-0 rounded-xl border border-social-border bg-social-page px-4 py-3 text-[13px] text-social-muted sm:col-span-3">
                With Multi Shops you'll add each shop and its Branch Manager next, then invite the rest of your team.
              </p>
            ) : (
              <>
                <Field id="has-branch-manager" label="Do you have a Branch Manager?" labelOnly>
                  <Segmented
                    label="Do you have a Branch Manager?"
                    value={b.hasBranchManager ? "yes" : "no"}
                    onChange={(v) => set("hasBranchManager", v === "yes")}
                    items={[
                      { value: "yes", label: "Yes" },
                      { value: "no", label: "No" },
                    ]}
                  />
                </Field>

                <Field
                  id="agent-count"
                  label="Number of agents"
                  labelOnly
                  error={err("agentCount")}
                  hint="Not including you or your Branch Manager"
                >
                  <OptionSelect
                    id="agent-count"
                    aria-label="Number of agents"
                    value={b.agentCount}
                    options={COUNT_OPTIONS}
                    invalid={Boolean(err("agentCount"))}
                    onValueChange={(v) => set("agentCount", v)}
                  />
                </Field>
              </>
            )}
          </div>

          <WizardFooter primaryLabel={save.isPending ? "Saving…" : <>Next &rarr;</>} busy={save.isPending} error={formError} />
        </div>
      </form>
    </StepLayout>
  );
}
