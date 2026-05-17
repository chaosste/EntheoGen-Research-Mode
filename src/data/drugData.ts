import { getAppDatasetRegistry } from './datasetRegistry';
import { PRIORITY_INTERACTION_RULES } from './priorityInteractionOverrides';

export interface Drug {
  id: string;
  name: string;
  class: string;
  mechanismTag: string;
  notes: string;
  deprecated?: boolean;
  supersededBy?: string[];
}

export interface InteractionMetadata {
  label: string;
  symbol: string;
  color: string;
  description: string;
  riskScale: number;
}

export interface InteractionEvidence {
  code: string;
  label?: string;
  summary: string;
  confidence: string;
  sources: string;
  clinicalEffect?: {
    primary: string;
    direction: string;
    severity: string;
  };
  mechanism?: string;
  mechanismCategory?: MechanismCategory;
  mechanismCategories?: MechanismCategory[];
  practicalGuidance?: string;
  management?: {
    recommendation: string;
    monitoring: string[];
  };
  timing?: string;
  evidenceGaps?: string;
  evidenceTier?: string;
  fieldNotes?: string;
  riskAssessment?: {
    level: 'undetermined' | 'provisional_low' | 'provisional_moderate' | 'low' | 'moderate' | 'high';
    rationale?: string;
  };
  provenance?: {
    source: 'deterministic_mapping_table' | 'heuristic_fallback' | 'self_pair' | 'decomposition' | 'mechanistic_inference';
    confidenceTier: 'high' | 'medium' | 'low';
    method?: string;
    rationale?: string;
    parentNode?: string;
    parentNodes?: string[];
    deprecated?: boolean;
  };
}

export type RuleOrigin = 'self' | 'explicit' | 'fallback' | 'unknown';

export type MechanismCategory =
  | 'serotonergic'
  | 'serotonergic_toxicity'
  | 'maoi'
  | 'maoi_potentiation'
  | 'qt_prolongation'
  | 'qt_or_arrhythmia_risk'
  | 'sympathomimetic'
  | 'sympathomimetic_load'
  | 'cns_depressant'
  | 'pharmacodynamic_cns_depression'
  | 'cardiovascular_load'
  | 'hemodynamic_interaction'
  | 'anticholinergic'
  | 'anticholinergic_delirium'
  | 'dopaminergic'
  | 'dopaminergic_load'
  | 'glutamatergic'
  | 'glutamatergic_dissociation'
  | 'glutamate_modulation'
  | 'gabaergic'
  | 'gabaergic_modulation'
  | 'stimulant_stack'
  | 'psychedelic_potentiation'
  | 'psychedelic_intensification'
  | 'seizure_threshold'
  | 'noradrenergic_suppression'
  | 'adrenergic_rebound'
  | 'rebound_hypertension'
  | 'additive_hypotension'
  | 'respiratory_depression'
  | 'dehydration_or_electrolyte_risk'
  | 'psychiatric_destabilization'
  | 'ion_channel_modulation'
  | 'operational_or_behavioral_risk'
  | 'unknown';

export interface ResolvedInteraction {
  evidence: InteractionEvidence;
  origin: RuleOrigin;
  pairKey: string;
}

export function classifyMechanismCategory(
  mechanism?: string
): MechanismCategory {
  if (!mechanism) {
    return 'unknown';
  }
  const normalizedMechanism = mechanism.toLowerCase();

  if (normalizedMechanism.includes('serotonin')) {
    return 'serotonergic';
  }

  if (normalizedMechanism.includes('maoi')) {
    return 'maoi';
  }

  if (normalizedMechanism.includes('qt')) {
    return 'qt_prolongation';
  }

  if (normalizedMechanism.includes('sympathomimetic')) {
    return 'sympathomimetic';
  }

  if (normalizedMechanism.includes('cns depressant')) {
    return 'cns_depressant';
  }

  if (normalizedMechanism.includes('cns depression') || normalizedMechanism.includes('sedative')) {
    return 'pharmacodynamic_cns_depression';
  }

  if (normalizedMechanism.includes('anticholinergic')) {
    return 'anticholinergic';
  }

  if (normalizedMechanism.includes('dopamine')) {
    return 'dopaminergic';
  }

  if (normalizedMechanism.includes('glutamate')) {
    return 'glutamatergic';
  }

  if (normalizedMechanism.includes('nmda') || normalizedMechanism.includes('glutamate modulation')) {
    return 'glutamate_modulation';
  }

  if (normalizedMechanism.includes('gaba')) {
    return 'gabaergic';
  }

  if (normalizedMechanism.includes('stimulant')) {
    return 'stimulant_stack';
  }

  if (
    normalizedMechanism.includes('potentiation') &&
    normalizedMechanism.includes('psychedelic')
  ) {
    return 'psychedelic_potentiation';
  }

  if (
    normalizedMechanism.includes('cardio') ||
    normalizedMechanism.includes('hypertension')
  ) {
    return 'cardiovascular_load';
  }

  if (
    normalizedMechanism.includes('hemodynamic') ||
    normalizedMechanism.includes('blood pressure') ||
    normalizedMechanism.includes('heart rate')
  ) {
    return 'hemodynamic_interaction';
  }

  if (normalizedMechanism.includes('alpha-2') || normalizedMechanism.includes('alpha 2')) {
    return 'noradrenergic_suppression';
  }

  if (normalizedMechanism.includes('ion channel') || normalizedMechanism.includes('sodium-channel')) {
    return 'ion_channel_modulation';
  }

  return 'unknown';
}

/** Substance list from loaded app dataset (`registerAppDataset` / `/dataset/`). */
export function getDRUGS(): Drug[] {
  return getAppDatasetRegistry().drugs;
}

export const LEGEND: Record<string, InteractionMetadata> = {
  LOW: {
    label: 'Low Risk',
    symbol: 'CIRCLE',
    color: '#1C8AD1',
    description: 'Generally low physiologic interaction risk in source context.',
    riskScale: 1
  },
  LOW_MOD: {
    label: 'Low Risk, Effect Modulation',
    symbol: 'DOWN',
    color: '#3EA5E6',
    description: 'Low acute risk, but may blunt/decrease/increase subjective effects.',
    riskScale: 2
  },
  CAU: {
    label: 'Caution / Moderate Risk',
    symbol: 'WARN',
    color: '#D7CA25',
    description: 'Meaningful interaction risk; monitor and/or avoid unless supervised.',
    riskScale: 3
  },
  UNS: {
    label: 'Unsafe / High Risk',
    symbol: 'HEART',
    color: '#DD8B28',
    description: 'High adverse-event risk; generally avoid.',
    riskScale: 4
  },
  DAN: {
    label: 'Dangerous / Contraindicated',
    symbol: 'X',
    color: '#E21B2B',
    description: 'Potentially severe or life-threatening interaction risk; avoid.',
    riskScale: 5
  },
  UNK: {
    label: 'Unknown/Insufficient Data',
    symbol: 'INFO',
    color: '#6C757D',
    description: 'No explicit classification in the current curated interaction dataset.',
    riskScale: 0
  },
  INFERRED: {
    label: 'Mechanistic Inference',
    symbol: 'INFO',
    color: '#8F9AA7',
    description: 'Fallback classification inferred from class-level pharmacology when no deterministic mapping is available.',
    riskScale: 2
  },
  THEORETICAL: {
    label: 'Theoretical Interaction',
    symbol: 'INFO',
    color: '#A7B0B8',
    description: 'Plausible class-level interaction supported by pharmacology but not direct clinical evidence.',
    riskScale: 2
  },
  DETERMINISTIC: {
    label: 'Deterministic mapping',
    symbol: 'WARN',
    color: '#5A9FD4',
    description: 'Classification from an explicit deterministic rule or mapping table.',
    riskScale: 3
  },
  SELF: {
    label: 'Same Entity / N-A',
    symbol: 'SELF',
    color: '#274F13',
    description: 'Diagonal/self pairing; not an interaction pair.',
    riskScale: -1
  },
};

const INTERACTION_RULES: Record<string, InteractionEvidence> = {
  'alcohol|ayahuasca': {
    code: 'DAN',
    summary: 'Advised against; MAOI context and stated potential for dangerous outcomes.',
    confidence: 'high',
    sources: 'ayahuasca-interactions.pdf (p1 text)'
  },
  'amphetamine_stims|ayahuasca': {
    code: 'DAN',
    summary: 'Explicitly contraindicated; risk includes hypertensive crisis/serotonin toxicity.',
    confidence: 'high',
    sources: 'Ayahuasca and Drug Interaction.pdf (Drug Contraindications slide)'
  },
  'antihypertensives|ayahuasca': {
    code: 'CAU',
    summary: 'Class-dependent cardiovascular caution; stable ACEi/ARB therapy is often less concerning than beta-blockers, clonidine, or rate-controlling calcium-channel blockers.',
    confidence: 'low',
    sources: 'entheogen-interactions-research-update; ayahuasca-interactions.pdf; Ayahuasca and Drug Interaction.pdf',
    mechanism: `Ayahuasca commonly raises heart rate and blood pressure while also causing vomiting, diarrhea, and fluid shifts. Background antihypertensive therapy can make those hemodynamic swings less predictable, especially if compensatory tachycardia is blunted or the participant becomes volume depleted.`,
    practicalGuidance: `- Stable ACE inhibitor or ARB treatment is usually a caution problem rather than an automatic stop.\n- Beta-blockers, rate-controlling calcium-channel blockers, and alpha-2 agonists deserve a separate review rather than being lumped into one bucket.\n- Do not advise people to abruptly stop blood-pressure medication just to attend ceremony; the unmanaged baseline disease may be riskier than the interaction itself.`,
    timing: `If recent vomiting, diarrhea, fasting, heat exposure, or repeated cups are involved, the interaction risk rises because volume depletion makes antihypertensives harder to titrate safely.`,
    evidenceGaps: `There are still no direct trials of standardized ayahuasca in participants maintained on specific antihypertensive classes.`,
    evidenceTier: 'mechanistic inference + retreat guidance + limited human ayahuasca hemodynamic data'
  },
  'antipsychotics|ayahuasca': {
    code: 'UNS',
    summary: 'Usually a psychiatric contraindication rather than a classic serotonergic-toxicity problem; many antipsychotics will also strongly suppress DMT effects.',
    confidence: 'low',
    sources: 'entheogen-interactions-research-update; Ayahuasca and Drug Interaction.pdf (The Good + Contraindications slides)',
    mechanism: `Many antipsychotics are potent 5-HT2A antagonists, so they can flatten DMT effects while adding their own burdens such as orthostasis, QT issues, sedation, or metabolic strain. The larger concern is that the person is often being treated for psychosis-spectrum illness, bipolar instability, or severe agitation.`,
    practicalGuidance: `- Treat antipsychotic use for schizophrenia, psychosis, or unstable bipolar illness as a practical contraindication to ayahuasca.\n- Low-dose quetiapine or similar drugs used only for sleep/anxiety may be physiologically lower-risk, but they still tend to blunt the medicine and invite dose-chasing.\n- Do not recommend stopping antipsychotics without psychiatric supervision.`,
    evidenceGaps: `Direct ayahuasca-in-antipsychotic-maintained cohorts are missing; most evidence is extrapolated from classic psychedelic receptor-blockade studies.`,
    evidenceTier: 'mechanistic inference + clinical exclusion practice + retreat guidance'
  },
  'atypical_ad|psilocybin': {
    code: 'LOW_MOD',
    summary: 'Usually lower acute toxicity than MAOI or SNRI combinations, but trazodone, mirtazapine, and buspirone commonly blunt or reshape psilocybin effects.',
    confidence: 'high',
    sources: 'entheogen-interactions-research-update; Psilocybin-Mushrooms-SSRIs-Antidepressant-Interaction-Chart.pdf',
    mechanism: `Trazodone and mirtazapine antagonize 5-HT2A signaling, while buspirone changes serotonergic tone through 5-HT1A partial agonism. That generally lowers subjective intensity more than it raises toxicity.`,
    practicalGuidance: `- Expect dulled or altered macrodose effects rather than a clean contraindication.\n- Polypharmacy matters: the risk picture changes if SSRIs, SNRIs, MAOIs, or several serotonergic agents are also present.\n- Microdosing is not automatically exempt; a published serotonin-toxicity case involved a heavier serotonergic stack plus trazodone.`,
    timing: `Where fuller psychedelic intensity is the goal, clinics often use a rough 1-2 week taper/hold heuristic for trazodone or mirtazapine. That timing is pragmatic rather than strongly evidenced.`,
    evidenceGaps: `Controlled data are emerging for trazodone plus psilocybin, but comparable formal work for mirtazapine and buspirone is still thin.`,
    evidenceTier: 'systematic interaction review + trial rationale + case report + clinical heuristics'
  },
  'ayahuasca|benzodiazepines': {
    code: 'LOW_MOD',
    summary: 'Emergency benzodiazepine use is generally low-risk and clinically preferred for severe agitation; planned co-use more often blunts effects and complicates screening than it causes direct toxicity.',
    confidence: 'medium',
    sources: 'entheogen-interactions-research-update; Ayahuasca and Drug Interaction.pdf (The Good slide)',
    mechanism: `Benzodiazepines are GABAergic rather than serotonergic, which is why toxicology guidance favors them for agitation, muscle rigidity, and serotonin-toxicity management. The main tradeoffs are sedation, falls, aspiration during heavy purge, and a flatter psychedelic process.`,
    practicalGuidance: `- Distinguish rescue use from routine co-use.\n- Rescue dosing for severe panic, agitation, or suspected serotonin toxicity is a safer option than antipsychotic-heavy chemical restraint in most settings.\n- Do not push abrupt benzodiazepine discontinuation before ceremony; withdrawal and rebound anxiety can be more dangerous than stable low-dose maintenance.`,
    timing: `Stable low-dose maintenance mainly predicts effect blunting. Escalating doses, erratic use, or recent withdrawal raise the risk profile much more than the pharmacology of the pair itself.`,
    fieldNotes: `Field consensus is often stricter than toxicology literature: many retreats discourage baseline benzo use but still keep benzodiazepines available as emergency rescue medication.`,
    evidenceGaps: `Ayahuasca-specific observational data on maintained benzodiazepine users remain sparse.`,
    evidenceTier: 'toxicology guidelines + retreat protocols + field consensus'
  },
  'ayahuasca|cannabis': {
    code: 'CAU',
    summary: 'Main concern is psychiatric and cardiovascular destabilization rather than classic MAOI toxicity; cannabis often makes ayahuasca less predictable, not safer.',
    confidence: 'medium',
    sources: 'entheogen-interactions-research-update; Ayahuasca and Drug Interaction.pdf (The Good slide)',
    mechanism: `THC can raise heart rate, intensify anxiety, and lower the threshold for derealization or psychotic-like reactions. Ayahuasca already increases autonomic load and psychological lability, so the combination can become panic-prone even when neither agent is medically toxic on its own.`,
    practicalGuidance: `- Avoid high-THC cannabis during the peak of ayahuasca.\n- If used at all in experienced people, lower-THC or balanced THC:CBD cannabis late in the tail is a safer pattern than early peak stacking.\n- Screen out active psychosis and strong family history of psychotic illness.`,
    fieldNotes: `Many facilitators report cannabis as a more common destabilizer than tobacco on ceremony days, especially with concentrates or strong edibles.`,
    evidenceGaps: `Prospective data on cannabis preloading, concentrates, and redosing during ceremony are still missing.`,
    evidenceTier: 'ethnopharmacology review + pilot endocannabinoid work + facilitator consensus'
  },
  'ayahuasca|cocaine': {
    code: 'DAN',
    summary: 'Listed as contraindicated with ayahuasca.',
    confidence: 'high',
    sources: 'Ayahuasca and Drug Interaction.pdf (Drug Contraindications slide)'
  },
  'ayahuasca|five_meo_dmt': {
    code: 'DAN',
    summary: 'Source explicitly states 5-MeO-DMT may be dangerous with MAOIs.',
    confidence: 'high',
    sources: 'Ayahuasca and Drug Interaction.pdf (summary slide text)'
  },
  'ayahuasca|kambo': {
    code: 'CAU',
    summary: 'Multi-medicine retreat sequencing is common, but same-day kambo plus ayahuasca can push dehydration, electrolyte disturbance, and hemodynamic instability into unsafe territory.',
    confidence: 'medium',
    sources: 'entheogen-interactions-research-update; ayahuasca-interactions.pdf (p1 text)',
    mechanism: `Kambo produces short, intense autonomic stress with vomiting, hypotension, tachycardia, and fluid/electrolyte loss. Ayahuasca adds further blood-pressure shifts, purging, and cardiovascular activation, so the main risk is somatic rather than serotonergic.`,
    practicalGuidance: `- Safer sequencing is kambo first, then overnight recovery with explicit rehydration and a health check before ayahuasca.\n- Avoid same-half-day protocols, repeated kambo sessions immediately before aya, and anyone with kidney disease, cardiovascular disease, or heavy diuretic use.`,
    timing: `Overnight spacing with recovery is a minimum field standard. Same-day stacking should be treated as materially riskier.`,
    evidenceGaps: `There are no formal kambo plus ayahuasca interaction studies; a retreat safety registry would be more realistic than a trial.`,
    evidenceTier: 'case reports + ethnographic / retreat sequencing practice'
  },
  'ayahuasca|lsd': {
    code: 'LOW_MOD',
    summary: 'Listed in lower-risk ceremonial/recreational combinations.',
    confidence: 'medium',
    sources: 'Ayahuasca and Drug Interaction.pdf (The Good slide)'
  },
  'ayahuasca|maoi_pharma': {
    code: 'DAN',
    summary: 'Other MAOIs explicitly called out as interaction risks.',
    confidence: 'high',
    sources: 'ayahuasca-interactions.pdf (p1 text)'
  },
  'ayahuasca|mdma_2cx_dox_nbome': {
    code: 'DAN',
    summary: 'Ceremonial/recreational serotonergic phenethylamines listed as contraindicated.',
    confidence: 'high',
    sources: 'Ayahuasca and Drug Interaction.pdf (Drug Contraindications slide)'
  },
  'ayahuasca|mescaline_peyote': {
    code: 'CAU',
    summary: 'Phenethylamine-style cardiovascular load makes full same-session combinations unsafe in practice; if sequenced, 24 hours looks like a bare minimum rather than a comfortable margin.',
    confidence: 'medium',
    sources: 'entheogen-interactions-research-update; Ayahuasca and Drug Interaction.pdf (The Good slide)',
    mechanism: `Mescaline is more sympathomimetic than psilocybin or DMT. Harmala-mediated MAO inhibition may slow mescaline clearance and prolong stimulation, making blood-pressure and rhythm stress the dominant concern.`,
    practicalGuidance: `- Treat full-dose same-night ayahuasca plus mescaline/peyote as unsafe for ceremonial settings.\n- If ayahuasca came first, waiting 48-72 hours before a substantial mescaline dose is a more conservative field rule than 24 hours.\n- If mescaline came first, full recovery, sleep, and hydration matter before any next-day ayahuasca.`,
    timing: `A 24-hour gap is only a minimal pharmacology-based estimate. The research update strongly favors 48-72 hours after ayahuasca before significant mescaline work.`,
    evidenceGaps: `Direct human mescaline-under-harmala data are essentially absent; current guidance is mostly mechanistic plus field conservatism.`,
    evidenceTier: 'mechanistic inference + MAOI pharmacology + field guidance'
  },
  'ayahuasca|beta_blockers_ccb': {
    code: 'UNS',
    summary: 'Rate-controlling beta-blockers and certain calcium-channel blockers are higher-concern than generic blood-pressure medication because ayahuasca can create pressure swings while these drugs limit compensatory responses.',
    confidence: 'low',
    sources: 'entheogen-interactions-research-update',
    mechanism: `Beta-blockers and rate-controlling calcium-channel blockers can worsen bradycardia or hypotension during stress states. Ayahuasca adds variable sympathetic activation, vasodilation, vomiting, and dehydration, so the combined hemodynamic picture can become unstable.`,
    practicalGuidance: `- Do not assume these medications behave like ACE inhibitors or ARBs.\n- Combined beta-blocker plus calcium-channel blocker therapy deserves especially strong caution.\n- If ayahuasca is still being considered, cardiology input and active monitoring are more appropriate than self-experimentation.`,
    evidenceGaps: `The concern is strong mechanistically but still lacks ayahuasca-specific prospective studies.`,
    evidenceTier: 'cardiovascular pharmacology + retreat guidance + mechanistic inference'
  },
  'ayahuasca|clonidine_guanfacine': {
    code: 'CAU',
    summary: 'Alpha-2 agonists may be potentiated around harmala use and can tilt an ayahuasca session toward hypotension, bradycardia, or over-sedation.',
    confidence: 'low',
    sources: 'entheogen-interactions-research-update',
    mechanism: `Clonidine and guanfacine reduce sympathetic outflow. The research update notes field concern that harmala-related CYP inhibition may raise exposure for some related agents, making blood-pressure drops and sedation harder to predict.`,
    practicalGuidance: `- Treat clonidine/guanfacine as a timing-sensitive caution rather than a universal stop.\n- Monitor for dizziness, bradycardia, and rebound blood-pressure problems if doses are skipped.\n- Avoid improvising withdrawal just to make room for ceremony.`,
    timing: `Prefer taking alpha-2 agonists well outside the strongest harmala window; the research update used a rough 10-hour separation rule as a practical field heuristic.`,
    evidenceGaps: `Evidence is mostly mechanistic plus field experience; formal aya-specific PK work is missing.`,
    evidenceTier: 'field guidance + mechanistic inference'
  },
  'ayahuasca|ketamine': {
    code: 'UNS',
    summary: 'Same-session ayahuasca plus ketamine is a poor fit: dissociation, sedation, impaired mobility, and purge-related aspiration/fall risk outweigh any novelty value.',
    confidence: 'low',
    sources: 'entheogen-interactions-research-update',
    mechanism: `Ketamine adds dissociation and motor impairment rather than a clean serotonergic synergy. Ayahuasca adds vomiting, autonomic swings, and intense perceptual disruption, so the combination is operationally unsafe even without a known receptor-level crisis mechanism.`,
    practicalGuidance: `- Avoid same-session co-use.\n- In multi-day programs, treat 24 hours as a minimum spacing buffer and prefer clinical staffing if either medicine is being used for mental-health treatment rather than informal experimentation.`,
    evidenceGaps: `No formal ketamine-ayahuasca interaction studies were identified; current guidance is mostly based on operational risk and scattered reports.`,
    evidenceTier: 'mechanistic inference + scattered field reports'
  },
  'ayahuasca|methylphenidate': {
    code: 'DAN',
    summary: 'Listed in contraindicated stimulant class with ayahuasca.',
    confidence: 'high',
    sources: 'Ayahuasca and Drug Interaction.pdf (Drug Contraindications slide)'
  },
  'ayahuasca|nn_dmt': {
    code: 'CAU',
    summary: 'This is the basic ayahuasca/pharmahuasca interaction at oral doses, but layering extra smoked or vaped DMT on top of ayahuasca meaningfully raises intensity and can become unsafe at high combined loads.',
    confidence: 'medium',
    sources: 'entheogen-interactions-research-update; Ayahuasca and Drug Interaction.pdf (summary slide text)',
    mechanism: `Ayahuasca's harmala alkaloids reversibly inhibit MAO-A and prolong DMT exposure. The main issue is not a mysterious new toxic syndrome but sharply increased total psychedelic load, longer duration, and bigger cardiovascular and behavioral swings when extra DMT is added during peak ayahuasca.`,
    practicalGuidance: `- Treat smoked or vaped DMT on top of active ayahuasca as an advanced intensification protocol, not a casual booster.\n- If someone insists, conservative DMT dosing and single rather than repeated redosing are much safer than chasing peak intensity.\n- Avoid entirely in seizure history, uncontrolled hypertension, or unstable cardiovascular disease.`,
    timing: `Ayahuasca should still be treated as conferring meaningful MAO-A inhibition for about 24 hours, with a more conservative 24-48 hour washout after heavy or repeated dosing.`,
    evidenceGaps: `Formal data exist for oral DMT plus harmalas, but not for stacked smoked/vaped DMT during an ayahuasca session.`,
    evidenceTier: 'formal ayahuasca pharmacology + PK data + field extrapolation'
  },
  'ayahuasca|psilocybin': {
    code: 'CAU',
    summary: 'Not clearly toxic in the way ayahuasca plus SSRIs or MDMA can be, but same-session overlap is a strong intensifier and can become operationally unsafe.',
    confidence: 'medium',
    sources: 'entheogen-interactions-research-update; Ayahuasca and Drug Interaction.pdf (pharmahuasca section)',
    mechanism: `Harmala-mediated MAO-A inhibition may prolong psilocin exposure while both medicines strongly activate 5-HT2A-mediated psychedelic effects. The main risk is stacked intensity, blood-pressure load, vomiting, panic, and behavioral disorganization rather than a well-documented serotonergic crisis.`,
    practicalGuidance: `- Avoid same-night full doses.\n- If sequencing in a retreat arc, ayahuasca one evening and psilocybin 24-48 hours later is substantially safer than deliberate overlap.\n- If overlap is still being considered, reduce both doses heavily and make the setting medically and physically contained.`,
    timing: `A 24-hour gap is a bare minimum after ayahuasca. The research update leans toward 36-48 hours as a more conservative margin when harmala exposure was strong or repeated.`,
    evidenceGaps: `There is still no direct psilocin-under-harmala PK dataset, so much of the spacing guidance remains mechanistic.`,
    evidenceTier: 'MAOI pharmacology + secondary review + field guidance'
  },
  'ayahuasca|serotonergic_opioids': {
    code: 'DAN',
    summary: 'Methadone/tramadol/meperidine/tapentadol listed as contraindicated.',
    confidence: 'high',
    sources: 'Ayahuasca and Drug Interaction.pdf (Drug Contraindications slide)'
  },
  'ayahuasca|snri': {
    code: 'DAN',
    summary: 'SNRIs included in contraindicated antidepressant list.',
    confidence: 'high',
    sources: 'Ayahuasca and Drug Interaction.pdf (Drug Contraindications slide)'
  },
  'ayahuasca|ssri': {
    code: 'DAN',
    summary: 'Serotonin syndrome risk explicitly discussed in MAOI context.',
    confidence: 'high',
    sources: 'ayahuasca-interactions.pdf + Ayahuasca and Drug Interaction.pdf'
  },
  'ayahuasca|tobacco_rape': {
    code: 'LOW_MOD',
    summary: 'Traditional low-frequency use appears broadly compatible in healthy people, but repeated or heavy tobacco/rapé use can add meaningful blood-pressure and anxiety load.',
    confidence: 'medium',
    sources: 'entheogen-interactions-research-update; Ayahuasca and Drug Interaction.pdf (The Good slide)',
    mechanism: `Nicotine raises heart rate and blood pressure through catecholamine release. Ayahuasca can do the same, so the combination is usually tolerated in healthy participants but can become a problem with cardiovascular disease, naïve users, or repeated strong applications.`,
    practicalGuidance: `- Distinguish traditional intermittent use from compulsive repeated dosing.\n- Ask whether the rapé contains other plant admixtures before assuming the interaction is just nicotine.\n- Use more caution in hypertension, arrhythmia, panic-prone states, or older participants.`,
    fieldNotes: `Traditional Amazonian practice is one reason this pair should not be overclassified, but facilitator experience still supports caution around repeated dosing and admixtures.`,
    evidenceGaps: `Almost no formal hemodynamic monitoring exists for ayahuasca plus ritual tobacco patterns.`,
    evidenceTier: 'traditional-use precedent + mechanistic inference + limited hemodynamic data'
  },
  'ayahuasca|tricyclic_ad': {
    code: 'DAN',
    summary: 'Specific tricyclics listed as contraindicated with MAOI context.',
    confidence: 'high',
    sources: 'Ayahuasca and Drug Interaction.pdf (Drug Contraindications slide)'
  },
  'ayahuasca|yopo': {
    code: 'DAN',
    summary: 'Concurrent ayahuasca plus yopo should be treated as contraindicated because bufotenine/5-substituted tryptamine exposure under MAO inhibition is poorly studied and plausibly high-risk.',
    confidence: 'medium',
    sources: 'entheogen-interactions-research-update; Ayahuasca and Drug Interaction.pdf (Good combinations caveat)',
    mechanism: `Yopo preparations are often bufotenine-dominant and may contain small amounts of DMT or 5-MeO-DMT depending on material and preparation. Ayahuasca's MAO-A inhibition can increase exposure to 5-substituted tryptamines, which is exactly the class that underground and ethnographic guidance treats most cautiously.`,
    practicalGuidance: `- Flag same-session ayahuasca plus yopo as contraindicated.\n- If both medicines are used in a longer retreat container, avoid same-day use and build in at least 48 hours, hydration review, and cardiovascular screening.\n- The lack of clear traditional precedent for oral ayahuasca plus yopo layering is itself useful safety information.`,
    evidenceGaps: `Human data are almost entirely absent. Current guidance is built from pharmacology, ethnographic negative precedent, and field caution rather than trials.`,
    evidenceTier: 'mechanistic inference + ethnographic precedent + underground harm-reduction consensus'
  },
  'antipsychotics|psilocybin': {
    code: 'LOW_MOD',
    summary: 'Many antipsychotics will blunt psilocybin more than they increase direct toxicity, but the underlying psychiatric indication may still make psychedelic use a poor fit.',
    confidence: 'medium',
    sources: 'entheogen-interactions-research-update',
    mechanism: `5-HT2A antagonism reliably suppresses classic psychedelic effects. The principal concern is less serotonin toxicity than medication discontinuation, psychosis risk, and dose-chasing against receptor blockade.`,
    practicalGuidance: `- Expect a flatter or partially blocked psychedelic response.\n- Treat psychosis-spectrum illness and unstable bipolar illness as more important red flags than the pharmacology of the pair itself.\n- Avoid unsupervised antipsychotic tapering just to regain psychedelic intensity.`,
    evidenceTier: 'systematic interaction review + clinical exclusion practice'
  },
  'benzodiazepines|psilocybin': {
    code: 'LOW_MOD',
    summary: 'Usually a blunting or rescue-medication issue rather than a toxicological one.',
    confidence: 'medium',
    sources: 'entheogen-interactions-research-update',
    mechanism: `Benzodiazepines reduce arousal and can dampen the behavioral and emotional intensity of psilocybin without adding serotonergic load.`,
    practicalGuidance: `- Stable low-dose use usually means reduced subjective intensity.\n- Rescue use for overwhelming panic is more defensible than preemptive repeated co-dosing.\n- Abrupt discontinuation before a session can be riskier than continuing a stable prescription.`,
    evidenceTier: 'toxicology practice + field consensus'
  },
  'lithium|psilocybin': {
    code: 'DAN',
    summary: 'Lithium has the clearest published seizure signal of the missing medication classes and should be treated as contraindicated with classic psychedelics.',
    confidence: 'medium',
    sources: 'entheogen-interactions-research-update',
    mechanism: `The exact mechanism is unresolved, but observational report analysis found a striking seizure rate when lithium was combined with classic psychedelics. Because psilocybin already changes cortical excitability and lithium alters second-messenger systems, the pairing is treated conservatively.`,
    practicalGuidance: `- Do not frame this as merely an effect-blunting interaction.\n- If lithium is present, the safer recommendation is to avoid psilocybin entirely unless the medication plan is being changed under medical supervision for broader clinical reasons.`,
    evidenceGaps: `The signal is observational rather than trial-based, but it is strong enough to justify a hard warning.`,
    evidenceTier: 'observational report analysis + harm-reduction consensus'
  },
  'lamotrigine|psilocybin': {
    code: 'LOW_MOD',
    summary: 'Current observational evidence suggests lower interaction concern than lithium, with many reports describing little change in intensity and no seizure signal.',
    confidence: 'low',
    sources: 'entheogen-interactions-research-update',
    mechanism: `Lamotrigine is anticonvulsant rather than serotonergic, so the main expectation is possible mild effect modulation rather than a toxic synergy.`,
    practicalGuidance: `- This is not a free pass, especially when lamotrigine is part of a bipolar treatment plan.\n- Relative to lithium, though, current evidence points toward lower seizure concern and less dramatic interaction.`,
    evidenceGaps: `Evidence remains observational and much thinner than for standard antidepressant categories.`,
    evidenceTier: 'observational report analysis'
  },
  'methylphenidate|psilocybin': {
    code: 'CAU',
    summary: 'Outside the ayahuasca/MAOI context this is not the same level of crisis risk, but additive heart-rate, blood-pressure, and anxiety load still warrant caution.',
    confidence: 'low',
    sources: 'entheogen-interactions-research-update',
    mechanism: `Methylphenidate raises catecholaminergic tone while psilocybin can also elevate heart rate and intensify stimulation, especially in anxious or sleep-deprived users.`,
    practicalGuidance: `- Avoid high stimulant doses, dehydration, and uncontrolled hypertension.\n- If someone is prescribed methylphenidate, a stable therapeutic regimen is still meaningfully different from binge or recreational redosing.`,
    evidenceTier: 'mechanistic inference + field guidance'
  },
  'amphetamine_stims|psilocybin': {
    code: 'CAU',
    summary: 'Prescription or recreational amphetamine stimulants add cardiovascular and anxiety load to psilocybin even without MAOI potentiation.',
    confidence: 'low',
    sources: 'entheogen-interactions-research-update',
    mechanism: `This is an additive arousal problem rather than the hypertensive-crisis pattern seen with ayahuasca plus stimulants. Heart rate, blood pressure, panic, insomnia, and overheating become more likely as dose rises.`,
    practicalGuidance: `- Lower stimulant exposure and good hydration matter.\n- Avoid in uncontrolled hypertension, structural heart disease, or when the stimulant use itself is erratic or escalating.`,
    evidenceTier: 'mechanistic inference + field guidance'
  },
  'maoi_pharma|psilocybin': {
    code: 'DAN',
    summary: 'Serotonin syndrome or hypertension category in source chart.',
    confidence: 'high',
    sources: 'Psilocybin-Mushrooms-SSRIs-Antidepressant-Interaction-Chart.pdf'
  },
  'ndri_bupropion|psilocybin': {
    code: 'CAU',
    summary: 'Reduced seizure-threshold caution; individualized risk assessment advised.',
    confidence: 'high',
    sources: 'Psilocybin-Mushrooms-SSRIs-Antidepressant-Interaction-Chart.pdf'
  },
  'psilocybin|snri': {
    code: 'LOW_MOD',
    summary: 'Blunted effects with typical 2-week washout guidance.',
    confidence: 'high',
    sources: 'Psilocybin-Mushrooms-SSRIs-Antidepressant-Interaction-Chart.pdf'
  },
  'psilocybin|ssri': {
    code: 'LOW_MOD',
    summary: 'Blunted effects; washout mostly 2 weeks (fluoxetine 6 weeks).',
    confidence: 'high',
    sources: 'Psilocybin-Mushrooms-SSRIs-Antidepressant-Interaction-Chart.pdf'
  },
  'psilocybin|tricyclic_ad': {
    code: 'CAU',
    summary: 'Intensified effects; chart indicates caution with 2-week washout guidance.',
    confidence: 'high',
    sources: 'Psilocybin-Mushrooms-SSRIs-Antidepressant-Interaction-Chart.pdf'
  },
};

const CLASSIC_PSYCHEDELIC_IDS = new Set([
  'ayahuasca',
  'psilocybin',
  'nn_dmt',
  'five_meo_dmt',
  'mescaline_peyote',
  'yopo',
  'lsd'
]);

const DELIRIANT_IDS = new Set(['belladonna', 'brugmansia']);
const NMDA_ANTAGONIST_IDS = new Set(['ketamine']);
const ALPHA2_AGONIST_IDS = new Set(['clonidine', 'guanfacine']);
const SODIUM_CHANNEL_IDS = new Set(['lamotrigine']);
const HEMODYNAMIC_IDS = new Set([
  'antihypertensives',
  'beta_blockers',
  'calcium_channel_blockers',
  'clonidine',
  'guanfacine'
]);
const CNS_DEPRESSANT_IDS = new Set(['alcohol', 'benzodiazepines', 'serotonergic_opioids']);
const STIMULANT_IDS = new Set([
  'amphetamine_stims',
  'methylphenidate',
  'cocaine',
  'mdma',
  'two_c_x',
  'dox',
  'nbome_series',
  'mdma_2cx_dox_nbome',
  'ndri_bupropion',
  'tobacco_rape'
]);
const SEROTONERGIC_IDS = new Set([
  'ayahuasca',
  'psilocybin',
  'nn_dmt',
  'five_meo_dmt',
  'mescaline_peyote',
  'yopo',
  'lsd',
  'ssri',
  'snri',
  'tricyclic_ad',
  'maoi_pharma',
  'atypical_ad',
  'serotonergic_opioids',
  'mdma',
  'two_c_x',
  'dox',
  'nbome_series',
  'mdma_2cx_dox_nbome'
]);

const pairKey = (a: string, b: string) => [a, b].sort().join('|');

const makeTheoreticalInteraction = (
  summary: string,
  mechanism: string,
  mechanismCategory: MechanismCategory,
  mechanismCategories: MechanismCategory[],
  confidence: 'low' | 'medium',
  rationale: string,
  evidenceGaps: string,
  practicalGuidance: string,
  fieldNotes?: string
): InteractionEvidence => ({
  code: 'THEORETICAL',
  label: 'Theoretical interaction',
  summary,
  confidence,
  sources: 'mechanistic_inference',
  mechanism,
  mechanismCategory,
  mechanismCategories,
  practicalGuidance,
  evidenceGaps,
  fieldNotes,
  evidenceTier: 'theoretical',
  riskAssessment: {
    level: confidence === 'medium' ? 'provisional_moderate' : 'provisional_low',
    rationale
  },
  provenance: {
    source: 'mechanistic_inference',
    confidenceTier: confidence,
    method: 'rule_based_inference_v2',
    rationale
  }
});

const makeTheoreticalFallbackEvidence = (
  _code: InteractionEvidence['code'],
  summary: string,
  confidence: 'medium' | 'low',
  mechanism: string,
  mechanismCategory: MechanismCategory,
  mechanismCategories: MechanismCategory[],
  rationale: string,
  evidenceGaps: string,
  practicalGuidance: string,
  fieldNotes?: string
): InteractionEvidence =>
  makeTheoreticalInteraction(
    summary,
    mechanism,
    mechanismCategory,
    mechanismCategories,
    confidence,
    rationale,
    evidenceGaps,
    practicalGuidance,
    fieldNotes
  );

const THEORETICAL_INTERACTION_RULES: Record<string, InteractionEvidence> = {
  'beta_blockers|guanfacine': makeTheoreticalInteraction(
    'Guanfacine plus beta-blockers is a plausible noradrenergic suppression interaction with blood-pressure and heart-rate lowering effects.',
    'Both drugs reduce sympathetic tone and can make compensatory tachycardia or orthostatic recovery less reliable.',
    'hemodynamic_interaction',
    ['hemodynamic_interaction', 'noradrenergic_suppression', 'cardiovascular_load'],
    'medium',
    'The concern is driven by combined autonomic dampening rather than documented severe toxicity.',
    'No direct pair-specific clinical evidence was identified.',
    '- Watch for dizziness, fatigue, and slow pulse.\n- Avoid abrupt dose changes or double-using sedating co-medications.',
    'Guanfacine is often somewhat less sedating than clonidine, but the class interaction still merits caution.'
  ),
  'calcium_channel_blockers|guanfacine': makeTheoreticalInteraction(
    'Guanfacine plus calcium-channel blockers is a plausible hemodynamic interaction with additive hypotension concern.',
    'Alpha-2 agonism lowers sympathetic outflow while calcium-channel blockade can reduce cardiovascular compensatory reserve.',
    'hemodynamic_interaction',
    ['hemodynamic_interaction', 'noradrenergic_suppression', 'cardiovascular_load'],
    'medium',
    'This is a class-level inference rather than direct outcome evidence.',
    'No direct pair-specific clinical trials were identified.',
    '- Use conservative titration and monitor orthostatic symptoms.\n- Seek medical review if syncope or marked bradycardia appears.',
    'Different calcium-channel blockers do not behave identically; the theoretical label keeps that uncertainty explicit.'
  ),
  'clonidine|ketamine': makeTheoreticalInteraction(
    'Ketamine plus clonidine is a plausible autonomic interaction that can alter sedation, blood pressure, and recovery from dissociation.',
    'Ketamine may raise sympathetic tone while clonidine suppresses noradrenergic output, creating an unstable balance around blood pressure and alertness.',
    'glutamate_modulation',
    ['glutamate_modulation', 'hemodynamic_interaction', 'operational_or_behavioral_risk'],
    'low',
    'There is no direct ketamine plus clonidine safety dataset for this exact pairing.',
    'No direct pair-specific clinical trial data were identified.',
    '- Use caution with standing, driving, and additional sedatives.\n- Avoid assuming clonidine will reliably "smooth" ketamine effects.'
  ),
  'guanfacine|ketamine': makeTheoreticalInteraction(
    'Ketamine plus guanfacine is a plausible autonomic interaction with uncertain net hemodynamic effect and possible sedation.',
    'Guanfacine dampens sympathetic outflow while ketamine can transiently activate catecholamine pathways and dissociation.',
    'glutamate_modulation',
    ['glutamate_modulation', 'hemodynamic_interaction', 'operational_or_behavioral_risk'],
    'low',
    'The evidence is class-level and indirect rather than pair-specific.',
    'No direct pair-specific clinical trial data were identified.',
    '- Watch for dizziness, over-sedation, and impaired self-care.\n- Keep additional depressants out of the mix.'
  ),
  'beta_blockers|ketamine': makeTheoreticalInteraction(
    'Ketamine plus beta-blockers is a plausible cardiovascular interaction with blunted compensatory responses and uncertain overall effect.',
    'Beta-blockade can blunt ketamine-related tachycardia while ketamine still changes perception and sympathetic tone.',
    'glutamate_modulation',
    ['glutamate_modulation', 'hemodynamic_interaction', 'operational_or_behavioral_risk'],
    'low',
    'The pair is pharmacologically plausible but lacks direct clinical outcome data.',
    'No direct pair-specific clinical trials were identified.',
    '- Monitor pulse and blood pressure if used in a medical setting.\n- Avoid assuming tachycardia is the only relevant safety marker.'
  ),
  'calcium_channel_blockers|ketamine': makeTheoreticalInteraction(
    'Ketamine plus calcium-channel blockers is a plausible cardiovascular interaction with blood-pressure variability and impaired compensation.',
    'Ketamine can increase cardiovascular activation while calcium-channel blockade may limit compensatory rhythm or pressure responses.',
    'glutamate_modulation',
    ['glutamate_modulation', 'hemodynamic_interaction', 'operational_or_behavioral_risk'],
    'low',
    'The risk is theoretical and class-based rather than outcome-proven.',
    'No direct pair-specific clinical trials were identified.',
    '- Use caution in people with baseline bradycardia or hypotension.\n- Seek medical input before combining in unsupervised settings.'
  ),
  'clonidine|lamotrigine': makeTheoreticalInteraction(
    'Lamotrigine plus clonidine is a plausible low-grade theoretical interaction centered on additive dizziness, sedation, and orthostatic effects.',
    'Lamotrigine modulates sodium channels while clonidine suppresses sympathetic output, so the main concern is tolerability rather than a unique toxidrome.',
    'ion_channel_modulation',
    ['ion_channel_modulation', 'noradrenergic_suppression', 'operational_or_behavioral_risk'],
    'low',
    'No direct pair-specific evidence was identified.',
    'No direct pair-specific clinical trials were identified.',
    '- Watch for lightheadedness or excessive sleepiness.\n- Keep dose changes conservative.'
  ),
  'guanfacine|lamotrigine': makeTheoreticalInteraction(
    'Lamotrigine plus guanfacine is a plausible low-grade theoretical interaction centered on tolerability and orthostatic symptoms.',
    'Sodium-channel modulation and alpha-2 agonism can combine into a mild dizziness/sedation burden.',
    'ion_channel_modulation',
    ['ion_channel_modulation', 'noradrenergic_suppression', 'operational_or_behavioral_risk'],
    'low',
    'No direct pair-specific evidence was identified.',
    'No direct pair-specific clinical trials were identified.',
    '- Monitor for lightheadedness and fatigue.\n- Avoid rapid titration of either medication.'
  ),
  'beta_blockers|lamotrigine': makeTheoreticalInteraction(
    'Lamotrigine plus beta-blockers is a plausible low-grade theoretical interaction with additive dizziness or fatigue.',
    'Beta-blockade can reduce compensatory cardiac response while lamotrigine may contribute nonspecific tolerability effects in some people.',
    'ion_channel_modulation',
    ['ion_channel_modulation', 'hemodynamic_interaction', 'operational_or_behavioral_risk'],
    'low',
    'No direct pair-specific evidence was identified.',
    'No direct pair-specific clinical trials were identified.',
    '- Use caution if baseline blood pressure is low or pulse is slow.\n- Review any recent dose changes.'
  ),
  'calcium_channel_blockers|lamotrigine': makeTheoreticalInteraction(
    'Lamotrigine plus calcium-channel blockers is a plausible low-grade theoretical interaction with dizziness and tolerability concerns.',
    'Calcium-channel blockade can reduce compensatory cardiovascular responses while lamotrigine may add nonspecific neurologic tolerability burden.',
    'ion_channel_modulation',
    ['ion_channel_modulation', 'hemodynamic_interaction', 'operational_or_behavioral_risk'],
    'low',
    'No direct pair-specific evidence was identified.',
    'No direct pair-specific clinical trials were identified.',
    '- Monitor for orthostatic symptoms or unusual fatigue.\n- Keep the pair in the theoretical bucket until stronger data exist.'
  )
};

const getDrug = (id: string) => getAppDatasetRegistry().drugById.get(id);

const hasMechanism = (drugId: string, needle: string) => {
  const drug = getDrug(drugId);
  const haystack = `${drug?.class ?? ''} ${drug?.mechanismTag ?? ''} ${drug?.notes ?? ''} ${drugId}`.toLowerCase();
  return haystack.includes(needle);
};

const inferProvenanceConfidence = (confidence: string): 'high' | 'medium' | 'low' => {
  if (confidence === 'high') return 'high';
  if (confidence === 'medium') return 'medium';
  return 'medium';
};

type RiskAssessmentLevel = NonNullable<NonNullable<InteractionEvidence['riskAssessment']>['level']>;

const inferRiskAssessmentLevel = (confidence: string): RiskAssessmentLevel => {
  if (confidence === 'high') return 'moderate';
  if (confidence === 'medium') return 'provisional_moderate';
  return 'provisional_low';
};

const makeDeterministicEvidence = (evidence: InteractionEvidence): InteractionEvidence => ({
  ...evidence,
  provenance: {
    ...evidence.provenance,
    source: 'deterministic_mapping_table',
    confidenceTier: evidence.provenance?.confidenceTier ?? inferProvenanceConfidence(evidence.confidence),
    rationale: evidence.provenance?.rationale ?? evidence.summary
  },
  label: evidence.label ?? LEGEND[evidence.code]?.label
});

const makeFallbackEvidence = (
  code: InteractionEvidence['code'],
  summary: string,
  confidence: 'high' | 'medium' | 'low',
  mechanism: string,
  mechanismCategory: MechanismCategory,
  categories: MechanismCategory[],
  evidenceTier: string,
  rationale: string,
  practicalGuidance: string,
  evidenceGaps: string,
  fieldNotes?: string
): InteractionEvidence => ({
  code,
  label: 'Mechanistic inference',
  summary,
  confidence,
  sources: 'source-gap',
  mechanism,
  mechanismCategory,
  mechanismCategories: categories,
  practicalGuidance,
  evidenceGaps,
  evidenceTier,
  fieldNotes,
  riskAssessment: {
    level: inferRiskAssessmentLevel(confidence),
    rationale
  },
  provenance: {
    source: 'heuristic_fallback',
    confidenceTier: 'low',
    method: 'rule_based_inference_v1',
    rationale
  }
});

const getFallbackInteractionEvidence = (drug1: string, drug2: string): InteractionEvidence => {
  const ids = [drug1, drug2];
  const otherClassic = ids.find((id) => CLASSIC_PSYCHEDELIC_IDS.has(id));

  if (ids.includes('lithium') && otherClassic) {
    return makeTheoreticalFallbackEvidence(
      'INFERRED',
      'Lithium plus a classic psychedelic remains a serious seizure-risk concern based on observational signals and class-level neurotoxicity reasoning.',
      'medium',
      'Lithium appears to interact with classic psychedelic states in a way that meaningfully raises seizure and severe adverse-reaction concern.',
      'seizure_threshold',
      ['seizure_threshold', 'psychiatric_destabilization', 'operational_or_behavioral_risk'],
      'Observational seizure signal and lithium pharmacology support a conservative inferred warning.',
      '- Avoid this pairing in non-medical settings.\n- Do not advise lithium self-discontinuation without clinician supervision.',
      'No controlled co-use data; the signal is observational and mechanistic.'
    );
  }

  if (ids.includes('lamotrigine') && otherClassic) {
    return makeTheoreticalFallbackEvidence(
      'INFERRED',
      'Lamotrigine with a classic psychedelic is usually a lower-severity, effect-modulation style interaction with some uncertainty around individual response.',
      'low',
      'Lamotrigine is anticonvulsant and not strongly serotonergic, so expectations center on mild effect modulation rather than toxic synergy.',
      'ion_channel_modulation',
      ['ion_channel_modulation', 'psychiatric_destabilization'],
      'Class-level anticonvulsant pharmacology supports a cautious inferred interaction without clear acute toxicity.',
      '- This is a softer warning than lithium.\n- Review recent dose changes and bipolar treatment context.',
      'Evidence remains observational and thinner than for standard antidepressant categories.'
    );
  }

  if (ids.some((id) => DELIRIANT_IDS.has(id)) && otherClassic) {
    return makeTheoreticalFallbackEvidence(
      'INFERRED',
      'Tropane-rich deliriants and a classic psychedelic create a high-disorientation interaction that is best treated as unsafe.',
      'medium',
      'Belladonna and Brugmansia contain atropine-, scopolamine-, and hyoscyamine-like alkaloids that can produce tachycardia, hyperthermia, delirium, urinary retention, arrhythmia, and profound confusion.',
      'anticholinergic_delirium',
      ['anticholinergic_delirium', 'psychiatric_destabilization', 'operational_or_behavioral_risk'],
      'The overlap is pharmacologically obvious even though direct co-use studies are not realistic.',
      '- Treat any belladonna/Brugmansia pairing with a classic psychedelic as an absolute contraindication in harm-reduction settings.',
      'Controlled co-use studies are effectively impossible, so toxicology cases and ethnographic caution remain the evidence base.',
      'This is a class-level toxidrome warning rather than a receptor-precision conclusion.'
    );
  }

  if (ids.includes('salvia') && otherClassic) {
    return makeTheoreticalFallbackEvidence(
      'INFERRED',
      'Salvia with a classic psychedelic is mainly an operational and psychological instability problem rather than a clean receptor-level toxicity pattern.',
      'low',
      'Salvinorin A is a kappa-opioid agonist rather than a classic serotonergic psychedelic.',
      'operational_or_behavioral_risk',
      ['operational_or_behavioral_risk', 'psychiatric_destabilization'],
      'The overlap is state disruption and accident risk, not serotonin toxicity.',
      '- Prefer separate-day use rather than co-use.\n- Same-session use should be treated as high-disorientation and high-accident risk.',
      'Formal combination studies are absent, so this remains a precautionary field rule.'
    );
  }

  if (
    ids.some((id) => ALPHA2_AGONIST_IDS.has(id)) &&
    ids.some((id) => HEMODYNAMIC_IDS.has(id) || STIMULANT_IDS.has(id) || CLASSIC_PSYCHEDELIC_IDS.has(id))
  ) {
    return makeTheoreticalFallbackEvidence(
      'INFERRED',
      'Alpha-2 agonist exposure with a cardiovascularly active partner points to a provisional noradrenergic suppression / hemodynamic interaction.',
      'medium',
      'Alpha-2 agonists reduce sympathetic outflow and can lower heart rate and blood pressure, making compensatory responses harder to predict.',
      'noradrenergic_suppression',
      ['noradrenergic_suppression', 'hemodynamic_interaction', 'psychiatric_destabilization'],
      'Class-level autonomic pharmacology supports a cautious inference.',
      '- Avoid abrupt clonidine or guanfacine changes.\n- Monitor for dizziness, bradycardia, hypotension, or unusual sedation.',
      'No large controlled human co-administration studies for this class pairing.'
    );
  }

  if (
    ids.some((id) => HEMODYNAMIC_IDS.has(id)) &&
    ids.some((id) => CLASSIC_PSYCHEDELIC_IDS.has(id) || STIMULANT_IDS.has(id) || ALPHA2_AGONIST_IDS.has(id))
  ) {
    return makeTheoreticalFallbackEvidence(
      'INFERRED',
      'A cardiovascularly active agent with a classic psychedelic or stimulant suggests a provisional hemodynamic interaction.',
      'low',
      'Both drugs can shape blood pressure or pulse, so the main issue is compensatory load rather than a unique toxidrome.',
      'hemodynamic_interaction',
      ['hemodynamic_interaction', 'cardiovascular_load', 'psychiatric_destabilization'],
      'Class-level cardiovascular pharmacology supports a cautious inference.',
      '- Watch for dizziness, palpitations, syncope, or sustained tachycardia.\n- Hydration and dose caution matter more than exact label matching here.',
      'No pair-specific hemodynamic trial data are available.'
    );
  }

  if (
    ids.some((id) => NMDA_ANTAGONIST_IDS.has(id)) &&
    (ids.some((id) => CLASSIC_PSYCHEDELIC_IDS.has(id)) || ids.some((id) => SEROTONERGIC_IDS.has(id)))
  ) {
    return makeTheoreticalFallbackEvidence(
      'INFERRED',
      'An NMDA-antagonist pair with a classic psychedelic suggests glutamate modulation and dissociative synergy rather than a clearly defined toxic syndrome.',
      'low',
      'Ketamine-like NMDA antagonism can overlap with serotonergic psychedelic effects through glutamatergic modulation, dissociation, and altered perception.',
      'glutamate_modulation',
      ['glutamate_modulation', 'psychedelic_intensification', 'operational_or_behavioral_risk'],
      'The best-supported mechanism is overlapping glutamatergic and perceptual disruption.',
      '- Avoid overlapping peak use outside a monitored setting.\n- Protect against falls, vomiting, and impaired self-care.',
      'Direct human combination data are sparse.'
    );
  }

  if (ids.some((id) => SODIUM_CHANNEL_IDS.has(id)) && otherClassic) {
    return makeTheoreticalFallbackEvidence(
      'INFERRED',
      'A sodium-channel modulator with a classic psychedelic points to ion-channel modulation with uncertain net effect and no clear unique syndrome.',
      'low',
      'Lamotrigine-like sodium-channel effects can reshape excitability and subjective response without creating a known pair-specific toxidrome.',
      'ion_channel_modulation',
      ['ion_channel_modulation', 'psychiatric_destabilization'],
      'Mechanistic overlap exists, but the clinical consequence is usually individualized and indirect.',
      '- Review indication, dose changes, and seizure history.\n- Avoid overinterpreting this as a guaranteed blunting or danger signal.',
      'Direct interaction data remain limited.'
    );
  }

  if (
    ids.some((id) => hasMechanism(id, 'blood pressure') || hasMechanism(id, 'heart rate')) &&
    ids.some((id) => hasMechanism(id, 'blood pressure') || hasMechanism(id, 'heart rate'))
  ) {
    return makeTheoreticalFallbackEvidence(
      'INFERRED',
      'Two blood-pressure / heart-rate active agents create a provisional hemodynamic interaction.',
      'low',
      'The overlap is primarily cardiovascular load and less about a specific neurotransmitter mechanism.',
      'hemodynamic_interaction',
      ['hemodynamic_interaction', 'cardiovascular_load'],
      'Competing autonomic effects are enough to justify a provisional inference.',
      '- Watch for dizziness, palpitations, syncope, or sustained tachycardia.\n- Hydration and dose caution matter more than exact label matching here.',
      'No pair-specific hemodynamic trial data are available.'
    );
  }

  if (
    ids.some((id) => CNS_DEPRESSANT_IDS.has(id)) &&
    ids.some((id) => CNS_DEPRESSANT_IDS.has(id) || NMDA_ANTAGONIST_IDS.has(id))
  ) {
    return makeTheoreticalFallbackEvidence(
      'INFERRED',
      'A CNS-depressant or opioid-like partner with another depressant signal suggests pharmacodynamic CNS depression with possible respiratory involvement.',
      'medium',
      'Sedation, slowed respiration, vomiting, and impaired self-protection can stack even when the exact chemistry differs.',
      'pharmacodynamic_cns_depression',
      ['pharmacodynamic_cns_depression', 'respiratory_depression', 'operational_or_behavioral_risk'],
      'The shared depressant physiology is enough to support a moderate provisional warning.',
      '- Avoid mixing with alcohol, benzodiazepines, or other sedatives.\n- Seek urgent care for slowed breathing, cyanosis, or unresponsiveness.',
      'Pair-specific human data are limited.'
    );
  }

  if (
    ids.some((id) => STIMULANT_IDS.has(id)) &&
    ids.some((id) => STIMULANT_IDS.has(id) || SEROTONERGIC_IDS.has(id))
  ) {
    return makeTheoreticalFallbackEvidence(
      'INFERRED',
      'Stimulant or monoamine-releasing exposure with another activating agent suggests sympathomimetic load or stimulant stacking.',
      'low',
      'Additive catecholaminergic and serotonergic activation can raise heart rate, blood pressure, anxiety, and overheating risk.',
      'sympathomimetic_load',
      ['sympathomimetic_load', 'cardiovascular_load', 'psychiatric_destabilization'],
      'Class-level autonomic activation supports a cautious inference even without pair-specific trials.',
      '- Avoid sleep deprivation, dehydration, and dose escalation.\n- Do not ignore chest pain, severe headache, or confusion.',
      'Specific pair evidence is sparse outside the better-known stimulant combinations.'
    );
  }

  if (ids.some((id) => SEROTONERGIC_IDS.has(id)) && ids.filter((id) => SEROTONERGIC_IDS.has(id)).length > 1) {
    return makeTheoreticalFallbackEvidence(
      'INFERRED',
      'Two serotonergic agents create a provisional serotonergic toxicity or effect-modulation signal.',
      'medium',
      'Combined serotonergic tone can increase the chance of agitation, autonomic load, and serotonin-toxicity features when other drugs are present.',
      'serotonergic_toxicity',
      ['serotonergic_toxicity', 'psychedelic_intensification', 'psychiatric_destabilization'],
      'The serotonergic overlap is strong enough to justify a medium-confidence heuristic.',
      '- Avoid adding more serotonergic drugs.\n- Watch for clonus, tremor, fever, and confusion.',
      'Direct pair-specific data are often missing even when class-level concern is strong.'
    );
  }

  return makeFallbackEvidence(
    'INFERRED',
    'No deterministic mapping was available, so this pair is classified through a conservative rule-based mechanistic inference.',
    'low',
    'The exact mechanism is unresolved; the classification is intentionally provisional.',
    'psychiatric_destabilization',
    ['psychiatric_destabilization', 'operational_or_behavioral_risk'],
    'theoretical',
    'This is a catch-all fallback when no sharper class-level rule is available.',
    '- Treat this as provisional and review the pair manually when higher-quality evidence appears.',
    'No direct pair-specific evidence was loaded.'
  );
};

export const getInteractionEvidence = (drug1: string, drug2: string): InteractionEvidence => {
  return resolveInteraction(drug1, drug2).evidence;
};

export const resolveInteraction = (drug1: string, drug2: string): ResolvedInteraction => {
  const canonicalPairKey = pairKey(drug1, drug2);

  if (drug1 === drug2) {
    return {
      pairKey: canonicalPairKey,
      origin: 'self',
      evidence: {
        code: 'SELF',
        label: LEGEND.SELF.label,
        summary: 'Same entity selected; this is not an interaction pair.',
        confidence: 'n/a',
        sources: 'n/a',
        provenance: {
          source: 'self_pair',
          confidenceTier: 'low',
          rationale: 'Self pairing is not an interaction and is preserved as a non-comparable diagonal case.'
        }
      }
    };
  }

  const explicitEvidence =
    PRIORITY_INTERACTION_RULES[canonicalPairKey] ??
    getAppDatasetRegistry().datasetInteractionRules[canonicalPairKey] ??
    INTERACTION_RULES[canonicalPairKey];
  if (explicitEvidence && explicitEvidence.code !== 'UNK' && explicitEvidence.code !== 'UNKNOWN' && explicitEvidence.sources !== 'source-gap') {
    return {
      pairKey: canonicalPairKey,
      origin: 'explicit',
      evidence: makeDeterministicEvidence(explicitEvidence)
    };
  }

  const theoreticalEvidence = THEORETICAL_INTERACTION_RULES[canonicalPairKey];
  if (theoreticalEvidence) {
    return {
      pairKey: canonicalPairKey,
      origin: 'fallback',
      evidence: theoreticalEvidence
    };
  }

  return {
    pairKey: canonicalPairKey,
    origin: 'fallback',
    evidence: getFallbackInteractionEvidence(drug1, drug2)
  };
};
