import assert from 'node:assert/strict';

import {
  BETA_CLASSIFICATION_TO_APP_CODE,
  mapBetaClassificationToAppCode,
  normalizeBetaConfidence
} from './betaDatasetMapping';

for (const code of Object.keys(BETA_CLASSIFICATION_TO_APP_CODE)) {
  assert.equal(
    mapBetaClassificationToAppCode(code),
    BETA_CLASSIFICATION_TO_APP_CODE[code],
    `round-trip mapping for ${code}`
  );
}

assert.throws(() => mapBetaClassificationToAppCode('UNKNOWN_BETA_CODE'), /Unknown beta classification_code/);

assert.equal(normalizeBetaConfidence('not_applicable'), 'n/a');
assert.equal(normalizeBetaConfidence('N/A'), 'n/a');
assert.equal(normalizeBetaConfidence('high'), 'high');

console.log('betaDatasetMapping assertions passed.');
