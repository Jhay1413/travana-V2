import { describe, it, expect } from "vitest";
import { formatPostHTML, type PostDeal } from "./social-post.service";
import type { OrgSocialContact } from "./social-post.types";

const baseDeal: PostDeal = {
  title: "Sunny Escape",
  travelDate: "2026-08-01",
  nights: 7,
  boardBasis: "All Inclusive",
  departureAirport: "Manchester",
  luggageTransfers: "Luggage & transfers included",
  tourOperator: "Jet2holidays",
  price: "999",
};

const noContact: OrgSocialContact = {
  businessName: null,
  phone: null,
  website: null,
  instagramUrl: null,
};

describe("formatPostHTML contact block", () => {
  it("includes the org's own configured contact details", () => {
    const contact: OrgSocialContact = {
      businessName: "Acme Travel",
      phone: "01234 567890",
      website: "acmetravel.example",
      instagramUrl: "https://www.instagram.com/acmetravel/",
    };

    const html = formatPostHTML(baseDeal, "Book now", "Great resort", ["#Travel"], contact);

    expect(html).toContain("To Book:");
    expect(html).toContain("01234 567890");
    expect(html).toContain("acmetravel.example");
    expect(html).toContain("https://www.instagram.com/acmetravel/");
  });

  it("omits the contact block entirely when the org has no contact details configured", () => {
    const html = formatPostHTML(baseDeal, "Book now", "Great resort", ["#Travel"], noContact);

    expect(html).not.toContain("To Book:");
    expect(html).not.toContain("Private message");
    expect(html).not.toContain("Pop in and see us");
  });

  it("never falls back to another tenant's hardcoded contact details", () => {
    const withContact = formatPostHTML(baseDeal, "Book now", "Great resort", ["#Travel"], {
      businessName: "Acme Travel",
      phone: "01234 567890",
      website: "acmetravel.example",
      instagramUrl: null,
    });
    const withoutContact = formatPostHTML(baseDeal, "Book now", "Great resort", ["#Travel"], noContact);

    for (const html of [withContact, withoutContact]) {
      expect(html).not.toContain("0191 594 7999");
      expect(html).not.toContain("tinastraveldeals.co.uk");
      expect(html).not.toContain("instagram.com/tinastravel");
    }
  });
});
