"use client";

import { credits, licenceUrl } from "@/content/credits";
import { useLang, useT } from "@/state/lang";

/** Author, licence and source for every third-party asset. Shared by the room panel and the static page. */
export function CreditsList({ className }: { className?: string }) {
  const lang = useLang();
  const t = useT();
  return (
    <ul className={className}>
      {credits.map((c) => (
        <li key={c.url + c.title}>
          <a href={c.url} target="_blank" rel="noopener noreferrer">
            {c.title}
          </a>
          <div>
            {c.author} ·{" "}
            <a href={licenceUrl(c.licence)} target="_blank" rel="noopener noreferrer">
              {c.licence}
            </a>
          </div>
          {c.changes && (
            <div>
              {t("credits_changes")}: {c.changes[lang]}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
