import { DEFAULT_PALETTE, getPalette, getColors, type ThemeMode } from './palettes';
export type Theme = ThemeMode;
const media = window.matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set<() => void>();
export function getSavedTheme(): Theme {
 const value = localStorage.getItem('splitit:theme');
 return value === 'light' || value === 'dark' ? value : 'system';
}
export function getSavedPalette() { return getPalette(localStorage.getItem('splitit:palette') || DEFAULT_PALETTE).id; }
export function getThemeSnapshot() { return `${getSavedPalette()}:${getSavedTheme()}:${media.matches}`; }
export function subscribeTheme(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function currentColors() { return getColors(getSavedPalette(), getSavedTheme() === 'dark' || getSavedTheme() === 'system' && media.matches); }
function renderTheme() {
 const c = currentColors(), el = document.documentElement;
 el.dataset.theme = getSavedTheme() === 'dark' || getSavedTheme() === 'system' && media.matches ? 'dark' : 'light';
 el.dataset.palette = getSavedPalette();
 el.style.colorScheme = el.dataset.theme;
 // Old asynchronous stylesheet could otherwise overwrite the selected palette.
 document.getElementById('splitit-dark-theme')?.remove();
 const vars: Record<string,string> = {
 'page-bg':c.bg, surface:c.bg, 'panel-bg':c.card, 'surface-solid':c.card, 'panel-alt':c.bg,
 black:c.ink, gray:c.muted, line:c.line, accent:c.accent, hero:c.hero, tint:c.tint,
 mint:c.tint, 'surface-hover':c.tint, 'mint-strong':c.tint,
 'green-950':c.ink, 'green-900':c.accent, 'green-800':c.hero, 'green-700':c.accent, 'green-500':c.accent,
 'on-accent':c.onAccent, danger:c.danger, 'danger-tint':c.dangerTint, debt:c.debt,
 'debt-tint':c.debtTint, success:c.success, 'success-tint':c.successTint,
 info:c.info, 'info-tint':c.infoTint, peach:c.peach, 'peach-ink':c.peachInk, lavender:c.lavender, rose:c.rose,
 };
 Object.entries(vars).forEach(([key,value]) => el.style.setProperty('--'+key,value));
 listeners.forEach(listener => listener());
}
export function applyTheme(theme: Theme) { localStorage.setItem('splitit:theme',theme); renderTheme(); }
export function applyPalette(id: string) { localStorage.setItem('splitit:palette',getPalette(id).id); renderTheme(); }
media.addEventListener('change',renderTheme);
window.addEventListener('storage', e => { if (!e.key || e.key === 'splitit:theme' || e.key === 'splitit:palette') renderTheme(); });
renderTheme();
