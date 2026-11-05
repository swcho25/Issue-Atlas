import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { argumentSchema } from "@/shared/api";

import a3Json from "../../../../../../contracts/c2/examples/argument-a3-not-comparable.json";
import ready from "../../../../../../contracts/c2/examples/argument-c1-ready.json";
import { SourcesList } from "./SourcesList";
import { SourcesPanel } from "./SourcesPanel";

// 계약 예시는 기사가 0건이라, 같은 예시에 기사 한 건을 더해 기사 줄을 확인한다
const withArticle = argumentSchema.parse({
  ...ready,
  articles: [
    {
      id: "art_1",
      date: "2025-03-02",
      place_id: ready.question.place_id,
      point: null,
      precision: "admin_centroid",
      summary: "여수 청년 일자리 박람회",
      place_name: "여수시",
      url: "https://example.com/news/1",
    },
  ],
});
const a3 = argumentSchema.parse(a3Json);

const hrefOf = (id: string) => `/results/x/sources?e=${id}`;
/** 묶음 머리의 건수(이름 옆 숫자)만 */
const countOf = (group: HTMLElement) =>
  within(group).getByRole("heading").lastElementChild?.textContent;

describe("SourcesList", () => {
  it("기사는 기사 · 보도 묶음에 원문 사이트 링크로 들어간다", () => {
    render(<SourcesList argument={withArticle} selectedId={null} hrefOf={hrefOf} />);
    const group = screen.getByRole("region", { name: "기사 · 보도 · 민원" });

    const article = within(group).getByRole("link", { name: /여수 청년 일자리 박람회/ });
    expect(article).toHaveAttribute("href", "https://example.com/news/1");
    expect(article).toHaveAttribute("target", "_blank");
    expect(article).toHaveTextContent("본문 저장 안 함");
  });

  it("묶음 건수는 수요표의 전체 건수이고, 목록에 없는 나머지는 「… 외 N건」 줄로 보인다", () => {
    render(<SourcesList argument={withArticle} selectedId={null} hrefOf={hrefOf} />);
    const group = screen.getByRole("region", { name: "기사 · 보도 · 민원" });
    // count 12 = 대표 자료 1 + 기사 1 + 나머지 10
    expect(countOf(group)).toBe("12");
    expect(group).toHaveTextContent("… 외 10건");
  });

  it("확보인데 대표 자료가 하나도 없으면 「자료 N건」 줄로 보인다(A3 예시)", () => {
    render(<SourcesList argument={a3} selectedId={null} hrefOf={hrefOf} />);
    const group = screen.getByRole("region", { name: "기사 · 보도 · 민원" });
    expect(countOf(group)).toBe("5");
    expect(group).toHaveTextContent("자료 5건");
    expect(within(group).queryByRole("link")).toBeNull();
  });

  it("고른 근거는 aria-current 로 표시되고, 근거 줄은 ?e= 주소로 간다", () => {
    render(
      <SourcesList
        argument={withArticle}
        selectedId="ev_policy_yeosu_youth_2025"
        hrefOf={hrefOf}
      />,
    );
    const current = screen.getByRole("link", { current: true });
    expect(current).toHaveAttribute("href", "/results/x/sources?e=ev_policy_yeosu_youth_2025");
  });
});

describe("SourcesPanel", () => {
  it("전체 건수를 세고, 기사는 링크만으로 센다", () => {
    render(<SourcesPanel argument={withArticle} />);
    const counts = screen.getByRole("region", { name: "원문 건수" });
    expect(within(counts).getByRole("heading")).toHaveTextContent("원문 16건");
    const documents = within(counts).getByText("기사 · 보도 · 민원").nextElementSibling;
    expect(documents?.textContent).toBe("12 · 링크만 1");
  });
});
