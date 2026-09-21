import { describe, expect, it } from "vitest";
import { parseSuggestResults, rankSuggestions } from "../src/suggest.js";

describe("parseSuggestResults", () => {
  it("maps OpenAlex autocomplete hits into suggestions", () => {
    const suggestions = parseSuggestResults(
      [
        {
          id: "https://openalex.org/W1",
          display_name: "Deep Residual Learning for Image Recognition",
          hint: "Kaiming He et al.",
          cited_by_count: 1000,
          entity_type: "work",
        },
      ],
      "work",
    );
    expect(suggestions).toEqual([
      {
        id: "https://openalex.org/W1",
        text: "Deep Residual Learning for Image Recognition",
        hint: "Kaiming He et al.",
        kind: "work",
      },
    ]);
  });

  it("skips empty display names", () => {
    expect(
      parseSuggestResults([{ id: "x", display_name: "  ", entity_type: "work" }], "work"),
    ).toEqual([]);
  });
});

describe("rankSuggestions", () => {
  it("dedupes by normalized text and prefers works over topics", () => {
    const ranked = rankSuggestions([
      {
        id: "t1",
        text: "Deep Learning",
        hint: "topic",
        kind: "topic",
      },
      {
        id: "w1",
        text: "deep learning",
        hint: "Author",
        kind: "work",
      },
      {
        id: "w2",
        text: "Residual Networks",
        hint: null,
        kind: "work",
      },
    ]);
    expect(ranked.map((s) => s.id)).toEqual(["w1", "w2"]);
  });
});
