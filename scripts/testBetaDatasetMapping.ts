import assert from 'node:assert/strict';

import {
  BETA_CLASSIFICATION_TO_APP_CODE,
  mapBetaClassificationToAppCode,
  mapBetaRiskLabelToAppCode,
  resolveBetaInteractionCode,
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
assert.equal(mapBetaRiskLabelToAppCode('Theoretical interaction'), 'THEORETICAL');
assert.equal(mapBetaRiskLabelToAppCode('Caution / Moderate Risk'), 'CAU');
assert.equal(mapBetaRiskLabelToAppCode('Unknown / insufficient data'), 'UNK');
assert.equal(resolveBetaInteractionCode(undefined, 'Dangerous / contraindicated', 'false'), 'DAN');
assert.equal(resolveBetaInteractionCode(undefined, 'Theoretical interaction', 'false'), 'THEORETICAL');
assert.equal(resolveBetaInteractionCode(undefined, undefined, 'TRUE'), 'SELF');
assert.equal(resolveBetaInteractionCode(undefined, undefined, undefined), 'UNK');

assert.equal(normalizeBetaConfidence('not_applicable'), 'n/a');
assert.equal(normalizeBetaConfidence('N/A'), 'n/a');
assert.equal(normalizeBetaConfidence('high'), 'high');

console.log('betaDatasetMapping assertions passed.');
