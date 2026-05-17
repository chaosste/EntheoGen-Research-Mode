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

export function normalizeBetaConfidence(value: string): string {
  const v = value.trim().toLowerCase();
  if (v === 'not_applicable' || v === 'n/a') return 'n/a';
  return v;
}
