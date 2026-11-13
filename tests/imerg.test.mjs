import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseImergPoint, compareImergToPower } from '../src/lib/nasa/gpm.ts';

describe('GPM IMERG helpers', () => {
  it('parses the OPeNDAP csv point response', () => {
    const text = 'Dataset: x.nc4 precipitation.lat, 23.85 precipitation.precipitation[precipitation.time=17111][precipitation.lon=90.45], 5.445';
    assert.equal(parseImergPoint(text), 5.445);
  });

  it('treats fill values and garbage as missing', () => {
    assert.ok(Number.isNaN(parseImergPoint('precipitation.precipitation[a][b], -9999.9')));
    assert.ok(Number.isNaN(parseImergPoint('Dataset: ERROR status, 403')));
  });

  it('compares IMERG with POWER on shared days only', () => {
    const dates = ['20260101', '20260102', '20260103', '20260104', '20260105', '20260106'];
    const gpm = { dates, precipitation: [2, 2, 2, 2, 2, NaN] };
    const power = { series: { dates, prectotcorr: [1, 1, 1, 1, 1, 5] } };
    const c = compareImergToPower(gpm, power);
    assert.equal(c.days, 5);
    assert.equal(c.imergMm, 10);
    assert.equal(c.powerMm, 5);
    assert.equal(c.differencePct, 100);
  });
});
