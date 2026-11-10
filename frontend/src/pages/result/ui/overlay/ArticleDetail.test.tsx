import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { ArgumentArticle } from "@/shared/api";

import { ArticleDetail, ArticleGroupDetail } from "./ArticleDetail";

// 지도는 jsdom 에서 그리지 않는다(같은 지도 하나 — 부를 때마다 새 객체면 자리 재기가 끝없이 돈다)
const fakeMap = vi.hoisted(() => ({
  project: () => ({ x: 400, y: 300 }),
  getContainer: () => ({ clientWidth: 1600, clientHeight: 900 }),
  on: () => {},
  off: () => {},
}));
vi.mock("@/shared/ui/map", () => ({ useMapInstance: () => fakeMap }));

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
    unobserve() {}
  } as unknown as typeof ResizeObserver;
});

const base: ArgumentArticle = {
  id: "n1",
  date: "2024-05-03",
  place_id: "kr-12130",
  point: [127.66, 34.76],
  precision: "address",
  summary: "여수시가 청년 정착 지원을 늘린다",
  place_name: "만덕동",
  url: "https://news.example/1",
  evidence_id: "ev_news_1",
  source_grade: "B",
};

describe("기사 창", () => {
  it("요약 · 지역 · 날짜 · 위치 정밀도, 「원문 보기」 는 원문 탭 근거 상세 · 「원문 사이트」 는 새 창", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ArticleDetail
        article={base}
        at={[127.66, 34.76]}
        markKey="article:n1"
        runId="run_x"
        onClose={onClose}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "만덕동 · 2024-05-03" });
    expect(dialog).toHaveTextContent("여수시가 청년 정착 지원을 늘린다");
    expect(dialog).toHaveTextContent("주소로 찍은 위치 · 출처 등급 B");
    expect(screen.getByRole("link", { name: /원문 보기/ })).toHaveAttribute(
      "href",
      "/results/run_x/sources?e=ev_news_1",
    );
    const site = screen.getByRole("link", { name: /원문 사이트/ });
    expect(site).toHaveAttribute("href", "https://news.example/1");
    expect(site).toHaveAttribute("target", "_blank");

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenLastCalledWith(true);
  });

  it("근거 ID 가 없는 기사(지난 실행)는 원문 사이트만, 둘 다 없으면 알림 글", () => {
    const { unmount } = render(
      <ArticleDetail
        article={{ ...base, evidence_id: null }}
        at={[127.66, 34.76]}
        markKey="article:n1"
        runId="run_x"
        onClose={() => {}}
      />,
    );
    expect(screen.queryByRole("link", { name: /원문 보기/ })).toBeNull();
    expect(screen.getByRole("link", { name: /원문 사이트/ })).toBeInTheDocument();
    unmount();
    render(
      <ArticleDetail
        article={{ ...base, evidence_id: null, url: null }}
        at={[127.66, 34.76]}
        markKey="article:n1"
        runId="run_x"
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("원문 링크가 없는 기사예요");
  });

  it("위치 근사 묶음: 묶음 이름 · 실제 위치가 아니라는 말 · 기사마다 원문(근거 상세 또는 새 창)", () => {
    const articles: ArgumentArticle[] = [
      { ...base, id: "a", precision: "admin_centroid", summary: "근거 있는 기사" },
      {
        ...base,
        id: "b",
        precision: "admin_centroid",
        summary: "근거 없는 기사",
        evidence_id: null,
      },
    ];
    render(
      <ArticleGroupDetail
        group={{
          key: "g",
          at: [127.66, 34.76],
          area: "여수시",
          count: 2,
          name: "위치 근사 · 여수시 중심 2건",
          ids: ["a", "b"],
        }}
        articles={articles}
        markKey="article-group:g"
        runId="run_x"
        onClose={() => {}}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "위치 근사 · 여수시 중심 2건" });
    expect(dialog).toHaveTextContent("실제 위치가 아니에요");
    expect(screen.getByRole("link", { name: /근거 있는 기사/ })).toHaveAttribute(
      "href",
      "/results/run_x/sources?e=ev_news_1",
    );
    expect(screen.getByRole("link", { name: /근거 없는 기사/ })).toHaveAttribute(
      "href",
      "https://news.example/1",
    );
  });
});
