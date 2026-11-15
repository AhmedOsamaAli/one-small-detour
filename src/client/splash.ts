import { requestExpandedMode } from '@devvit/web/client';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/fraunces/full.css';
import { loadPreferences, PREF_KEY, resolveAppearance } from './preferences.ts';
import { worldCssVariables } from './worldTheme.ts';
import { HOME_GLYPHS, HOME_PLAQUE_PATH, HOME_SPROUT_PATH } from './homeLetter.ts';
import { isAnchor } from '../shared/rules.ts';

const button = document.getElementById('open-game');
const errorText = document.getElementById('preview-error');
const preview = document.querySelector<HTMLElement>('.preview-shell');
if (!(button instanceof HTMLButtonElement) || !errorText || !preview) throw new Error('The preview controls are missing.');

document.querySelectorAll<SVGSVGElement>('svg[data-home-letter]').forEach((mark) => {
  const anchor = mark.dataset['homeLetter'];
  if (!isAnchor(anchor)) throw new Error('The preview home is missing its letter.');
  for (const [index, outline] of [HOME_PLAQUE_PATH, HOME_GLYPHS[anchor], HOME_SPROUT_PATH].entries()) {
    const part = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    part.setAttribute('d', outline);
    part.setAttribute('fill', index === 0 ? 'var(--world-home-badge)' : 'currentColor');
    if (index === 0) { part.setAttribute('stroke', 'currentColor'); part.setAttribute('stroke-width', '1.25'); }
    if (index === 1) part.setAttribute('fill-rule', 'evenodd');
    mark.append(part);
  }
});

let savedAppearance = loadPreferences();
const updateAppearance = (): void => {
  const appearance = resolveAppearance(savedAppearance.value.appearance);
  document.documentElement.dataset['appearance'] = appearance;
  for (const [name, value] of Object.entries(worldCssVariables('meadow', appearance === 'dark'))) {
    if (typeof value === 'string') document.documentElement.style.setProperty(name, value);
  }
};
if (savedAppearance.warning) errorText.textContent = savedAppearance.warning;
window.addEventListener('storage', (event) => {
  if (event.key !== PREF_KEY && event.key !== null) return;
  savedAppearance = loadPreferences();
  if (savedAppearance.warning) errorText.textContent = savedAppearance.warning;
  updateAppearance();
});
updateAppearance();

let inView = true;
const updateVisibility = (): void => {
  const paused = document.hidden || !inView;
  document.documentElement.classList.toggle('preview-paused', paused);
  preview.dataset['animation'] = paused ? 'paused' : 'playing';
};
document.addEventListener('visibilitychange', updateVisibility);
if (typeof IntersectionObserver !== 'undefined') {
  const observer = new IntersectionObserver((entries) => {
    const entry = entries[0];
    if (entry) { inView = entry.isIntersecting; updateVisibility(); }
  });
  observer.observe(preview);
}
updateVisibility();

button.addEventListener('click', (event) => {
  errorText.textContent = '';
  if (import.meta.env.DEV) {
    window.location.href = './index.html';
    return;
  }
  try {
    requestExpandedMode(event, 'game');
  } catch (error) {
    console.error('The expanded Detour could not open:', error);
    errorText.textContent = 'Could not open. Try the Reddit app or reload this post.';
  }
});
