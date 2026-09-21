import { cookies } from "next/headers";
import { LOCALE_COOKIE, htmlDir, htmlLang, normalizeLocale, t, type AppLocale } from "@/lib/i18n";
import { setAppLocale } from "@/app/actions/locale";

export async function readLocale(): Promise<AppLocale> {
  const jar = await cookies();
  return normalizeLocale(jar.get(LOCALE_COOKIE)?.value);
}

export async function LocaleToggle({ nextPath = "/salesman" }: { nextPath?: string }) {
  const locale = await readLocale();
  const nextLocale: AppLocale = locale === "ar" ? "en" : "ar";
  return (
    <form action={setAppLocale} className="inline">
      <input type="hidden" name="locale" value={nextLocale} />
      <input type="hidden" name="next" value={nextPath} />
      <button type="submit" className="ui-nav-link" aria-label={t(locale, "localeToggle")}>
        {t(locale, "localeToggle")}
      </button>
    </form>
  );
}

export { htmlDir, htmlLang, t };
