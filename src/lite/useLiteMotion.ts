"use client";

import { useEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";

/**
 * All of the lite page's motion lives here so the view stays a plain component.
 * Everything is created inside a GSAP context (or a matchMedia context) and
 * reverted on unmount; reduced-motion visitors get the page statically.
 */
export function useLiteMotion(rootRef: RefObject<HTMLElement | null>, refreshKey?: string) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const q = gsap.utils.selector(root);
    const cleanups: Array<() => void> = [];

    const ctx = gsap.context(() => {
      const nav = q("[data-nav]")[0] as HTMLElement | undefined;
      const pill = q("[data-nav-pill]")[0] as HTMLElement | undefined;
      const linksBox = q("[data-nav-links]")[0] as HTMLElement | undefined;
      const navLinks = q("[data-nav-link]") as HTMLElement[];
      const activeLink = () => navLinks.find((link) => link.hasAttribute("data-active")) ?? navLinks[0] ?? null;

      // offsetLeft is relative to the nearest positioned parent, but the pill is
      // positioned against the nav itself. Walk the chain so they share a space.
      const offsetWithin = (element: HTMLElement, parent: HTMLElement) => {
        let x = 0;
        let y = 0;
        let node: HTMLElement | null = element;
        while (node && node !== parent) {
          x += node.offsetLeft;
          y += node.offsetTop;
          node = node.offsetParent as HTMLElement | null;
        }
        return { x, y };
      };

      // The liquid pill that sits behind the active (or hovered) nav item.
      const movePill = (link: HTMLElement | null, animate = true) => {
        if (!pill || !nav || !link) return;
        const offset = offsetWithin(link, nav);
        gsap.to(pill, {
          x: offset.x,
          y: offset.y,
          width: link.offsetWidth,
          height: link.offsetHeight,
          opacity: 1,
          duration: animate && !reduced ? 0.32 : 0,
          ease: "power3.out",
          overwrite: true,
        });
      };

      // Section marker: same trigger drives the nav's liquid pill.
      navLinks.forEach((link) => {
        const section = document.getElementById(link.dataset.navLink ?? "");
        if (!section) return;
        ScrollTrigger.create({
          trigger: section,
          start: "top 45%",
          end: "bottom 45%",
          onToggle: (self) => {
            if (!self.isActive) return;
            navLinks.forEach((other) => other.removeAttribute("data-active"));
            link.setAttribute("data-active", "true");
            movePill(link);
          },
        });
      });
      // Before any section has been reached the pill rests under the first link, so mark it too.
      if (!activeLink()?.hasAttribute("data-active")) navLinks[0]?.setAttribute("data-active", "true");
      movePill(activeLink(), false);

      if (nav && linksBox && !reduced) {
        const linkHandlers = navLinks.map((link) => {
          const handler = () => movePill(link);
          link.addEventListener("pointerenter", handler);
          link.addEventListener("focus", handler);
          return handler;
        });
        const leaveLinks = () => movePill(activeLink());
        linksBox.addEventListener("pointerleave", leaveLinks);

        // Text length changes with language: keep the pill glued to the active item.
        const observer = new ResizeObserver(() => movePill(activeLink(), false));
        observer.observe(linksBox);
        cleanups.push(() => {
          linksBox.removeEventListener("pointerleave", leaveLinks);
          navLinks.forEach((link, i) => {
            link.removeEventListener("pointerenter", linkHandlers[i]);
            link.removeEventListener("focus", linkHandlers[i]);
          });
          observer.disconnect();
        });
      }

      if (reduced) return;

      // The hairline inside the floating nav.
      const bar = q("[data-progress]")[0] as HTMLElement | undefined;
      if (bar) {
        gsap.fromTo(
          bar,
          { scaleX: 0 },
          {
            scaleX: 1,
            ease: "none",
            scrollTrigger: { trigger: root, start: "top top", end: "bottom bottom", scrub: 0.25 },
          }
        );
      }

      // Hero: the small type settles, the name rises out of its mask, then the actions arrive.
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from(q("[data-art-shape]"), { scale: 0, duration: 0.7, ease: "back.out(1.5)", stagger: 0.06 })
        .from(q("[data-hero-line]"), { y: 24, autoAlpha: 0, duration: 0.8, stagger: 0.1 }, "-=0.6")
        .from(q("[data-hero-word]"), { yPercent: 115, rotate: 3, duration: 1, stagger: 0.08 }, "-=0.55")
        .from(q("[data-hero-cta]"), { y: 20, autoAlpha: 0, duration: 0.7 }, "-=0.65");

      // Section titles unmask word by word as they enter.
      q("[data-kinetic]").forEach((title) => {
        const words = title.querySelectorAll("[data-kinetic-word]");
        if (!words.length) return;
        gsap.from(words, {
          yPercent: 115,
          rotate: 4,
          duration: 0.9,
          stagger: 0.055,
          ease: "power4.out",
          scrollTrigger: { trigger: title, start: "top 88%", once: true },
        });
      });

      q("[data-reveal]").forEach((el) => {
        gsap.from(el, {
          y: 36,
          autoAlpha: 0,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
      });

      q("[data-reveal-group]").forEach((group) => {
        const items = group.querySelectorAll("[data-reveal-item]");
        if (!items.length) return;
        gsap.from(items, {
          y: 32,
          autoAlpha: 0,
          duration: 0.8,
          stagger: 0.08,
          ease: "power3.out",
          scrollTrigger: { trigger: group, start: "top 85%", once: true },
        });
      });

      // Hairlines under each certificate draw themselves in.
      q("[data-rule]").forEach((rule) => {
        gsap.from(rule, {
          scaleX: 0,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: rule, start: "top 92%", once: true },
        });
      });

      // Hero artwork: as the poster scrolls away its shapes drift apart, each at its own pace.
      const artShapes = q("[data-art-shape]");
      if (artShapes.length) {
        gsap.to(artShapes, {
          y: (i) => (i % 2 ? -1 : 1) * (18 + (i % 4) * 14),
          rotation: (i) => (i % 3 === 0 ? 0 : (i % 2 ? -1 : 1) * 8),
          ease: "none",
          scrollTrigger: { trigger: "[data-hero]", start: "top top", end: "bottom top", scrub: 0.6 },
        });
      }

      // The shape bands turn into place while they cross the screen.
      q("[data-band]").forEach((band) => {
        gsap.fromTo(
          band.children,
          { rotation: -90, scale: 0.35, autoAlpha: 0.2 },
          {
            rotation: 0,
            scale: 1,
            autoAlpha: 1,
            ease: "power2.out",
            stagger: 0.06,
            scrollTrigger: { trigger: band, start: "top 98%", end: "top 45%", scrub: 0.5 },
          }
        );
      });

      // Section heads: the glyph spins in, the number drifts against the scroll, the rule draws itself.
      q("[data-section-head]").forEach((head) => {
        const glyph = head.querySelector("[data-glyph]");
        const no = head.querySelector("[data-section-no]");
        const rule = head.querySelector("[data-head-rule]");
        if (glyph) {
          gsap.fromTo(
            glyph,
            { rotation: -180, scale: 0.4 },
            {
              rotation: 0,
              scale: 1,
              ease: "power2.out",
              scrollTrigger: { trigger: head, start: "top 92%", end: "top 45%", scrub: 0.5 },
            }
          );
        }
        if (no) {
          gsap.fromTo(
            no,
            { yPercent: 40 },
            {
              yPercent: -20,
              ease: "none",
              scrollTrigger: { trigger: head, start: "top bottom", end: "bottom top", scrub: true },
            }
          );
        }
        if (rule) {
          gsap.from(rule, {
            scaleX: 0,
            duration: 1.1,
            ease: "power4.inOut",
            scrollTrigger: { trigger: head, start: "top 85%", once: true },
          });
        }
      });

      // Contact: the shapes assemble as the panel rises into view.
      q("[data-contact-art]").forEach((art) => {
        gsap.fromTo(
          art.children,
          { scale: 0, rotation: (i) => (i % 2 ? 90 : -90) },
          {
            scale: 1,
            rotation: 0,
            ease: "back.out(1.4)",
            stagger: 0.12,
            scrollTrigger: { trigger: art, start: "top 92%", end: "top 40%", scrub: 0.6 },
          }
        );
      });

      // A slow drift inside project shots, independent of the cards' reveal.
      q("[data-project-shot]").forEach((shot) => {
        const frame = shot.closest("[data-project]");
        if (!frame) return;
        gsap.fromTo(
          shot,
          { yPercent: -6, scale: 1.08 },
          {
            yPercent: 6,
            scale: 1.08,
            ease: "none",
            scrollTrigger: { trigger: frame, start: "top bottom", end: "bottom top", scrub: true },
          }
        );
      });
    }, root);

    // Work experience cards: reveal each card as it enters, no horizontal motion.
    const mm = gsap.matchMedia();
    if (!reduced) {
      mm.add("(min-width: 0px)", () => {
        const cards = q("[data-work-card]") as HTMLElement[];
        if (!cards.length) return;

        cards.forEach((card) => {
          const lead = card.querySelector("[class*='workLead']");
          const main = card.querySelector("[class*='workMain']");

          if (lead && main) {
            const tl = gsap.timeline({
              scrollTrigger: {
                trigger: card,
                start: "top 88%",
                once: true,
              },
            });
            tl.from(lead, { y: 24, autoAlpha: 0, duration: 0.7, ease: "power3.out" }).from(
              main,
              { y: 32, autoAlpha: 0, duration: 0.85, ease: "power3.out" },
              "-=0.5"
            );
            return;
          }

          gsap.from(card, {
            y: 48,
            autoAlpha: 0,
            scale: 0.985,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: {
              trigger: card,
              start: "top 88%",
              once: true,
            },
          });
        });
      });
    }

    const onAnchorClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
      if (!link) return;
      const id = link.getAttribute("href")?.slice(1);
      if (!id) return;
      const destination = document.getElementById(id);
      if (!destination) return;

      event.preventDefault();
      const mark = () => window.history.replaceState(null, "", `#${id}`);
      if (reduced) {
        destination.scrollIntoView();
        mark();
        return;
      }
      gsap.to(window, {
        duration: 1.05,
        ease: "power3.inOut",
        scrollTo: { y: destination, offsetY: 96, autoKill: true },
        onComplete: mark,
      });
    };
    root.addEventListener("click", onAnchorClick);

    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("load", refresh);
    void document.fonts?.ready.then(refresh).catch(() => {});

    return () => {
      root.removeEventListener("click", onAnchorClick);
      window.removeEventListener("load", refresh);
      cleanups.forEach((cleanup) => cleanup());
      mm.revert();
      ctx.revert();
    };
  }, [rootRef]);

  // Language/theme changes alter text and colours, so pinned distances need remeasuring.
  useEffect(() => {
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, [refreshKey]);
}
