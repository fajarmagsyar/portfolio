"use client";

import { useEffect, type RefObject } from "react";
import gsap from "gsap";

const INTERACTIVE = "a, button, [role='button'], label, summary";

/**
 * A Bauhaus cursor for mouse and trackpad users: an orange dot sits on the pointer while an
 * outlined square trails behind it. Over anything clickable the square turns into a yellow,
 * ink-outlined quarter disc that swells around the dot; pressing squashes it. Touch, pen-less tablets and
 * reduced-motion visitors keep the system cursor.
 */
export function useBauhausCursor(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;

    const cursor = root.querySelector<HTMLElement>("[data-cursor]");
    const dot = root.querySelector<HTMLElement>("[data-cursor-dot]");
    const shape = root.querySelector<HTMLElement>("[data-cursor-shape]");
    if (!cursor || !dot || !shape) return;

    root.setAttribute("data-custom-cursor", "");
    gsap.set([dot, shape], { xPercent: -50, yPercent: -50 });

    // The dot is glued to the pointer; the shape follows with a little lag.
    const dotX = gsap.quickTo(dot, "x", { duration: 0.08, ease: "power3.out" });
    const dotY = gsap.quickTo(dot, "y", { duration: 0.08, ease: "power3.out" });
    const shapeX = gsap.quickTo(shape, "x", { duration: 0.45, ease: "power3.out" });
    const shapeY = gsap.quickTo(shape, "y", { duration: 0.45, ease: "power3.out" });

    let seen = false;
    let hovering = false;
    let lastX = 0;
    let lastY = 0;

    const setHover = (over: boolean) => {
      if (over === hovering) return;
      hovering = over;
      gsap.to(shape, {
        width: over ? 46 : 30,
        height: over ? 46 : 30,
        borderRadius: over ? "100% 0% 0% 0%" : "0% 0% 0% 0%",
        rotation: over ? 90 : 0,
        backgroundColor: over ? "rgba(251, 176, 59, 1)" : "rgba(251, 176, 59, 0)",
        duration: 0.35,
        ease: "power3.out",
        overwrite: "auto",
      });
      gsap.to(dot, { scale: over ? 0.6 : 1, duration: 0.25, overwrite: "auto" });
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      if (!seen) {
        seen = true;
        gsap.set([dot, shape], { x: event.clientX, y: event.clientY });
        gsap.to(cursor, { autoAlpha: 1, duration: 0.2 });
      }
      lastX = event.clientX;
      lastY = event.clientY;
      dotX(lastX);
      dotY(lastY);
      shapeX(lastX);
      shapeY(lastY);
      setHover(!!(event.target as Element | null)?.closest?.(INTERACTIVE));
    };
    // Smooth scrolling keeps sliding the page under a still pointer after the scroll event, so
    // re-check what the pointer is over a few times a second.
    let frame = 0;
    const recheck = () => {
      if (!seen || ++frame % 8) return;
      setHover(!!document.elementFromPoint(lastX, lastY)?.closest(INTERACTIVE));
    };
    const onDown = () => gsap.to(shape, { scale: 0.78, duration: 0.15, overwrite: "auto" });
    const onUp = () => gsap.to(shape, { scale: 1, duration: 0.4, ease: "back.out(2.5)", overwrite: "auto" });
    const onLeave = () => {
      seen = false;
      gsap.to(cursor, { autoAlpha: 0, duration: 0.2 });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown);
    gsap.ticker.add(recheck);
    window.addEventListener("pointerup", onUp);
    document.documentElement.addEventListener("pointerleave", onLeave);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      gsap.ticker.remove(recheck);
      window.removeEventListener("pointerup", onUp);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      root.removeAttribute("data-custom-cursor");
      gsap.killTweensOf([cursor, dot, shape]);
    };
  }, [rootRef]);
}
