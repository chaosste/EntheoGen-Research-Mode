import { normalizeInteraction } from '../src/data/uiInteractions';
import { bootstrapDrugDatasetFromRepo } from './bootstrapDrugDatasetFromRepo';

bootstrapDrugDatasetFromRepo();

const SELF_DISPLAY = 'Same substance / not an interaction';

type TestCase = {
  name: string;
  row: Record<string, unknown>;
  check: (result: ReturnType<typeof normalizeInteraction>) => void;
};

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const nonBlank = (value: string) => value.trim().length > 0;

const cases: TestCase[] = [
  {
    name: 'valid scored interaction',
    row: {
      substance_a_id: 'ayahuasca',
      substance_b_id: 'psilocybin',
      pair_key: 'ayahuasca|psilocybin',
      interaction_code: 'CAU',
      interaction_label: 'Caution / Moderate Risk',
      risk_scale: 3,
      summary: 'Moderate risk with overlap.',
      confidence: 'medium',
      mechanism_category: 'serotonergic_toxicity',
      field_notes: 'Use caution.'
    },
    check: (result) => {
      assert(result.riskScore === 3, 'expected numeric riskScore');
      assert(result.riskDisplayLabel.toLowerCase() !== 'unknown', 'riskDisplayLabel should be friendly');
      assert(nonBlank(result.mechanismDisplayLabel), 'mechanismDisplayLabel should not be blank');
      assert(result.raw !== null, 'raw row should remain attached');
    }
  },
  {
    name: 'unknown/null risk',
    row: {
      substance_a_id: 'ayahuasca',
      substance_b_id: 'lsd',
      pair_key: 'ayahuasca|lsd',
      interaction_code: 'unknown',
      interaction_label: null,
      risk_scale: null,
      summary: 'Unknown risk.',
      confidence: 'medium',
      mechanism_category: 'unknown'
    },
    check: (result) => {
      assert(result.riskScore === null, 'riskScore should be null when not numeric');
      assert(result.riskDisplayLabel === 'Unknown / insufficient data', 'riskDisplayLabel should be friendly unknown');
    }
  },
  {
    name: 'not_applicable risk',
    row: {
      substance_a_id: 'ayahuasca',
      substance_b_id: 'nn_dmt',
      pair_key: 'ayahuasca|nn_dmt',
      interaction_code: 'not_applicable',
      interaction_label: '',
      risk_scale: null,
      summary: 'Not applicable in source.',
      confidence: 'medium',
      mechanism_category: 'unknown'
    },
    check: (result) => {
      assert(result.riskDisplayLabel === 'Unknown / insufficient data', 'not_applicable should map to friendly unknown');
    }
  },
  {
    name: 'blank mechanism',
    row: {
      substance_a_id: 'ayahuasca',
      substance_b_id: 'snri',
      pair_key: 'ayahuasca|snri',
      interaction_code: 'DAN',
      interaction_label: 'Dangerous',
      risk_scale: 5,
      summary: 'High risk pairing.',
      confidence: 'high',
      mechanism_category: ' '
    },
    check: (result) => {
      assert(result.mechanismDisplayLabel === 'Unknown', 'blank mechanism should become friendly Unknown');
    }
  },
  {
    name: 'unknown confidence',
    row: {
      substance_a_id: 'psilocybin',
      substance_b_id: 'ssri',
      pair_key: 'psilocybin|ssri',
      interaction_code: 'LOW_MOD',
      interaction_label: 'Low risk modulation',
      risk_scale: 2,
      summary: 'May blunt effects.',
      confidence: 'unknown',
      mechanism_category: 'serotonergic'
    },
    check: (result) => {
      assert(result.confidenceLabel === 'Unknown', 'unknown confidence should normalize to Unknown');
    }
  },
  {
    name: 'self-pair',
    row: {
      substance_a_id: 'ayahuasca',
      substance_b_id: 'ayahuasca',
      pair_key: 'ayahuasca|ayahuasca',
      interaction_code: 'SELF',
      interaction_label: 'same',
      risk_scale: -1,
      summary: 'self',
      confidence: 'n/a',
      mechanism_category: 'unknown'
    },
    check: (result) => {
      assert(result.isSelfPair, 'should be marked self-pair');
      assert(result.riskDisplayLabel === SELF_DISPLAY, 'self-pair label should match required display');
      assert(result.mechanismDisplayLabel === SELF_DISPLAY, 'self-pair mechanism label should match required display');
    }
  },
  {
    name: 'old row shape',
    row: {
      substance_a_id: 'ayahuasca',
      substance_b_id: 'maoi_pharma',
      pair_key: 'ayahuasca|maoi_pharma',
      interaction_code: 'DAN',
      interaction_label: 'Dangerous / Contraindicated',
      risk_scale: 5,
      summary: 'Contraindicated.',
      confidence: 'high',
      mechanism_category: 'maoi'
    },
    check: (result) => {
      assert(result.id === 'ayahuasca|maoi_pharma', 'old shape id should be preserved');
      assert(result.raw !== null, 'old shape raw should remain attached');
    }
  },
  {
    name: 'new row shape',
    row: {
      key: 'ayahuasca|ketamine',
      substances: ['ayahuasca', 'ketamine'],
      classification: {
        code: 'UNS',
        label: 'Unsafe / High Risk',
        risk_score: 4,
        confidence: 'low'
      },
      mechanism: {
        primary_category: 'glutamate_modulation'
      },
      clinical_summary: {
        headline: 'Operationally unsafe overlap.',
        field_notes: 'Monitor airway and sedation risk.'
      }
    },
    check: (result) => {
      assert(result.id === 'ayahuasca|ketamine', 'new shape key should map to id');
      assert(result.riskScore === 4, 'new shape risk score should map');
      assert(result.headline === 'Operationally unsafe overlap.', 'new shape headline should map');
      assert(result.raw !== null, 'new shape raw should remain attached');
    }
  },
  {
    name: 'beta THEORETICAL code',
    row: {
      substance_a_id: 'a',
      substance_b_id: 'b',
      pair_key: 'a|b',
      interaction_code: 'THEORETICAL',
      interaction_label: 'Theoretical / Moderate Risk',
      risk_scale: 2,
      summary: 'Class-level pharmacology only.',
      confidence: 'low',
      mechanism_category: 'unknown'
    },
    check: (result) => {
      assert(result.riskLabel === 'THEORETICAL', 'riskLabel preserves beta code');
      assert(result.riskDisplayLabel === 'Theoretical interaction', 'friendly theoretical label');
    }
  },
  {
    name: 'beta DETERMINISTIC code',
    row: {
      substance_a_id: 'a',
      substance_b_id: 'b',
      pair_key: 'a|b',
      interaction_code: 'DETERMINISTIC',
      interaction_label: '',
      risk_scale: 3,
      summary: 'Rule-based row.',
      confidence: 'high',
      mechanism_category: 'serotonergic'
    },
    check: (result) => {
      assert(result.riskLabel === 'DETERMINISTIC', 'riskLabel preserves deterministic code');
      assert(result.riskDisplayLabel === 'Established interaction mapping', 'friendly deterministic label');
    }
  },
  {
    name: 'beta confidence not_applicable string',
    row: {
      substance_a_id: 'a',
      substance_b_id: 'b',
      pair_key: 'a|b',
      interaction_code: 'CAU',
      interaction_label: 'Caution',
      risk_scale: 3,
      summary: 'Caution row.',
      confidence: 'not_applicable',
      mechanism_category: 'maoi'
    },
    check: (result) => {
      assert(result.confidenceLabel === 'Unknown', 'not_applicable confidence normalizes like n/a');
    }
  },
  {
    name: 'nullable risk_score with INFERRED',
    row: {
      substance_a_id: 'a',
      substance_b_id: 'b',
      pair_key: 'a|b',
      interaction_code: 'INFERRED',
      interaction_label: 'Inferred',
      risk_scale: null,
      summary: 'Inferred without numeric score.',
      confidence: 'medium',
      mechanism_category: 'unknown'
    },
    check: (result) => {
      assert(result.riskScore === null, 'null risk_scale yields null riskScore');
      assert(result.riskDisplayLabel === 'Mechanistic inference', 'INFERRED display label');
    }
  }
];

for (const testCase of cases) {
  const result = normalizeInteraction(testCase.row);
  assert(nonBlank(result.riskDisplayLabel), `${testCase.name}: riskDisplayLabel must not be blank`);
  assert(nonBlank(result.mechanismDisplayLabel), `${testCase.name}: mechanismDisplayLabel must not be blank`);
  testCase.check(result);
}

console.log(`uiInteractions adapter assertions passed (${cases.length} cases).`);
