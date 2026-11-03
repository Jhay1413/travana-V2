import { useState, type FormEvent } from "react";
import { Plane } from "lucide-react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { requestErrorMessage } from "@/lib/request-error";
import { useSignup } from "../api/use-onboarding-mutations";
import { readEmailSent } from "../lib/signup";
import { signupSchema } from "../lib/schemas";
import { validateObject } from "../lib/validation";
import { Field } from "./field";
import { CARD_CLASS, INPUT_CLASS, LINK_BUTTON } from "./styles";
import { WizardFooter } from "./wizard-footer";

interface FormValues {
  businessName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

const EMPTY: FormValues = { businessName: "", firstName: "", lastName: "", email: "", password: "" };

/** Slim signup: just enough to create the account. The rest happens in the wizard after sign-in. */
export function SignupForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const signup = useSignup();
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [submitted, setSubmitted] = useState(false);

  const { errors } = validateObject(signupSchema, values);
  const err = (k: keyof FormValues) => (submitted ? errors[k] : undefined);
  const field = (k: keyof FormValues, id: string) => ({
    id,
    value: values[k],
    className: INPUT_CLASS,
    "aria-invalid": err(k) ? (true as const) : undefined,
    onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value })),
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    const { data } = validateObject(signupSchema, values);
    if (!data) return;
    const payload = { ...data, email: data.email.toLowerCase() };
    try {
      const res = await signup.mutateAsync(payload);
      if (readEmailSent(res)) {
        toast({ title: "Account created", description: `We've sent a verification link to ${payload.email}.` });
      } else {
        toast({
          title: "Account created",
          description: "We couldn't send the verification email. Use 'Resend' on the next screen.",
          variant: "destructive",
        });
      }
      setLocation(`/verify-email?email=${encodeURIComponent(payload.email)}`);
    } catch (error) {
      toast({
        title: "Signup failed",
        description: requestErrorMessage(error, "Signup failed. Please try again."),
        variant: "destructive",
      });
    }
  }

  return (
    <div className="min-h-screen bg-social-page text-[14px] text-foreground">
      <header className="flex items-center justify-between bg-social-navy px-6 py-4 text-white">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-social-orange text-slate-900" aria-hidden>
            <Plane className="size-5" />
          </div>
          <span className="text-[17px] font-semibold">Travana</span>
        </div>
        <button type="button" className="text-[13px] text-white/80 hover:text-white" onClick={() => setLocation("/")}>
          Already have an account? Sign in
        </button>
      </header>

      <main className="mx-auto max-w-[560px] px-5 py-10">
        <h1 className="m-0 text-[24px] font-semibold" data-testid="text-signup-title">
          Start your agency
        </h1>
        <p className="mb-6 mt-1 text-social-muted">Create your account first. You'll set up your business and team next.</p>

        <form noValidate onSubmit={onSubmit} className={CARD_CLASS}>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field id="signup-business" label="Business name" error={err("businessName")} className="sm:col-span-2">
              <Input autoComplete="organization" placeholder="e.g. Sunrise Travel" {...field("businessName", "signup-business")} />
            </Field>
            <Field id="signup-first" label="First name" error={err("firstName")}>
              <Input autoComplete="given-name" {...field("firstName", "signup-first")} />
            </Field>
            <Field id="signup-last" label="Last name" error={err("lastName")}>
              <Input autoComplete="family-name" {...field("lastName", "signup-last")} />
            </Field>
            <Field id="signup-email" label="Email" error={err("email")} className="sm:col-span-2">
              <Input type="email" autoComplete="email" {...field("email", "signup-email")} />
            </Field>
            <Field
              id="signup-password"
              label="Password"
              error={err("password")}
              hint="At least 8 characters"
              className="sm:col-span-2"
            >
              <Input type="password" autoComplete="new-password" {...field("password", "signup-password")} />
            </Field>
          </div>
          <WizardFooter primaryLabel={signup.isPending ? "Creating account…" : <>Create account &rarr;</>} busy={signup.isPending} />
          <p className="mb-0 mt-4 text-center text-[12px] text-social-muted">
            <button type="button" className={LINK_BUTTON} onClick={() => setLocation("/")}>
              Back to sign in
            </button>
          </p>
        </form>
      </main>
    </div>
  );
}
