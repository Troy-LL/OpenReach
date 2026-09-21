import { describe, expect, it } from "vitest";
import { parseFindArgs } from "../src/cli.js";

describe("parseFindArgs", () => {
  it("parses a plain question with defaults", () => {
    expect(parseFindArgs(["how do skip connections work?"])).toEqual({
      question: "how do skip connections work?",
      json: false,
      demo: false,
      scoreFirst: 12,
    });
  });

  it("parses --json and --demo flags", () => {
    expect(parseFindArgs(["--json", "--demo"])).toEqual({
      question: "",
      json: true,
      demo: true,
      scoreFirst: 12,
    });
  });

  it("parses --score-first=N", () => {
    expect(parseFindArgs(["--score-first=0", "--json", "residual networks"])).toEqual({
      question: "residual networks",
      json: true,
      demo: false,
      scoreFirst: 0,
    });
  });

  it("parses --score-first N as separate token", () => {
    expect(parseFindArgs(["--score-first", "3", "deep learning"])).toEqual({
      question: "deep learning",
      json: false,
      demo: false,
      scoreFirst: 3,
    });
  });

  it("leaves empty question when no args", () => {
    expect(parseFindArgs([])).toEqual({
      question: "",
      json: false,
      demo: false,
      scoreFirst: 12,
    });
  });
});
