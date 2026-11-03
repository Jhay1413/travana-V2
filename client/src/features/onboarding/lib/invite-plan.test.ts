import { describe, expect, it, vi } from "vitest";
import { planAgentInvites, planTeamInvites, sendInvitesSequentially, type ValidPerson } from "./invite-plan";

const person = (id: string, email: string, extra: Partial<ValidPerson> = {}): ValidPerson => ({
  id,
  firstName: "A",
  lastName: "B",
  email,
  role: "agent",
  ...extra,
});

describe("planAgentInvites", () => {
  it("builds branch bodies and never invites the owner", () => {
    const plan = planAgentInvites(
      [person("1", "a@x.co", { role: "branch_manager" }), person("2", "Owner@x.co")],
      "branch-1",
      "owner@x.co",
    );
    expect(plan).toHaveLength(1);
    expect(plan[0]?.body).toEqual({
      email: "a@x.co",
      orgRole: "branch_manager",
      branchId: "branch-1",
      firstName: "A",
      lastName: "B",
    });
  });
});

describe("planTeamInvites", () => {
  it("sends homeworkers without a branch and with the commission", () => {
    const [hw] = planTeamInvites([person("1", "h@x.co", { shop: "homeworker", role: "branch_manager" })], 60, null);
    expect(hw?.body).toEqual({ email: "h@x.co", orgRole: "homeworker", profitSharePercent: "60", displayName: "A B" });
  });
  it("omits the share when no commission is set", () => {
    const [hw] = planTeamInvites([person("1", "h@x.co", { shop: "homeworker" })], null, null);
    expect(hw?.body).not.toHaveProperty("profitSharePercent");
  });
  it("uses the chosen shop for branch roles and skips the owner", () => {
    const plan = planTeamInvites(
      [person("1", "a@x.co", { shop: "b2" }), person("2", "o@x.co", { shop: "b2" })],
      null,
      "o@x.co",
    );
    expect(plan.map((p) => p.email)).toEqual(["a@x.co"]);
    expect(plan[0]?.body).toMatchObject({ orgRole: "agent", branchId: "b2" });
  });
});

describe("sendInvitesSequentially", () => {
  it("sends in order, records errors and keeps going", async () => {
    const plan = planAgentInvites([person("1", "a@x.co"), person("2", "b@x.co"), person("3", "c@x.co")], "b", null);
    const order: string[] = [];
    const send = vi.fn(async (body: { email: string }) => {
      order.push(body.email);
      if (body.email === "b@x.co") throw Object.assign(new Error("x"), { data: { message: "All 25 seats are in use" } });
    });
    const seen: string[] = [];
    const results = await sendInvitesSequentially(plan, send, (id) => seen.push(id));
    expect(order).toEqual(["a@x.co", "b@x.co", "c@x.co"]);
    expect(seen).toEqual(["1", "2", "3"]);
    expect(results["1"]?.status).toBe("sent");
    expect(results["2"]).toEqual({ status: "error", message: "All 25 seats are in use" });
    expect(results["3"]?.status).toBe("sent");
  });
});
