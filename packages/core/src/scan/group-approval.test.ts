import { describe, expect, test } from "bun:test";
import { createGroupApproval } from "./group-approval";

describe("GroupApproval", () => {
  test("approve marks group as approved", () => {
    const approval = createGroupApproval();
    approval.approve("anime-1");

    expect(approval.isApproved("anime-1")).toBe(true);
    expect(approval.isRejected("anime-1")).toBe(false);
  });

  test("reject clears approval", () => {
    const approval = createGroupApproval();
    approval.approve("anime-1");
    approval.reject("anime-1");

    expect(approval.isApproved("anime-1")).toBe(false);
    expect(approval.isRejected("anime-1")).toBe(true);
  });

  test("shouldExecute returns true when group is approved", () => {
    const approval = createGroupApproval();
    approval.approve("anime-1");

    expect(approval.shouldExecute("anime-1", new Map())).toBe(true);
  });

  test("shouldExecute returns false when group is rejected", () => {
    const approval = createGroupApproval();
    approval.reject("anime-1");

    expect(approval.shouldExecute("anime-1", new Map())).toBe(false);
  });

  test("shouldExecute returns true when no approvals exist and group is not rejected", () => {
    const approval = createGroupApproval();

    expect(approval.shouldExecute("anime-1", new Map())).toBe(true);
  });
});
