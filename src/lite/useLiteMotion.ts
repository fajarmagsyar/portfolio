"use client";

import { useEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { ScrollSmoother } from "gsap/ScrollSmoother";

/**
 * All of the lite page's motion lives here so the view stays a plain component.
 * Everything is created inside a GSAP context (or a matchMedia context) and
 * reverted on unmount; reduced-motion visitors get the page statically.
 */
export function useLiteMotion(rootRef: RefObject<HTMLElement | null>, refreshKey?: string) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, ScrollSmoother);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const q = gsap.utils.selector(root);
    const cleanups: Array<() => void> = [];
    // Inertial scrolling only where a wheel or trackpad drives the page; touch keeps its native fling.
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    let smoother: ScrollSmoother | null = null;
    let revealStart = (_el: Element, at: number): string | (() => string) => `top ${at}%`;
    const NAV_OFFSET = 96;

    const ctx = gsap.context(() => {
      // Must exist before any ScrollTrigger so they all read its scroll position.
      const wrapper = q("[data-smooth-wrapper]")[0] as HTMLElement | undefined;
      const content = q("[data-smooth-content]")[0] as HTMLElement | undefined;
      if (!reduced && finePointer && wrapper && content) {
        smoother = ScrollSmoother.create({ wrapper, content, smooth: 1.1, effects: false, smoothTouch: false });
        const initial = window.location.hash.slice(1);
        const target = initial ? document.getElementById(initial) : null;
        if (target) smoother.scrollTo(target, false, `top ${NAV_OFFSET}px`);
      }

      // Intro: the page opens on a blank screen with only the greeting and a subtitle. The hero is
      // pinned while scrolling carries the greeting into the poster's headline, the backdrop clears,
      // the nav docks, and the poster is printed from blueprint to colour.
      const hero = q("[data-hero]")[0] as HTMLElement | undefined;
      const heroTitle = hero?.querySelector<HTMLElement>("h1");
      if (hero && heroTitle && !reduced) {
        // The headline's box relative to the hero, from layout offsets so no transform can skew it.
        // Words are looked up each time: a language swap re-keys them, so React replaces the nodes.
        const offsetIn = (el: HTMLElement) => {
          let x = 0;
          let y = 0;
          for (let node: HTMLElement | null = el; node && node !== hero; node = node.offsetParent as HTMLElement | null) {
            x += node.offsetLeft;
            y += node.offsetTop;
          }
          return { x, y };
        };
        const titleBox = () => {
          const words = Array.from(heroTitle.querySelectorAll<HTMLElement>("[data-hero-word]"), (w) => w.parentElement ?? w);
          const boxes = words.map((w) => ({ ...offsetIn(w), w: w.offsetWidth, h: w.offsetHeight }));
          const left = Math.min(...boxes.map((b) => b.x));
          const right = Math.max(...boxes.map((b) => b.x + b.w));
          const top = Math.min(...boxes.map((b) => b.y));
          const bottom = Math.max(...boxes.map((b) => b.y + b.h));
          return { cx: (left + right) / 2, cy: (top + bottom) / 2, height: bottom - top };
        };
        const centreY = () => window.innerHeight * 0.46;
        const sub = q("[data-intro-sub]")[0];
        const dock = q("[data-nav-dock]")[0];

        // The greeting's flight is driven by a 0..1 value; the offsets it scales are re-measured on
        // every refresh (language swap, resize, fonts), so it always starts dead centre.
        let dx = 0;
        let dy = 0;
        let subY = 0;
        const flight = { p: 0 };
        const ease = gsap.parseEase("power2.inOut");
        const measure = () => {
          const box = titleBox();
          dx = hero.offsetWidth / 2 - box.cx;
          dy = centreY() - box.cy;
          subY = centreY() + box.height / 2 + 14;
        };
        const place = () => {
          const left = 1 - ease(flight.p);
          gsap.set(heroTitle, { x: dx * left, y: dy * left });
          gsap.set(sub, { y: subY - 44 * Math.min(flight.p / 0.4, 1) });
        };
        measure();
        place();

        gsap
          .timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: hero,
              start: "top top",
              end: () => `+=${Math.round(window.innerHeight * 1.3)}`,
              pin: true,
              scrub: 0.6,
            },
          })
          .fromTo(flight, { p: 0 }, { p: 1, duration: 0.34, onUpdate: place }, 0)
          .fromTo(sub, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.14 }, 0)
          .fromTo("[data-intro-bg]", { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.26 }, 0.08)
          .fromTo(dock, { yPercent: -180, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.14, ease: "power2.out" }, 0.24)
          .fromTo("[data-hero-art]", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1 }, 0.3)
          .fromTo(q("[data-hero-rest]"), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.12, stagger: 0.03, ease: "power2.out" }, 0.3)
          .fromTo(hero, { "--k": 0 }, { "--k": 1, duration: 0.55 }, 0.45)
          .fromTo(q("[data-art-shape]"), { fillOpacity: 0 }, { fillOpacity: 1, duration: 0.2, stagger: 0.025 }, 0.5);

        // Re-measure after every refresh; the timeline only re-places the greeting while it moves.
        const rerender = () => {
          measure();
          place();
        };
        ScrollTrigger.addEventListener("refresh", rerender);
        cleanups.push(() => ScrollTrigger.removeEventListener("refresh", rerender));
      }

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

      // Scene handoff: every section's stage recedes as it leaves while the next one rises
      // underneath it. Both are scrubbed, so the change follows the scroll instead of popping.
      const scenes = q("[data-scene]") as HTMLElement[];
      scenes.forEach((scene, i) => {
        const stage = scene.querySelector<HTMLElement>("[data-stage]");
        if (!stage) return;
        const isFirst = i === 0;
        const isLast = i === scenes.length - 1;

        if (!isFirst) {
          gsap.fromTo(
            stage,
            { y: 110 },
            {
              y: 0,
              ease: "power2.out",
              scrollTrigger: { trigger: scene, start: "top bottom", end: "top 35%", scrub: 0.6 },
            }
          );
        }

        if (!isLast) {
          // Separate tween on its own properties (yPercent/opacity) so it composes with the entry.
          gsap.fromTo(
            stage,
            { yPercent: 0, autoAlpha: 1 },
            {
              yPercent: isFirst ? -6 : -4,
              autoAlpha: 0.15,
              ease: "power1.in",
              immediateRender: false,
              // The pinned hero's own bottom is measured before its pin, so it hands off from the band below.
              scrollTrigger: isFirst
                ? { trigger: "[data-band]", start: "top 60%", end: "top top", scrub: 0.6 }
                : { trigger: scene, start: "bottom 60%", end: "bottom top", scrub: 0.6 },
            }
          );
        }
      });

      // Reveals inside a stage are measured while the stage is shifted by the handoff above, so
      // their start is pushed by that same shift to fire where the layout says they are.
      const stageShift = (el: Element) => {
        const stage = el.closest<HTMLElement>("[data-stage]");
        if (!stage) return 0;
        const y = Number(gsap.getProperty(stage, "y")) || 0;
        const yPercent = Number(gsap.getProperty(stage, "yPercent")) || 0;
        return y + (yPercent * stage.offsetHeight) / 100;
      };
      revealStart = (el, at) => () => `top ${Math.round((window.innerHeight * at) / 100 + stageShift(el))}px`;

      // Every other block prints itself while it travels from the bottom of the screen to its upper half.
      (q("[data-build]") as HTMLElement[]).forEach((block) => {
        if (block === hero) return;
        gsap.fromTo(
          block,
          { "--k": 0 },
          {
            "--k": 1,
            ease: "none",
            scrollTrigger: { trigger: block, start: revealStart(block, 92), end: revealStart(block, 45), scrub: 0.4 },
          }
        );
      });

      // The hero's name lifts away faster than its poster once the band takes over.
      if (heroTitle) {
        gsap.to(heroTitle, {
          yPercent: -35,
          ease: "none",
          scrollTrigger: { trigger: "[data-band]", start: "top bottom", end: "top top", scrub: 0.4 },
        });
      }

      // On load: the greeting rises out of its mask, then the subtitle settles under it.
      gsap
        .timeline({ defaults: { ease: "power3.out" }, delay: 0.15 })
        .from(q("[data-hero-word]"), { yPercent: 115, rotate: 3, duration: 1, stagger: 0.08 })
        .from(q("[data-intro-sub-text]"), { y: 16, autoAlpha: 0, duration: 0.8 }, "-=0.6");

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
          scrollTrigger: { trigger: title, start: revealStart(title, 88), once: true },
        });
      });

      q("[data-reveal]").forEach((el) => {
        gsap.from(el, {
          y: 36,
          autoAlpha: 0,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: revealStart(el, 88), once: true },
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
          scrollTrigger: { trigger: group, start: revealStart(group, 85), once: true },
        });
      });

      // Hairlines under each certificate draw themselves in.
      q("[data-rule]").forEach((rule) => {
        gsap.from(rule, {
          scaleX: 0,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: rule, start: revealStart(rule, 92), once: true },
        });
      });

      // Hero artwork: as the poster scrolls away its shapes drift apart a little, each at its own pace.
      const artShapes = q("[data-art-shape]");
      if (artShapes.length) {
        gsap.to(artShapes, {
          y: (i) => (i % 2 ? -1 : 1) * (10 + (i % 4) * 8),
          ease: "none",
          scrollTrigger: { trigger: "[data-band]", start: "top bottom", end: "top top", scrub: 0.6 },
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

      // Section heads: the glyph spins in, the rule draws itself.
      q("[data-section-head]").forEach((head) => {
        const glyph = head.querySelector("[data-glyph]");
        const rule = head.querySelector("[data-head-rule]");
        if (glyph) {
          gsap.fromTo(
            glyph,
            { rotation: -180, scale: 0.4 },
            {
              rotation: 0,
              scale: 1,
              ease: "power2.out",
              scrollTrigger: { trigger: head, start: revealStart(head, 92), end: revealStart(head, 45), scrub: 0.5 },
            }
          );
        }
        if (rule) {
          gsap.from(rule, {
            scaleX: 0,
            duration: 1.1,
            ease: "power4.inOut",
            scrollTrigger: { trigger: head, start: revealStart(head, 85), once: true },
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
                start: revealStart(card, 88),
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
              start: revealStart(card, 88),
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
      if (smoother) {
        smoother.scrollTo(destination, true, `top ${NAV_OFFSET}px`);
        mark();
        return;
      }
      gsap.to(window, {
        duration: 1.05,
        ease: "power3.inOut",
        scrollTo: { y: destination, offsetY: NAV_OFFSET, autoKill: true },
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
      (smoother as ScrollSmoother | null)?.kill();
      smoother = null;
      ctx.revert();
    };
  }, [rootRef]);

  // Language/theme changes alter text and colours, so pinned distances need remeasuring.
  useEffect(() => {
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, [refreshKey]);
}
