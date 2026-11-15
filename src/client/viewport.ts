export function viewportSize(): { width: number; height: number } {
  const visual = window.visualViewport;
  const height = visual && visual.scale === 1 && visual.height > 0
    ? Math.min(window.innerHeight, visual.height) : window.innerHeight;
  return { width: window.innerWidth, height: Math.floor(height) };
}

export function trackViewport(): () => void {
  // CSS owns normal resizing; pixels only cap a genuinely occluded visual viewport.
  document.documentElement.style.removeProperty('--app-height');
  const update = (): void => {
    const { height } = viewportSize();
    if (height < window.innerHeight) document.documentElement.style.setProperty('--visual-height', `${height}px`);
    else document.documentElement.style.removeProperty('--visual-height');
    document.documentElement.toggleAttribute('data-compact-height', height <= 740);
  };
  window.addEventListener('resize', update);
  window.visualViewport?.addEventListener('resize', update);
  window.visualViewport?.addEventListener('scroll', update);
  update();
  return () => {
    window.removeEventListener('resize', update);
    window.visualViewport?.removeEventListener('resize', update);
    window.visualViewport?.removeEventListener('scroll', update);
  };
}
