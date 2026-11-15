import { requestExpandedMode } from '@devvit/web/client';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/fraunces';
import { loadPreferences, PREF_KEY, resolveAppearance } from './preferences.ts';

const button = document.getElementById('open-game');
const errorText = document.getElementById('preview-error');
const preview = document.querySelector<HTMLElement>('.preview-shell');
if (!(button instanceof HTMLButtonElement) || !errorText || !preview) throw new Error('The preview controls are missing.');

const deviceTheme = window.matchMedia('(prefers-color-scheme: dark)');
let savedAppearance = loadPreferences();
const updateAppearance = (): void => {
  document.documentElement.dataset['appearance'] = resolveAppearance(savedAppearance.value.appearance, deviceTheme.matches);
};
if (savedAppearance.warning) errorText.textContent = savedAppearance.warning;
deviceTheme.addEventListener('change', updateAppearance);
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
