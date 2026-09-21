import { describe, expect, it } from "vitest";
import { safeHttpUrl } from "../src/safe-url.js";

describe("safeHttpUrl", () => {
  it("keeps http and https paper links", () => {
    expect(safeHttpUrl("https://arxiv.org/abs/1512.03385")).toBe(
      "https://arxiv.org/abs/1512.03385",
    );
    expect(safeHttpUrl("http://export.arxiv.org/pdf/1512.03385")).toBe(
      "http://export.arxiv.org/pdf/1512.03385",
    );
  });

  it("rejects javascript, data, and other non-http schemes", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeHttpUrl("vbscript:msgbox(1)")).toBeNull();
    expect(safeHttpUrl("//evil.example/paper")).toBeNull();
  });

  it("rejects empty or invalid values", () => {
    expect(safeHttpUrl(null)).toBeNull();
    expect(safeHttpUrl("")).toBeNull();
    expect(safeHttpUrl("   ")).toBeNull();
    expect(safeHttpUrl("not a url")).toBeNull();
  });
});
