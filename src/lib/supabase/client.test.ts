import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("supabase client safety", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    vi.resetModules();
  });

  it("reports not configured for empty env", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "";
    const mod = await import("@/lib/supabase/client");
    expect(mod.isSupabaseConfigured()).toBe(false);
    expect(mod.getSupabaseClient()).toBeNull();
  });

  it("rejects invalid URL strings without throwing", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "not-a-url";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    const mod = await import("@/lib/supabase/client");
    expect(mod.isSupabaseConfigured()).toBe(false);
    expect(() => mod.getSupabaseClient()).not.toThrow();
    expect(mod.getSupabaseClient()).toBeNull();
  });

  it("rejects placeholder undefined strings", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "undefined";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "undefined";
    const mod = await import("@/lib/supabase/client");
    expect(mod.isSupabaseConfigured()).toBe(false);
    expect(mod.getSupabaseClient()).toBeNull();
  });
});
