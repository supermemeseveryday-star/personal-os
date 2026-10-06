"use client";

import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Language } from "@/lib/i18n";

type Node = ReactElement<{ className?: string; children?: ReactNode }>;

function flatten(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap((child) =>
    isValidElement(child) && child.type === Fragment ? flatten((child as Node).props.children) : [child],
  );
}

export default function PageDeck({
  children,
  language,
  dashboard = false,
}: {
  children: ReactNode;
  language: Language;
  dashboard?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [compact, setCompact] = useState(false);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const update = () => setCompact(window.innerWidth < 700);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const nodes = flatten(children);
  const intro: ReactNode[] = [];
  while (
    nodes.length &&
    isValidElement(nodes[0]) &&
    ["heading", "back", "card onboarding"].includes((nodes[0] as Node).props.className || "")
  ) {
    intro.push(nodes.shift());
  }
  if (dashboard && !compact && nodes.length >= 2) {
    nodes.splice(
      0,
      2,
      <div className="deck-stack" key="overview">
        {nodes[0]}
        {nodes[1]}
      </div>,
    );
  }

  const pages = nodes.flatMap((node) => {
    if (!isValidElement(node) || (node as Node).props.className !== "project-grid") return [node];
    const cards = Children.toArray((node as Node).props.children);
    const size = compact ? 1 : 3;
    if (cards.length <= size) return [node];
    return Array.from({ length: Math.ceil(cards.length / size) }, (_, i) =>
      cloneElement(node as Node, { key: `grid-${i}`, children: cards.slice(i * size, (i + 1) * size) }),
    );
  });
  if (!pages.length) pages.push(null);
  const current = Math.min(index, pages.length - 1);
  const go = (next: number) => {
    const target = Math.max(0, Math.min(pages.length - 1, next));
    if (target === current) return;
    setDirection(target > current ? "next" : "prev");
    setIndex(target);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || document.querySelector('[role="dialog"]')) return;
      if (
        event.target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)
      )
        return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        go(current + 1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(current - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, pages.length]);

  return (
    <div className="page-deck">
      {intro.length > 0 && <div className="page-deck-intro">{intro}</div>}
      <div
        className="page-deck-view"
        aria-live="polite"
        onTouchStart={(e) => {
          touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }}
        onTouchEnd={(e) => {
          if (!touch.current) return;
          const dx = e.changedTouches[0].clientX - touch.current.x;
          const dy = e.changedTouches[0].clientY - touch.current.y;
          if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) go(current + (dx < 0 ? 1 : -1));
          touch.current = null;
        }}
      >
        <div className={"deck-page " + direction} key={current}>
          {pages[current]}
        </div>
      </div>
      {pages.length > 1 && (
        <nav className="page-deck-controls" aria-label={language === "zh" ? "内容翻页" : "Content pages"}>
          <button
            type="button"
            onClick={() => go(current - 1)}
            disabled={current === 0}
            aria-label={language === "zh" ? "上一页" : "Previous page"}
          >
            <ChevronLeft size={17} />
            <span>{language === "zh" ? "上一页" : "Previous"}</span>
          </button>
          <div
            className="page-deck-dots"
            aria-label={
              language === "zh"
                ? `第 ${current + 1} 页，共 ${pages.length} 页`
                : `Page ${current + 1} of ${pages.length}`
            }
          >
            {pages.map((_, i) => (
              <button
                type="button"
                key={i}
                className={i === current ? "active" : ""}
                onClick={() => go(i)}
                aria-label={language === "zh" ? `第 ${i + 1} 页` : `Page ${i + 1}`}
                aria-current={i === current ? "page" : undefined}
              />
            ))}
          </div>
          <span className="page-deck-count">
            {String(current + 1).padStart(2, "0")} / {String(pages.length).padStart(2, "0")}
          </span>
          <button type="button" onClick={() => go(current + 1)} disabled={current === pages.length - 1}>
            <span>{language === "zh" ? "下一页" : "Next"}</span>
            <ChevronRight size={17} />
          </button>
        </nav>
      )}
    </div>
  );
}
