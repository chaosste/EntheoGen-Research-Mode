import type { InteractionEvidence } from './drugData';

export const PRIORITY_INTERACTION_RULES: Record<string, InteractionEvidence> = {
  'beta_blockers|clonidine': {
    code: 'DETERMINISTIC',
    label: 'Established clinically significant interaction',
    summary: 'Risk of severe rebound hypertension if clonidine is withdrawn while beta-blockade is present.',
    confidence: 'high',
    sources: '',
    clinicalEffect: {
      primary: 'Risk of severe rebound hypertension if clonidine is withdrawn while beta-blockade is present',
      direction: 'hypertensive_rebound',
      severity: 'high'
    },
    mechanism: 'Clonidine withdrawal can cause sympathetic rebound; beta-blockade may worsen hypertensive response through unopposed alpha-adrenergic activity.',
    mechanismCategory: 'rebound_hypertension',
    mechanismCategories: ['hemodynamic_interaction', 'adrenergic_rebound', 'cardiovascular_load'],
    practicalGuidance:
      'Avoid abrupt clonidine discontinuation. If both are used, taper beta-blocker before tapering clonidine where clinically appropriate.',
    management: {
      recommendation:
        'Avoid abrupt clonidine discontinuation. If both are used, taper beta-blocker before tapering clonidine where clinically appropriate.',
      monitoring: ['blood_pressure', 'heart_rate', 'withdrawal_symptoms']
    },
    riskAssessment: {
      level: 'high',
      rationale:
        'Clonidine withdrawal can cause sympathetic rebound; beta-blockade may worsen hypertensive response through unopposed alpha-adrenergic activity.'
    },
    evidenceTier: 'established',
    fieldNotes: 'Preserved from deterministic mapping snippet; source_refs intentionally remain empty pending source linking.',
    provenance: {
      source: 'deterministic_mapping_table',
      confidenceTier: 'high',
      method: 'manual_clinical_rule_v1',
      rationale: 'Use the open deterministic mapping snippet as the source of truth for the clonidine plus beta-blocker interaction.'
    }
  },

  'calcium_channel_blockers|clonidine': {
    code: 'DETERMINISTIC',
    label: 'Predictable pharmacodynamic interaction',
    summary: 'Additive blood-pressure lowering with possible hypotension, dizziness, bradycardia, or syncope.',
    confidence: 'medium',
    sources: '',
    clinicalEffect: {
      primary: 'Additive blood-pressure lowering with possible hypotension, dizziness, bradycardia, or syncope',
      direction: 'hypotensive_additive',
      severity: 'moderate'
    },
    mechanism:
      'Clonidine reduces sympathetic outflow while calcium-channel blockers reduce vascular tone and/or cardiac conduction, producing predictable additive cardiovascular effects.',
    mechanismCategory: 'additive_hypotension',
    mechanismCategories: ['hemodynamic_interaction', 'additive_hypotension', 'cardiovascular_load'],
    practicalGuidance: 'Use with monitoring, especially during initiation or dose changes.',
    management: {
      recommendation: 'Use with monitoring, especially during initiation or dose changes.',
      monitoring: ['blood_pressure', 'heart_rate', 'orthostatic_symptoms', 'syncope']
    },
    riskAssessment: {
      level: 'moderate',
      rationale:
        'Clonidine reduces sympathetic outflow while calcium-channel blockers reduce vascular tone and/or cardiac conduction, producing predictable additive cardiovascular effects.'
    },
    evidenceTier: 'established',
    fieldNotes: 'Preserved from deterministic mapping snippet; source_refs intentionally remain empty pending source linking.',
    provenance: {
      source: 'deterministic_mapping_table',
      confidenceTier: 'medium',
      method: 'manual_clinical_rule_v1',
      rationale: 'Use the open deterministic mapping snippet as the source of truth for the clonidine plus calcium-channel blocker interaction.'
    }
  },

  'ketamine|ndri_bupropion': {
    code: 'UNK',
    summary: 'No direct outcome data exists, but both substances may lower seizure threshold under stress or excitation.',
    confidence: 'low',
    sources: 'source-gap',
    fieldNotes: 'Unknown but plausible risk',
    evidenceGaps: 'No case aggregation on combined seizure outcomes.',
    evidenceTier: 'decidable-by-case-data'
  },

  'ketamine|serotonergic_opioids': {
    code: 'UNK',
    summary: 'Limited data on combined effects on breathing and consciousness.',
    confidence: 'low',
    sources: 'source-gap',
    fieldNotes: 'Unknown but plausible risk',
    evidenceGaps: 'No respiratory outcome aggregation under co-use.',
    evidenceTier: 'decidable-by-case-data'
  },

  'kambo|ketamine': {
    code: 'UNK',
    summary: 'No data on combining intense physiological stress with dissociation.',
    confidence: 'low',
    sources: 'source-gap',
    fieldNotes: 'Unknown but plausible risk',
    evidenceGaps: 'No cardiovascular or aspiration outcome aggregation.',
    evidenceTier: 'decidable-by-case-data'
  },

  'kambo|ndri_bupropion': {
    code: 'UNK',
    summary: 'No data on compounded sympathetic stress and reduced seizure threshold.',
    confidence: 'low',
    sources: 'source-gap',
    fieldNotes: 'Unknown but plausible risk',
    evidenceGaps: 'Seizure and collapse outcomes not aggregated.',
    evidenceTier: 'decidable-by-case-data'
  },

  'serotonergic_opioids|tobacco_rape': {
    code: 'UNK',
    summary: 'No data on emetic/vagal responses combined with opioid sedation.',
    confidence: 'low',
    sources: 'source-gap',
    fieldNotes: 'Unknown but plausible risk',
    evidenceGaps: 'Aspiration and respiratory data absent.',
    evidenceTier: 'decidable-by-case-data'
  },

  'mdma_2cx_dox_nbome|ndri_bupropion': {
    code: 'UNK',
    summary: 'Insufficient data on combined monoaminergic load and seizure risk.',
    confidence: 'low',
    sources: 'source-gap',
    fieldNotes: 'Unknown but plausible risk',
    evidenceGaps: 'Hyperadrenergic and seizure events not aggregated.',
    evidenceTier: 'decidable-by-case-data'
  },

  'ketamine|mdma_2cx_dox_nbome': {
    code: 'UNK',
    summary: 'No systematic data on combining dissociation with strong serotonergic stimulation.',
    confidence: 'low',
    sources: 'source-gap',
    fieldNotes: 'Unknown but plausible risk',
    evidenceGaps: 'Injury and emergency-intervention data absent.',
    evidenceTier: 'decidable-by-case-data'
  },

  'ketamine|psilocybin': {
    code: 'UNK',
    summary: 'Limited data on combined psychological and autonomic effects.',
    confidence: 'low',
    sources: 'source-gap',
    fieldNotes: 'Unknown but plausible risk',
    evidenceGaps: 'Psychological destabilization outcomes not aggregated.',
    evidenceTier: 'decidable-by-case-data'
  },

  'beta_blockers_ccb|psilocybin': {
    code: 'UNK',
    summary: 'Little data on hemodynamic effects when cardiovascular response is pharmacologically blunted.',
    confidence: 'low',
    sources: 'source-gap',
    fieldNotes: 'Unknown but plausible risk',
    evidenceGaps: 'Hypotension and syncope outcomes absent.',
    evidenceTier: 'decidable-by-case-data'
  },

  'clonidine_guanfacine|psilocybin': {
    code: 'UNK',
    summary: 'No data on altered states combined with central sympathetic suppression.',
    confidence: 'low',
    sources: 'source-gap',
    fieldNotes: 'Unknown but plausible risk',
    evidenceGaps: 'Autonomic instability outcomes not aggregated.',
    evidenceTier: 'decidable-by-case-data'
  }
};
