import { describe, expect, it } from "vitest";
import { filterNewsByPreference, parseNewsPreferences, serializeNewsPreferences, toggleNewsPreference } from "./newsPreferences";

describe("news preferences", () => {
  it("parses, serializes and deduplicates browser state", () => {
    const parsed = parseNewsPreferences('{"favorites":["a","a",3],"readLater":["b"]}');
    expect(parsed).toEqual({ favorites: ["a"], readLater: ["b"] });
    expect(parseNewsPreferences("not-json")).toEqual({ favorites: [], readLater: [] });
    expect(JSON.parse(serializeNewsPreferences(parsed))).toEqual(parsed);
    expect(toggleNewsPreference(["a"], "a")).toEqual([]);
    expect(toggleNewsPreference([], "b")).toEqual(["b"]);
  });

  it("filters items by favorites and read later state", () => {
    const items = [{ id: 1, preferenceId: "a" }, { id: 2, preferenceId: "b" }];
    const state = { favorites: ["a"], readLater: ["b"] };
    expect(filterNewsByPreference(items, state, "favorites")).toEqual([items[0]]);
    expect(filterNewsByPreference(items, state, "readLater")).toEqual([items[1]]);
    expect(filterNewsByPreference(items, state, "all")).toEqual(items);
  });
});
