import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { quoteImageRepository } from "./quote-image.repository";
import { newQuoteRepository } from "./quote.repository";
import { bookingImageRepository } from "../booking/booking-image.repository";
import { db } from "../../config/database";
import { accomodation_list, accommodation_images, quoteImages } from "@shared/schema";
import { truncateAll, makeOrg, makeBranch, makeUser, makeTransaction, makeQuote } from "../../test/factories";

let org: { id: string };
let shop1: { id: string };
let shop2: { id: string };
let user: { id: string };
let quote2: { id: string }; // a quote in shop 2

const agentOf = (branchId: string | null) => ({ orgId: org.id, branchId, orgRole: "agent", orgRoles: ["agent"], userId: user.id, branchType: "shop", ownsHomeworkerBranch: false }) as never;

beforeEach(async () => {
  await truncateAll();
  org = await makeOrg();
  shop1 = await makeBranch(org.id);
  shop2 = await makeBranch(org.id);
  user = await makeUser();
  const txn2 = await makeTransaction({ user_id: user.id, org_id: org.id, branch_id: shop2.id });
  quote2 = await makeQuote({ transaction_id: txn2.id });
});

async function masterImage() {
  const [hotel] = await db.insert(accomodation_list).values({ name: "Shared hotel" }).returning();
  const [row] = await db.insert(accommodation_images).values({ accommodation_id: hotel.id, image_url: "https://images.test/hotel.jpg" }).returning();
  return row;
}

describe("quote image scope (the write scope behind the image endpoints)", () => {
  it("a shop-1 agent may read but not write a shop-2 quote; the shop's agent and an org admin may write; a no-shop agent may not", async () => {
    expect(await newQuoteRepository.quoteInScope(quote2.id, agentOf(shop1.id))).toBe(true);
    expect(await newQuoteRepository.quoteInScopeForWrite(quote2.id, agentOf(shop1.id))).toBe(false);
    expect(await newQuoteRepository.quoteInScopeForWrite(quote2.id, agentOf(shop2.id))).toBe(true);
    expect(await newQuoteRepository.quoteInScopeForWrite(quote2.id, agentOf(null))).toBe(false);
    const admin = { ...(agentOf(shop1.id) as object), orgRole: "org_admin", orgRoles: ["org_admin"] } as never;
    expect(await newQuoteRepository.quoteInScopeForWrite(quote2.id, admin)).toBe(true);
  });

  it("another organisation's quote is neither readable nor writable", async () => {
    const other = await makeOrg();
    const foreign = { orgId: other.id, branchId: null, orgRole: "org_admin", orgRoles: ["org_admin"], userId: user.id, branchType: null, ownsHomeworkerBranch: false } as never;
    expect(await newQuoteRepository.quoteInScope(quote2.id, foreign)).toBe(false);
    expect(await newQuoteRepository.quoteInScopeForWrite(quote2.id, foreign)).toBe(false);
  });
});

describe("shared hotel-gallery images are never deleted through a quote", () => {
  it("isSharedGalleryImage recognises a library image, and getImageUrl / deleteImage leave it alone", async () => {
    const master = await masterImage();
    expect(await quoteImageRepository.isSharedGalleryImage(master.id)).toBe(true);
    expect(await quoteImageRepository.getImageUrl(quote2.id, master.id)).toBeNull();
    await quoteImageRepository.deleteImage(quote2.id, master.id);
    expect(await db.select().from(accommodation_images).where(eq(accommodation_images.id, master.id))).toHaveLength(1);
  });

  it("the booking delete path leaves the library row alone too", async () => {
    const master = await masterImage();
    await bookingImageRepository.deleteImage(quote2.id, master.id);
    expect(await db.select().from(accommodation_images).where(eq(accommodation_images.id, master.id))).toHaveLength(1);
  });

  it("an image the quote owns is returned and deleted, and another quote's is not touched", async () => {
    const [own] = await quoteImageRepository.addImages(quote2.id, ["https://images.test/own.jpg"]);
    const otherTxn = await makeTransaction({ user_id: user.id, org_id: org.id, branch_id: shop1.id });
    const otherQuote = await makeQuote({ transaction_id: otherTxn.id });
    const [theirs] = await quoteImageRepository.addImages(otherQuote.id, ["https://images.test/theirs.jpg"]);
    expect(await quoteImageRepository.isSharedGalleryImage(own.id)).toBe(false);
    expect(await quoteImageRepository.getImageUrl(quote2.id, own.id)).toBe("https://images.test/own.jpg");
    expect(await quoteImageRepository.getImageUrl(quote2.id, theirs.id)).toBeNull();
    await quoteImageRepository.deleteImage(quote2.id, theirs.id); // wrong quote: no effect
    expect(await db.select().from(quoteImages).where(eq(quoteImages.id, theirs.id))).toHaveLength(1);
    await quoteImageRepository.deleteImage(quote2.id, own.id);
    expect(await db.select().from(quoteImages).where(eq(quoteImages.id, own.id))).toHaveLength(0);
  });
});
