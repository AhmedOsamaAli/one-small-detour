import test from 'node:test';
import assert from 'node:assert/strict';
import { BIOME_ORDER } from '../shared/biomes.ts';
import { islandOutline, landscapeVignettes, mapMetrics, mapNodePosition } from './adventureMapLayout.ts';

test('desktop cottages grow with their map while phone houses stay compact and whole rows have room', () => {
  const phone = mapMetrics(348), desktop = mapMetrics(1160);
  assert.equal(phone.stopScale, 1);
  assert.ok(desktop.stopScale >= 1.4);
  assert.ok(desktop.rowGap < 200);
  for (const width of [206, 276, 348, 560, 840, 1160, 1440]) {
    const metrics = mapMetrics(width);
    for (let index = 0; index < 218; index++) {
      const point = mapNodePosition(index, metrics);
      assert.ok(point.x - 30 * metrics.stopScale >= 3);
      assert.ok(point.x + 30 * metrics.stopScale <= width - 3);
    }
    assert.ok(metrics.topInset >= 35 * metrics.stopScale + 9);
    assert.ok(metrics.bottomInset >= 35 * metrics.stopScale + 25);
  }
});

test('seasonal scenery leaves room for cottage art, addresses and a separate earned-star row', () => {
  for (const width of [206, 276, 348, 560, 840, 1160]) {
    const metrics = mapMetrics(width);
    for (const [index, theme] of BIOME_ORDER.entries()) {
      const art = landscapeVignettes(theme, index, 20, metrics);
      if (width >= 348) assert.ok(art.length >= 3, `${theme}/${width}: missing landscape detail`);
      for (const vignette of art) {
        assert.ok(vignette.x - vignette.width / 2 >= 0);
        assert.ok(vignette.x + vignette.width / 2 <= width);
        for (let stop = 0; stop < 20; stop++) {
          const point = mapNodePosition(index * 20 + stop, metrics), y = point.y - index * 9.2 * metrics.rowGap;
          assert.ok(Math.abs(point.x - vignette.x) > vignette.width / 2 + 27 * metrics.stopScale + 5 ||
            vignette.y + vignette.height / 2 < y - 35 * metrics.stopScale - 7 ||
            vignette.y - vignette.height / 2 > y + metrics.bottomInset, `${theme}/${width}: scenery obscures stop ${stop + 1}`);
        }
      }
    }
  }
});

test('later islands have different shorelines and landscape arrangements rather than copied chapter art', () => {
  const metrics = mapMetrics(940);
  assert.notEqual(islandOutline(940, 900, 0), islandOutline(940, 900, 8));
  assert.notDeepEqual(landscapeVignettes('meadow', 0, 20, metrics), landscapeVignettes('meadow', 8, 20, metrics));
  assert.equal(landscapeVignettes('coast', 1, 18, metrics).filter((art) => art.kind === 'lighthouse').length, 1);
});
