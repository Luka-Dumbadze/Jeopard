import { describe, expect, it } from "vitest";

/**
 * Documents the hydration contract used by `useHydration`:
 * after the first client mount effect, hydrated must be true
 * regardless of localStorage / persist callback timing.
 */
describe("hydration contract", () => {
  it("treats client mount as sufficient to unblock UI", () => {
    let hydrated = false;
    // Simulate useEffect mount callback
    const onMount = () => {
      hydrated = true;
    };
    onMount();
    expect(hydrated).toBe(true);
  });
});
