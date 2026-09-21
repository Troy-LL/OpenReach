import { describe, expect, it } from "vitest";
import { splitQuery } from "../src/query-split.js";

describe("splitQuery", () => {
  it("returns empty facets for blank input", () => {
    expect(splitQuery("")).toEqual({
      problem: "",
      method: null,
      population: null,
      constraints: null,
      yearFrom: null,
      yearTo: null,
      recency: "any",
    });
    expect(splitQuery("   \n\t  ")).toEqual({
      problem: "",
      method: null,
      population: null,
      constraints: null,
      yearFrom: null,
      yearTo: null,
      recency: "any",
    });
  });

  it("parses since YYYY as yearFrom", () => {
    const f = splitQuery(
      "What works for depression in primary care since 2018?",
    );
    expect(f.yearFrom).toBe(2018);
    expect(f.yearTo).toBeNull();
    expect(f.recency).toBe("recent");
    expect(f.problem).toBe(
      "What works for depression in primary care since 2018?",
    );
  });

  it("parses last N years relative to 2026", () => {
    const f = splitQuery("RCTs on mindfulness in students over the last 5 years");
    expect(f.yearFrom).toBe(2022);
    expect(f.yearTo).toBe(2026);
    expect(f.recency).toBe("recent");
    expect(f.method).toBe("RCT");
    expect(f.population).toBe("students");
  });

  it("captures method hints from the question", () => {
    expect(splitQuery("meta-analysis of transformer models for NLP").method).toBe(
      "meta-analysis",
    );
    expect(splitQuery("qualitative interview study on burnout").method).toBe(
      "qualitative",
    );
    expect(
      splitQuery("randomized trial of CRISPR editing in vitro").method,
    ).toBe("randomized");
  });

  it("captures population hints from the question", () => {
    expect(splitQuery("survey of clinicians about EHR fatigue").population).toBe(
      "clinicians",
    );
    expect(
      splitQuery("residual learning in mice with induced diabetes").population,
    ).toBe("mice");
    expect(
      splitQuery("app usage among smartphone users in rural areas").population,
    ).toBe("smartphone users");
  });

  it("does not invent years when none appear in the text", () => {
    const f = splitQuery("how do residual connections help deep networks?");
    expect(f.yearFrom).toBeNull();
    expect(f.yearTo).toBeNull();
    expect(f.recency).toBe("any");
    expect(f.method).toBe("residual");
  });

  it("parses from YYYY to YYYY and in YYYY", () => {
    const range = splitQuery("papers from 2010 to 2015 on solar cells");
    expect(range.yearFrom).toBe(2010);
    expect(range.yearTo).toBe(2015);

    const single = splitQuery("landmark work in 1998 on quantum dots");
    expect(single.yearFrom).toBe(1998);
    expect(single.yearTo).toBe(1998);
  });

  it("captures constraint phrases", () => {
    expect(splitQuery("open access reviews on climate policy").constraints).toBe(
      "open access",
    );
    expect(splitQuery("review only systematic surveys of HCI").constraints).toBe(
      "review only",
    );
  });

  it("marks historical wording", () => {
    expect(splitQuery("foundational papers on backpropagation").recency).toBe(
      "historical",
    );
  });
});
