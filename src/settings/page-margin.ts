/**
 * How much empty space the editor leaves on either side of the text. The
 * levels are applied as a `data-page-margin` attribute on `<html>` rather than
 * inline styles: the padding lives in three places (the scroll container, the
 * WYSIWYG surface, the source editor) and Crepe re-creates the WYSIWYG surface
 * whenever the view mode changes, so an attribute the stylesheet keys off
 * survives what inline styles would not.
 */

export const PAGE_MARGINS = ['normal', 'narrow', 'none'] as const;

export type PageMargin = (typeof PAGE_MARGINS)[number];

const STORAGE_KEY = 'page-margin';

/** What the editor looked like before the setting existed. */
const DEFAULT_MARGIN: PageMargin = 'normal';

/** Anything unrecognised — a hand-edited localStorage entry, a level dropped in
 *  a later version — falls back to the default rather than styling nothing. */
export function toPageMargin(value: string | null): PageMargin {
  return PAGE_MARGINS.find((margin) => margin === value) ?? DEFAULT_MARGIN;
}

export function getPageMargin(): PageMargin {
  return toPageMargin(localStorage.getItem(STORAGE_KEY));
}

export function savePageMargin(margin: PageMargin): void {
  localStorage.setItem(STORAGE_KEY, margin);
  applyPageMargin(margin);
}

export function applyPageMargin(margin: PageMargin = getPageMargin()): void {
  document.documentElement.setAttribute('data-page-margin', margin);
}
