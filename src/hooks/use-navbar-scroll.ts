import { useEffect, useReducer, useRef, useCallback } from "react";

import { NAV_LINKS } from "@/data/navigation";

type NavbarState = {
  scrolled: boolean;
  showScrollTop: boolean;
  activeFragment: string;
};

type NavbarAction =
  | { type: "setScrolled"; scrolled: boolean }
  | { type: "setShowScrollTop"; showScrollTop: boolean }
  | { type: "setActiveFragment"; activeFragment: string };

// oxlint-disable-next-line unicorn/switch-case-braces -- reducer cases are single returns, braces add noise
const navbarReducer = (state: NavbarState, action: NavbarAction): NavbarState => {
  switch (action.type) {
    case "setScrolled": {
      return { ...state, scrolled: action.scrolled };
    }
    case "setShowScrollTop": {
      return { ...state, showScrollTop: action.showScrollTop };
    }
    case "setActiveFragment": {
      return { ...state, activeFragment: action.activeFragment };
    }
    default: {
      return state;
    }
  }
};

/**
 * Modern declarative scroll handling for Navbar.
 * Replaces imperative `document.createElement` sentinel injection with React refs + IntersectionObserver.
 * Single hook owns scroll state, sentinels, and scroll-spy.
 */
export const useNavbarScroll = () => {
  const [state, dispatch] = useReducer(navbarReducer, {
    scrolled: false,
    showScrollTop: false,
    activeFragment: "",
  });

  const topRef = useRef<HTMLDivElement>(null);
  const scrollSentinelRef = useRef<HTMLDivElement>(null);
  const middleSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const topEl = topRef.current;
    const scrollEl = scrollSentinelRef.current;
    const middleEl = middleSentinelRef.current;

    const scrollObserver = new IntersectionObserver(
      ([entry]) => dispatch({ type: "setScrolled", scrolled: !entry.isIntersecting }),
      { threshold: 0 },
    );
    const topObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) dispatch({ type: "setActiveFragment", activeFragment: "" });
      },
      { threshold: 0 },
    );
    const middleObserver = new IntersectionObserver(
      ([entry]) => dispatch({ type: "setShowScrollTop", showScrollTop: !entry.isIntersecting }),
      { threshold: 0 },
    );

    if (scrollEl) scrollObserver.observe(scrollEl);
    if (topEl) topObserver.observe(topEl);
    if (middleEl) middleObserver.observe(middleEl);

    const spyObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) dispatch({ type: "setActiveFragment", activeFragment: entry.target.id });
        }
      },
      { rootMargin: "-20% 0px -35% 0px", threshold: 0.1 },
    );

    for (const link of NAV_LINKS) {
      if (link.id) {
        const el = document.querySelector(`#${link.id}`);
        if (el) spyObserver.observe(el);
      }
    }

    return () => {
      scrollObserver.disconnect();
      topObserver.disconnect();
      middleObserver.disconnect();
      spyObserver.disconnect();
    };
  }, []);

  const handleSmoothScroll = useCallback((e: React.MouseEvent<HTMLAnchorElement>, to: string, id?: string) => {
    if (id !== undefined) dispatch({ type: "setActiveFragment", activeFragment: id });

    if (to.includes("#")) {
      const targetId = to.split("#")[1];
      const element = document.querySelector(`#${targetId}`);
      if (element) {
        e.preventDefault();
        const headerOffset = 80;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + globalThis.pageYOffset - headerOffset;
        globalThis.scrollTo({ top: offsetPosition, behavior: "smooth" });
        globalThis.history.pushState(undefined, "", `/#${targetId}`);
      }
    } else if (to === "/") {
      e.preventDefault();
      globalThis.scrollTo({ top: 0, behavior: "smooth" });
      globalThis.history.pushState(undefined, "", "/");
    }
  }, []);

  const scrollToTop = useCallback(() => {
    globalThis.scrollTo({ top: 0, behavior: "smooth" });
    dispatch({ type: "setActiveFragment", activeFragment: "" });
  }, []);

  const setActiveFragment = useCallback(
    (id: string) => dispatch({ type: "setActiveFragment", activeFragment: id }),
    [],
  );

  return {
    ...state,
    refs: { topRef, scrollSentinelRef, middleSentinelRef },
    handleSmoothScroll,
    scrollToTop,
    setActiveFragment,
  };
};
