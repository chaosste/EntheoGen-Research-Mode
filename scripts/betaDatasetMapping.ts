/**
 * Beta dataset (CSV / Supabase export) → EntheoGen app snapshot field mapping.
 * Fail-fast on unknown classification codes so bad imports surface immediately.
 */

export const BETA_CLASSIFICATION_TO_APP_CODE: Record<string, string> = {
  CAUTION: 'CAU',
  DANGEROUS: 'DAN',
  UNSAFE: 'UNS',
  LOW_MOD: 'LOW_MOD',
  SELF: 'SELF',
  THEORETICAL: 'THEORETICAL',
  INFERRED: 'INFERRED',
  DETERMINISTIC: 'DETERMINISTIC'
};

const BETA_RISK_LABEL_TO_APP_CODE: Array<{ pattern: RegExp; code: string }> = [
  { pattern: /dangerous|contraindicated/i, code: 'DAN' },
  { pattern: /unsafe|high risk/i, code: 'UNS' },
  { pattern: /caution|moderate risk/i, code: 'CAU' },
  { pattern: /theoretical/i, code: 'THEORETICAL' },
  { pattern: /inference|inferred/i, code: 'INFERRED' },
  { pattern: /deterministic|established interaction mapping/i, code: 'DETERMINISTIC' },
  { pattern: /effect modulation/i, code: 'LOW_MOD' },
  { pattern: /low risk/i, code: 'LOW' },
  { pattern: /same substance|same entity/i, code: 'SELF' },
  { pattern: /unknown|insufficient data|not applicable/i, code: 'UNK' }
];

export function mapBetaClassificationToAppCode(classificationCode: string): string {
  const key = classificationCode.trim();
  const mapped = BETA_CLASSIFICATION_TO_APP_CODE[key];
  if (!mapped) {
    throw new Error(
      `Unknown beta classification_code "${classificationCode}". ` +
        `Add a mapping in scripts/betaDatasetMapping.ts (known: ${Object.keys(BETA_CLASSIFICATION_TO_APP_CODE).join(', ')}).`
    );
  }
  return mapped;
}

export function mapBetaRiskLabelToAppCode(riskLabel: string): string {
  const label = riskLabel.trim();
  for (const candidate of BETA_RISK_LABEL_TO_APP_CODE) {
    if (candidate.pattern.test(label)) return candidate.code;
  }
  return 'UNK';
}

export function resolveBetaInteractionCode(
  classificationCode: string | undefined,
  riskLabel: string | undefined,
  isSelfPair: string | undefined
): string {
  if ((isSelfPair ?? '').trim().toUpperCase() === 'TRUE') {
    return 'SELF';
  }
  const code = (classificationCode ?? '').trim();
  if (code.length > 0) {
    return mapBetaClassificationToAppCode(code);
  }
  const label = (riskLabel ?? '').trim();
  if (label.length > 0) {
    return mapBetaRiskLabelToAppCode(label);
  }
  return 'UNK';
}

export function normalizeBetaConfidence(value: string): string {
  const v = value.trim().toLowerCase();
  if (v === 'not_applicable' || v === 'n/a') return 'n/a';
  return v;
}
