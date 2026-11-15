import { requestExpandedMode } from '@devvit/web/client';

const button = document.getElementById('open-game');
const errorText = document.getElementById('preview-error');
button?.addEventListener('click', (event) => {
  if (import.meta.env.DEV) {
    window.location.href = './index.html';
    return;
  }
  try {
    requestExpandedMode(event, 'game');
  } catch (error) {
    console.error('The expanded Detour could not open:', error);
    if (errorText) errorText.textContent = 'The island could not open. Please try this post in the Reddit app or refresh it.';
  }
});
