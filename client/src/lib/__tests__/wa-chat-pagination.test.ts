import { describe, expect, it } from "vitest";
import { mergeFirstPage } from "../wa-chat-pagination";

interface FakePage {
  items: string[];
  nextCursor: string | null;
}

describe("mergeFirstPage", () => {
  it("substitui apenas a página 0 quando já há páginas antigas carregadas", () => {
    const old = {
      pages: [
        { items: ["a", "b"], nextCursor: "cursor-1" },
        { items: ["c", "d"], nextCursor: "cursor-2" },
      ] as FakePage[],
      pageParams: [null, "cursor-1"],
    };
    const fresh: FakePage = { items: ["a", "b", "novo"], nextCursor: "cursor-1" };

    const result = mergeFirstPage(old, fresh);

    expect(result.pages[0]).toEqual(fresh);
    expect(result.pages[1]).toEqual(old.pages[1]);
    expect(result.pages).toHaveLength(2);
    expect(result.pageParams).toEqual(old.pageParams);
  });

  it("cria a estrutura inicial quando não há cache anterior", () => {
    const fresh: FakePage = { items: ["a"], nextCursor: null };
    expect(mergeFirstPage(undefined, fresh)).toEqual({
      pages: [fresh],
      pageParams: [null],
    });
  });

  it("cria a estrutura inicial quando o cache anterior está vazio", () => {
    const fresh: FakePage = { items: ["a"], nextCursor: null };
    expect(mergeFirstPage({ pages: [], pageParams: [] }, fresh)).toEqual({
      pages: [fresh],
      pageParams: [null],
    });
  });
});
