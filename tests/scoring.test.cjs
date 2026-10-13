const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const elements = new Map();
const context = vm.createContext({ window: {}, URL, Intl, Date, document: {
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, { innerHTML: '', hidden: true });
    return elements.get(id);
  }
} });
for (const name of ['config', 'api', 'scoring', 'ui']) {
  vm.runInContext(fs.readFileSync(`${__dirname}/../js/${name}.js`, 'utf8'), context);
}
const { CloudAppScoring: scoring, CloudAppApi: api, CloudAppUi: ui, CloudAppConfig: config } = context.window;
const windowRange = api.getNightWindow({ dateKey: '2026-10-13' });
function rowsFor(clearHours) {
  return Array.from({ length: 13 }, (_, index) => {
    const hour = (18 + index) % 24;
    const cloud = clearHours.includes(hour) ? 0 : 100;
    return { time: `${hour < 18 ? '2026-10-14' : '2026-10-13'}T${String(hour).padStart(2, '0')}:00`,
      cloud_cover: cloud, cloud_cover_low: cloud, cloud_cover_mid: cloud, cloud_cover_high: cloud,
      temperature_2m: 15, relative_humidity_2m: 50, dew_point_2m: 5, precipitation: 0 };
  });
}
function night(hours, transform = (models) => models) {
  const bundle = { models: transform(config.sources.map((source) => ({ source, rows: rowsFor(hours) }))) };
  return scoring.assessNight(api.buildNightForecasts(bundle, { dateKey: windowRange.dateKey }));
}
const allHours = [18,19,20,21,22,23,0,1,2,3,4,5];
test('same four clear hours: midnight outranks evening and dawn', () => {
  const midnight = night([23,0,1,2]);
  const evening = night([18,19,20,21]);
  const dawn = night([2,3,4,5]);
  assert(midnight.overallScore > evening.overallScore);
  assert(midnight.overallScore > dawn.overallScore);
  assert.equal(midnight.overallScore, 74);
  assert.equal(evening.overallScore, 12);
  console.log({ midnight: midnight.overallScore, evening: evening.overallScore, dawn: dawn.overallScore });
});
test('exact weight boundaries and 06:00 exclusion', () => {
  const assessed = night(allHours);
  assert.equal(assessed.hourlyConsensus.length, 12);
  assert.equal(assessed.overallScore, 100);
  assert.equal(assessed.recommendedWindow.end, windowRange.end);
  for (const [hour, expected] of [[18,.5],[20,.5],[21,1],[22,1],[23,4],[0,4],[2,4],[3,1],[4,.5],[5,.5]]) {
    assert.equal(scoring.getNightWeight(`2026-10-13T${String(hour).padStart(2,'0')}:00`), expected);
  }
});
test('recommendation prefers deep night over a longer evening range', () => {
  const assessed = night([18,19,20,21,23,0,1,2]);
  assert.equal(assessed.recommendedWindow.start, '2026-10-13T23:00');
  assert.equal(assessed.recommendedWindow.end, '2026-10-14T03:00');
});
test('transparency falls with high cloud, humidity and small dew spread', () => {
  const clear = rowsFor(allHours)[0];
  const hazy = { ...clear, relative_humidity_2m: 100, dew_point_2m: 15 };
  const thin = { ...clear, cloud_cover_high: 100 };
  assert.equal(scoring.estimateTransparency(clear), 100);
  for (const row of [hazy, thin]) {
    assert(scoring.estimateTransparency(row) < 100);
    assert(scoring.calculateCloudScore(row).score < scoring.calculateCloudScore(clear).score);
  }
  assert.equal(scoring.estimateTransparency({ ...clear, dew_point_2m: null }), null);
});
test('missing weather and missing core hours are not complete forecasts', () => {
  const missing = night(allHours, (models) => models.map((model) => ({ ...model,
    rows: model.rows.map((row) => row.time.endsWith('00:00') ? { ...row, precipitation: null } : row) })));
  assert.equal(missing.complete, false);
  assert.equal(missing.confidence.level, '低');
  assert.equal(missing.hourlyConsensus.find((row) => row.time.endsWith('00:00')).score, null);
  assert.equal(night(allHours, (models) => models.filter((m) => m.source.id !== 'jma')).complete, false);
  assert.equal(night(allHours, (models) => models.map((m) => ({ ...m, rows: m.rows.slice(0, 5) }))).complete, false);
});
test('no models stays unknown', () => {
  const assessed = night([], () => []);
  assert.equal(assessed.overallScore, null);
  assert.equal(assessed.transparency, null);
  assert.equal(assessed.complete, false);
});
const links = { astro: () => '#', scw: () => '#', gpv: () => '#' };
function render(items) {
  ui.renderLocationComparison(items, 'hikone', links);
  return elements.get('locationCompareCards').innerHTML;
}
test('recommendation excludes incomplete forecasts and shows tied winners', () => {
  const a = night([23,0,1,2]);
  const incomplete = night(allHours, (models) => models.filter((m) => m.source.id !== 'jma'));
  const html = render([
    { location: config.locations[2], assessment: incomplete },
    { location: config.locations[0], assessment: a },
    { location: config.locations[1], assessment: a }
  ]).split('</div>')[0];
  assert(html.includes('彦根市'));
  assert(html.includes('多賀町'));
  assert(!html.includes('米原市'));
  assert(html.includes('同点'));
  assert(html.includes('暫定順位'));
});
test('all poor or unavailable forecasts do not create a recommendation', () => {
  assert(render([{ location: config.locations[0], assessment: night([]) }]).includes('今回はおすすめ地点なし'));
  assert(render([]).includes('判定できません'));
  ui.clearLocationComparison();
  assert.equal(elements.get('locationCompare').hidden, true);
});
