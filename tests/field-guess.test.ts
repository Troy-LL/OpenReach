import { describe, expect, it } from "vitest";
import { guessField } from "../src/field-guess.js";

describe("guessField", () => {
  it("returns other for blank or unclear questions", () => {
    expect(guessField("")).toBe("other");
    expect(guessField("   ")).toBe("other");
    expect(guessField("what is the meaning of life")).toBe("other");
  });

  it("guesses cs from computer-science wording", () => {
    expect(guessField("transformer attention mechanism for NLP")).toBe("cs");
    expect(guessField("how do residual networks train deep image models")).toBe(
      "cs",
    );
  });

  it("guesses biomed, physics, and social when only that field matches", () => {
    expect(guessField("RCT of patients with clinical depression")).toBe(
      "biomed",
    );
    expect(guessField("neutrino oscillation at a hadron collider")).toBe(
      "physics",
    );
    expect(guessField("classroom pedagogy and education policy")).toBe(
      "social",
    );
  });

  it("stays other when more than one field matches so specialty coverage stays wide", () => {
    expect(
      guessField("transformer models for cancer patients in clinical trials"),
    ).toBe("other");
  });
});
