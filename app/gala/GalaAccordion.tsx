"use client";

import { useEffect } from "react";

/**
 * Wires the FAQ accordion on the server-rendered gala markup.
 *
 * The page ships every answer in the DOM and this collapses them on
 * mount, rather than hiding them behind a conditional the server has to
 * resolve. The answers are therefore present for search engines and for
 * anyone whose JavaScript never arrives, and the accordion is an
 * enhancement rather than a requirement.
 */
export default function GalaAccordion() {
  useEffect(() => {
    const root = document.getElementById("gala-content");
    if (root === null) return;

    const buttons = Array.from(root.querySelectorAll("button")).filter((b) => {
      const sib = b.nextElementSibling;
      return sib !== null && sib.tagName === "P";
    });

    const cleanups: Array<() => void> = [];

    buttons.forEach((btn) => {
      const answer = btn.nextElementSibling as HTMLElement | null;
      if (answer === null) return;

      const sign = btn.querySelector("span:last-child");
      answer.style.display = "none";
      if (sign) sign.textContent = "+";
      btn.setAttribute("aria-expanded", "false");

      const onClick = () => {
        const shut = answer.style.display === "none";
        answer.style.display = shut ? "block" : "none";
        if (sign) sign.textContent = shut ? "\u2212" : "+";
        btn.setAttribute("aria-expanded", shut ? "true" : "false");
      };

      btn.addEventListener("click", onClick);
      cleanups.push(() => btn.removeEventListener("click", onClick));
    });

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
