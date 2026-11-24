import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("demo password storage", () => {
  it("stores a salted hash and accepts only the matching password", async () => {
    const password = "example-password-2026";
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).not.toBe(password);
    expect(first).not.toBe(second);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword("wrong-password", first)).toBe(false);
    expect(await verifyPassword(password, "demo-only")).toBe(false);
  });
});
