import { ChevronRight, Home, Mail, MapPin, Pencil, Phone, UserRound } from "lucide-react";

interface ClientContactDetailsProps {
  clientData:
    | {
        phoneNumber?: string | null;
        email?: string | null;
        DOB?: string | null;
        houseNumber?: string | null;
        street?: string | null;
        city?: string | null;
        country?: string | null;
        post_code?: string | null;
      }
    | null
    | undefined;
  isOpen: boolean;
  onToggle: () => void;
  onEdit: () => void;
}

export function ClientContactDetails({
  clientData,
  isOpen,
  onToggle,
  onEdit,
}: ClientContactDetailsProps) {
  const hasAddress =
    clientData?.houseNumber ||
    clientData?.street ||
    clientData?.city ||
    clientData?.post_code ||
    clientData?.country;

  return (
    <div
      className="mt-3 rounded-3xl border border-black/10 bg-white/60 p-3"
      data-testid="section-contact-details"
    >
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-black/[0.03] px-2 py-1 text-sm font-semibold text-black transition hover:bg-black/[0.05]"
          data-testid="toggle-contact-details"
        >
          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
          Contact Details
        </button>
        {isOpen && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-black/[0.03] px-2 py-1 text-[11px] font-semibold text-black/60 hover:bg-black/[0.05] transition"
            data-testid="button-edit-contact"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        )}
      </div>
      {isOpen && (
        <>
          <div className="grid gap-2" data-testid="list-contact-details">
            {clientData?.phoneNumber && (
              <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10">
                  <Phone className="h-4 w-4 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-black/50" data-testid="label-contact-phone">Phone</div>
                  <div className="truncate text-sm text-black/85" data-testid="value-contact-phone">
                    <a
                      href={`tel:${clientData.phoneNumber.replace(/\s/g, "")}`}
                      className="hover:text-blue-600 transition-colors"
                    >
                      {clientData.phoneNumber}
                    </a>
                  </div>
                </div>
              </div>
            )}

            {clientData?.email && (
              <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-500/10">
                  <Mail className="h-4 w-4 text-green-600" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-black/50" data-testid="label-contact-email">Email</div>
                  <div className="truncate text-sm text-black/85" data-testid="value-contact-email">
                    <a
                      href={`mailto:${clientData.email}`}
                      className="hover:text-green-600 transition-colors"
                    >
                      {clientData.email}
                    </a>
                  </div>
                </div>
              </div>
            )}

            {clientData?.DOB && (
              <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10">
                  <UserRound className="h-4 w-4 text-purple-600" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-black/50" data-testid="label-contact-dob">Date of Birth</div>
                  <div className="text-sm text-black/85" data-testid="value-contact-dob">
                    {clientData.DOB}
                  </div>
                </div>
              </div>
            )}
          </div>

          {hasAddress && (
            <div className="mt-4 mb-2">
              <div className="text-xs font-semibold text-black/80">Address</div>
            </div>
          )}
          <div className="grid gap-2" data-testid="list-address-details">
            {(clientData?.houseNumber || clientData?.street) && (
              <div className="flex items-start gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 mt-0.5">
                  <Home className="h-4 w-4 text-rose-600" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-black/50" data-testid="label-address-street">Street</div>
                  <div className="text-sm text-black/85" data-testid="value-address-street">
                    {[clientData.houseNumber, clientData.street].filter(Boolean).join(" ")}
                  </div>
                </div>
              </div>
            )}

            {(clientData?.city || clientData?.post_code) && (
              <div className="flex items-start gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 mt-0.5">
                  <MapPin className="h-4 w-4 text-sky-600" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-black/50" data-testid="label-address-city">City & Postcode</div>
                  <div className="text-sm text-black/85" data-testid="value-address-city">
                    {[clientData.city, clientData.post_code].filter(Boolean).join(", ")}
                  </div>
                </div>
              </div>
            )}

            {clientData?.country && (
              <div className="flex items-start gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 mt-0.5">
                  <MapPin className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-black/50" data-testid="label-address-country">Country</div>
                  <div className="text-sm text-black/85" data-testid="value-address-country">
                    {clientData.country}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
