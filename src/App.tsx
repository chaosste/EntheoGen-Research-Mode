/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef, useId } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Circle,
  Heart,
  XCircle,
  Info,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Menu,
  X,
  Sparkles,
  Star,
  Trash2,
  ChevronDown,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import {
  getDRUGS,
  LEGEND,
  type MechanismCategory
} from './data/drugData';
import { getAllUIInteractions, getUIInteraction } from './data/uiInteractions';
import type { UIInteraction } from './data/uiInteractions';
import ResearchModePanel from './components/ResearchModePanel';
import {
  filterInteractionsForResearchMode,
  hasActiveResearchModeFilters,
  type ResearchModeFilters
} from './data/researchMode';
import { getInteractionExplanation, getDrugSummary } from './services/ruleBasedReadoutService';
import logoVine from './assets/logo-vine.png';
import referencesMd from '../knowledge-base/sources/Reference_List.md?raw';

// --- Components ---

interface SearchableSelectProps {
  labelId: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
}

function SearchableSelect({
  labelId,
  label,
  value,
  onChange,
  isOpen,
  onOpenChange,
  disabled,
  placeholder
}: SearchableSelectProps) {
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const comboboxId = useId();
  const listboxId = `${comboboxId}-listbox`;

  const filteredDrugs = useMemo(() => {
    return getDRUGS().filter(drug =>
      !drug.deprecated &&
      (drug.name.toLowerCase().includes(search.toLowerCase()) ||
        drug.class.toLowerCase().includes(search.toLowerCase()))
    );
  }, [search]);

  const selectedDrug = useMemo(() => getDRUGS().find(d => d.id === value), [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onOpenChange]);

  useEffect(() => {
    if (isOpen) {
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    setSearch('');
  }, [isOpen]);

  const inputValue = isOpen ? search : selectedDrug?.name ?? '';
  const activeDrug = filteredDrugs[activeIndex];
  const activeOptionId = activeDrug ? `${comboboxId}-option-${activeDrug.id}` : undefined;

  const openDropdown = () => {
    if (disabled) return;
    setSearch('');
    setActiveIndex(0);
    onOpenChange(true);
  };

  const toggleDropdown = () => {
    if (disabled) return;

    if (isOpen) {
      onOpenChange(false);
      return;
    }

    openDropdown();
  };

  const selectDrug = (drugId: string) => {
    onChange(drugId);
    onOpenChange(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen) {
        openDropdown();
        return;
      }
      setActiveIndex((current) => Math.min(current + 1, Math.max(filteredDrugs.length - 1, 0)));
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        openDropdown();
        return;
      }
      setActiveIndex((current) => Math.max(current - 1, 0));
    }

    if (event.key === 'Enter') {
      if (!isOpen) {
        event.preventDefault();
        openDropdown();
        return;
      }
      if (activeDrug) {
        event.preventDefault();
        selectDrug(activeDrug.id);
      }
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      onOpenChange(false);
    }
  };

  return (
    <div className="space-y-2 relative" ref={containerRef}>
      <label id={labelId} className="ml-1 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]/95">
        {label}
      </label>
      <div className="w-full glass-panel rounded-2xl px-4 sm:px-5 lg:px-4 py-3.5 sm:py-4 flex items-center gap-3 focus-within:ring-1 focus-within:ring-white/20 transition-all disabled:opacity-50">
        <input
          ref={inputRef}
          id={comboboxId}
          type="text"
          role="combobox"
          aria-labelledby={labelId}
          aria-controls={listboxId}
          aria-expanded={isOpen}
          aria-activedescendant={isOpen ? activeOptionId : undefined}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          autoComplete="off"
          disabled={disabled}
          value={inputValue}
          onFocus={() => {
            if (!isOpen) openDropdown();
          }}
          onChange={(event) => {
            if (!isOpen) onOpenChange(true);
            setSearch(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full min-w-0 bg-transparent border-none outline-none text-sm sm:text-base lg:text-[0.95rem] leading-tight placeholder:text-[var(--text-muted)] placeholder:italic placeholder:text-sm sm:placeholder:text-base lg:placeholder:text-[0.95rem] ${selectedDrug && !isOpen ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-muted)] italic'}`}
        />
        <button
          type="button"
          onClick={toggleDropdown}
          disabled={disabled}
          aria-label={`${isOpen ? 'Close' : 'Open'} ${label}`}
          aria-expanded={isOpen}
          aria-controls={listboxId}
          className="shrink-0 rounded-full p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] disabled:cursor-not-allowed"
        >
          <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(10px)' }}
            transition={{ duration: 0.2 }}
            className="absolute z-40 top-full left-0 right-0 mt-2 glass-panel rounded-2xl overflow-hidden"
          >
            <div
              id={listboxId}
              role="listbox"
              aria-label={`${label} options`}
              className="max-h-60 overflow-y-auto custom-scrollbar bg-black/40"
            >
              {filteredDrugs.length > 0 ? (
                filteredDrugs.map((drug, index) => (
                  <button
                    id={`${comboboxId}-option-${drug.id}`}
                    key={drug.id}
                    type="button"
                    role="option"
                    aria-selected={value === drug.id}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectDrug(drug.id)}
                    className={`w-full text-left px-5 py-3 hover:bg-white/5 transition-colors flex flex-col gap-1 border-b border-white/5 last:border-0 ${value === drug.id ? 'bg-white/10' : ''} ${activeIndex === index ? 'bg-white/5' : ''}`}
                  >
                    <span className="font-medium text-sm text-[var(--text-primary)]">{drug.name}</span>
                    <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-muted)] font-semibold">{drug.class}</span>
                  </button>
                ))
              ) : (
                <div className="px-4 py-8 text-center text-black/40 text-sm italic">
                  No drugs found matching "{search}"
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Main App ---

const MECHANISM_FAMILY_LABELS: Partial<Record<MechanismCategory, string>> = {
  serotonergic: 'Serotonergic',
  maoi: 'MAOI-mediated',
  qt_prolongation: 'QT / rhythm load',
  sympathomimetic: 'Sympathomimetic',
  cns_depressant: 'CNS depressant',
  pharmacodynamic_cns_depression: 'Pharmacodynamic CNS depression',
  anticholinergic: 'Anticholinergic',
  dopaminergic: 'Dopaminergic',
  glutamatergic: 'Glutamatergic',
  glutamate_modulation: 'Glutamate modulation',
  gabaergic: 'GABAergic',
  stimulant_stack: 'Stimulant stack',
  psychedelic_potentiation: 'Psychedelic potentiation',
  cardiovascular_load: 'Cardiovascular load',
  hemodynamic_interaction: 'Hemodynamic interaction',
  noradrenergic_suppression: 'Noradrenergic suppression',
  ion_channel_modulation: 'Ion-channel modulation'
};

const getMechanismFamilyLabel = (
  mechanismCategory?: MechanismCategory | null
) => {
  if (!mechanismCategory || mechanismCategory === 'unknown') {
    return null;
  }

  return MECHANISM_FAMILY_LABELS[mechanismCategory] ?? null;
};

export default function App() {
  const [drug1, setDrug1] = useState<string>('');
  const [drug2, setDrug2] = useState<string>('');
  const [showResult, setShowResult] = useState(false);
  const [explanation, setExplanation] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openSelect, setOpenSelect] = useState<'drug1' | 'drug2' | null>(null);
  const [favorites, setFavorites] = useState<{ id: string, d1: string, d2: string, code: string }[]>([]);
  const [showReferences, setShowReferences] = useState(false);
  const [lastSynthPairKey, setLastSynthPairKey] = useState<string>('');
  const [researchFilters, setResearchFilters] = useState<ResearchModeFilters>({
    showLowConfidence: false,
    showInferredOrTheoretical: false,
    showEvidenceGaps: false
  });
  const favoritesStorageKey = 'entheogen_favorites';
  const currentPairKey = useMemo(() => [drug1 || '', drug2 || ''].sort().join('|'), [drug1, drug2]);

  // Load favorites
  useEffect(() => {
    const saved =
      localStorage.getItem(favoritesStorageKey) ||
      localStorage.getItem('seshguard_favorites');
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse favorites");
      }
    }
  }, []);

  // Save favorites
  useEffect(() => {
    localStorage.setItem(favoritesStorageKey, JSON.stringify(favorites));
  }, [favorites]);

  const resolvedInteraction = useMemo(() => {
    if (!drug1 || !drug2) return null;
    return getUIInteraction(drug1, drug2);
  }, [drug1, drug2]);

  const mechanismFamilyLabel = useMemo(() => {
    if (!resolvedInteraction || resolvedInteraction.isSelfPair) return null;
    return getMechanismFamilyLabel(resolvedInteraction.mechanismCategory as MechanismCategory);
  }, [resolvedInteraction]);

  const interactionCode = resolvedInteraction?.riskLabel || null;

  const interaction = useMemo(() => {
    if (!interactionCode) return null;
    return LEGEND[interactionCode];
  }, [interactionCode]);

  const researchModeInteractions = useMemo(
    () => getAllUIInteractions(),
    []
  );

  const filteredResearchInteractions = useMemo(
    () => filterInteractionsForResearchMode(researchModeInteractions, researchFilters),
    [researchModeInteractions, researchFilters]
  );

  const visibleResearchInteractions = useMemo(
    () => filteredResearchInteractions.slice(0, 24),
    [filteredResearchInteractions]
  );
  const isResearchModeActive = hasActiveResearchModeFilters(researchFilters);
  const currentReferencesMd = useMemo(
    () => referencesMd.replace(/^Reference List\s*\n+/i, ''),
    []
  );

  const isFavorited = useMemo(() => {
    if (!drug1 || !drug2) return false;
    const id = [drug1, drug2].sort().join('-');
    return favorites.some(f => f.id === id);
  }, [drug1, drug2, favorites]);

  const toggleFavorite = () => {
    if (!drug1 || !drug2 || !interactionCode || interactionCode === 'SELF') return;
    const id = [drug1, drug2].sort().join('-');

    if (isFavorited) {
      setFavorites(favorites.filter(f => f.id !== id));
    } else {
      setFavorites([...favorites, {
        id,
        d1: drug1,
        d2: drug2,
        code: interactionCode
      }]);
    }
  };

  const handleFindOut = async (overrideDrug1?: string, overrideDrug2?: string) => {
    const selectedDrug1 = overrideDrug1 ?? drug1;
    const selectedDrug2 = overrideDrug2 ?? drug2;
    if (!selectedDrug1 && !selectedDrug2) return;
    setShowResult(true);
    setIsLoadingExplanation(true);
    setIsLoadingSummary(true);
    setError(null);
    setExplanation('');
    setSummary('');
    setLastSynthPairKey([selectedDrug1 || '', selectedDrug2 || ''].sort().join('|'));

    const localResolvedInteraction = selectedDrug1 && selectedDrug2
      ? getUIInteraction(selectedDrug1, selectedDrug2)
      : null;
    const localMechanismCategory = localResolvedInteraction?.mechanismCategory;
    const localInteractionCode = localResolvedInteraction?.riskLabel || null;
    const localInteraction = localInteractionCode ? LEGEND[localInteractionCode] : null;

    const d1Obj = getDRUGS().find(d => d.id === selectedDrug1);
    const d2Obj = getDRUGS().find(d => d.id === selectedDrug2);
    const d1Name = d1Obj?.name || selectedDrug1;
    const d2Name = d2Obj?.name || selectedDrug2;

    try {
      // Evidence-grounded interaction explanation for paired selections.
      if (selectedDrug1 && selectedDrug2 && localInteraction && localResolvedInteraction) {
        const interactionReadout = await getInteractionExplanation(
          d1Name,
          d2Name,
          localResolvedInteraction.riskDisplayLabel,
          localResolvedInteraction.headline,
          {
            confidence: localResolvedInteraction.confidenceLabel,
            riskScale: localInteraction.riskScale,
            mechanismCategory: localMechanismCategory as MechanismCategory | undefined,
            fieldNotes: localResolvedInteraction.notes
          }
        );
        setExplanation(interactionReadout);
      }
      setIsLoadingExplanation(false);

      // Rule-based summary (single or combined).
      const targetDrug1 = selectedDrug1 ? d1Name : d2Name;
      const targetDrug2 = (selectedDrug1 && selectedDrug2) ? d2Name : undefined;
      const profile = await getDrugSummary(targetDrug1, targetDrug2, {
        confidence: localResolvedInteraction?.confidenceLabel,
        riskScale: localInteraction?.riskScale,
        mechanismCategory: localMechanismCategory as MechanismCategory | undefined,
        fieldNotes: localResolvedInteraction?.notes
      });
      setSummary(profile);
    } catch (err) {
      console.error("Readout error:", err);
      setError("We couldn't build the rule-based readout. Please retry.");
    }
    setIsLoadingSummary(false);
  };

  const handleReset = () => {
    setDrug1('');
    setDrug2('');
    setOpenSelect(null);
    setShowResult(false);
    setExplanation('');
    setSummary('');
    setError(null);
    setLastSynthPairKey('');
  };

  const isReadoutStale = showResult && currentPairKey !== lastSynthPairKey;

  const getIcon = (symbol: string) => {
    switch (symbol) {
      case 'UP': return <ArrowUp className="w-8 h-8" />;
      case 'CIRCLE': return <Circle className="w-8 h-8" />;
      case 'DOWN': return <ArrowDown className="w-8 h-8" />;
      case 'WARN': return <AlertTriangle className="w-8 h-8" />;
      case 'HEART': return <Heart className="w-8 h-8" />;
      case 'X': return <XCircle className="w-8 h-8" />;
      case 'INFO': return <Info className="w-8 h-8" />;
      default: return <Sparkles className="w-8 h-8" />;
    }
  };

  return (
    <div className="min-h-screen bg-noise relative overflow-x-hidden">
      {/* Abstract background glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-900/20 blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] right-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-900/10 blur-[150px] pointer-events-none" />

      {/* Navigation */}
      <nav className="fixed w-full z-50 top-0 glass-panel border-x-0 border-t-0 py-4 px-6 md:px-8 flex justify-between items-center bg-black/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-900/40 border border-emerald-500/20 rounded-xl flex items-center justify-center backdrop-blur-md shadow-lg overflow-hidden">
            <img
              src={logoVine}
              alt="EntheoGen logo"
              width={34}
              height={34}
              style={{ filter: 'invert(1) sepia(0.3) saturate(1.5) brightness(0.9)', mixBlendMode: 'screen' }}
            />
          </div>
          <span className="text-xl font-bold tracking-widest text-white/90">EntheoGen</span>
        </div>
        <div className="flex items-center gap-4">
          {favorites.length > 0 && (
            <button
              onClick={() => setIsMenuOpen(true)}
              className="relative p-2 hover:bg-black/5 rounded-full transition-colors"
            >
              <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />
              <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full font-bold">
                {favorites.length}
              </span>
            </button>
          )}
          <button
            onClick={() => setIsMenuOpen(true)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/80 hover:text-white"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 pt-24 sm:pt-28 md:pt-32 pb-20 relative z-10">
        <section className="mb-8 rounded-2xl border border-emerald-400/20 bg-emerald-950/20 px-5 py-4 text-sm text-white/85 shadow-[0_0_40px_rgba(16,185,129,0.08)]">
          <p className="font-semibold">
            Private Student Project Beta Test Version. Not medical advice.
            {' '}
            Information:{' '}
            <a
              href="https://github.com/EntheoGen-Development-Hub"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-emerald-200 underline decoration-emerald-300/40 underline-offset-4 hover:text-white"
            >
              Here
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </p>
        </section>

        <header className="max-w-2xl mx-auto text-center mb-10 sm:mb-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md mb-6 sm:mb-8 text-[11px] sm:text-xs font-medium tracking-[0.22em] uppercase text-[var(--text-muted)]"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Entheogenic Interaction Guidance
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black mb-4 sm:mb-6 tracking-tighter leading-[0.95] sm:leading-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-white/90 to-white/40"
          >
            EntheoGen<br />Plant Medicine<br />Interaction Guide
          </motion.h1>
        </header>

        <section className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
          <div className="grid 2xl:grid-cols-2 gap-5 sm:gap-6">
            <SearchableSelect
              labelId="drug1-label"
              label="Choose first substance class"
              value={drug1}
              onChange={setDrug1}
              isOpen={openSelect === 'drug1'}
              onOpenChange={(isOpen) =>
                setOpenSelect((current) => (isOpen ? 'drug1' : current === 'drug1' ? null : current))
              }
              placeholder="Select sacrament, substance, or medication."
            />
            <SearchableSelect
              labelId="drug2-label"
              label="Choose second substance class"
              value={drug2}
              onChange={setDrug2}
              isOpen={openSelect === 'drug2'}
              onOpenChange={(isOpen) =>
                setOpenSelect((current) => (isOpen ? 'drug2' : current === 'drug2' ? null : current))
              }
              placeholder="Select sacrament, substance, or medication."
            />
          </div>

          <div className="flex flex-col gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => void handleFindOut()}
              disabled={!drug1 && !drug2}
              className="w-full relative group overflow-hidden rounded-2xl p-[1px] disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-emerald-500/50 via-indigo-500/50 to-emerald-500/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-md"></span>
              <div className="relative bg-white/10 hover:bg-white/15 border border-white/20 backdrop-blur-xl rounded-2xl py-5 flex items-center justify-center gap-3 transition-colors duration-300">
                <span className="text-lg font-bold tracking-[0.2em] text-white uppercase">Synthesize</span>
                <Sparkles className="w-5 h-5 text-emerald-400 group-hover:animate-pulse" />
              </div>
            </motion.button>
            {showResult && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleReset}
                className="w-full border border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 rounded-2xl py-5 text-sm font-bold tracking-[0.2em] text-[var(--text-muted)] hover:text-white uppercase flex items-center justify-center gap-3 transition-all backdrop-blur-md"
              >
                <RefreshCw className="w-4 h-4" />
                Reset Canvas
              </motion.button>
            )}
          </div>
        </section>

        {/* Results Area */}
        <AnimatePresence>
          {showResult && (drug1 || drug2) && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto mt-12 space-y-8"
            >
              {interaction && (
                <div
                  className="rounded-[2rem] p-[2px] relative overflow-hidden group shadow-2xl"
                >
                  {isReadoutStale && (
                    <div className="absolute z-20 top-4 left-1/2 -translate-x-1/2 rounded-full border border-amber-400/40 bg-amber-500/15 px-4 py-1.5 text-[11px] uppercase tracking-[0.14em] font-semibold text-amber-200">
                      Pair changed. Press Synthesize to refresh this readout.
                    </div>
                  )}
                  {/* Glowing border effect */}
                  <div className="absolute inset-0 opacity-50 transition-opacity duration-1000 group-hover:opacity-100" style={{ background: `linear-gradient(135deg, ${interaction.color}40, transparent, ${interaction.color}40)` }}></div>

                  <div className="relative glass-panel rounded-[calc(2rem-2px)] p-8 md:p-12 overflow-hidden bg-black/60">
                    {/* Background glow radiating from bottom */}
                    <div
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-[150%] aspect-square rounded-full opacity-10 blur-3xl pointer-events-none"
                      style={{ backgroundColor: interaction.color }}
                    />

                    <div className="relative z-10 flex flex-col items-center text-center">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", damping: 15 }}
                        className="mb-8 p-5 rounded-2xl backdrop-blur-xl border border-white/20 shadow-[0_0_30px_rgba(0,0,0,0.5)]"
                        style={{ backgroundColor: `${interaction.color}20`, color: interaction.color }}
                      >
                        {getIcon(interaction.symbol)}
                      </motion.div>
                      <h2 className="text-3xl md:text-4xl font-black mb-4 uppercase tracking-tight">
                        {interaction.label}
                      </h2>
                      <p className="text-lg md:text-xl opacity-90 max-w-md leading-relaxed mb-8">
                        {interaction.description}
                      </p>

                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={toggleFavorite}
                        className={`flex items-center gap-2 mt-4 px-6 py-3 rounded-full border transition-all duration-300 ${isFavorited ? 'bg-white/10 border-white/30 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'}`}
                      >
                        <Star className={`w-4 h-4 ${isFavorited ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                        <span className="text-xs font-bold uppercase tracking-[0.15em]">
                          {isFavorited ? 'Saved to Favourites' : 'Add to Favourites'}
                        </span>
                      </motion.button>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Interaction Insight (Only if 2 drugs) */}
              {drug1 && drug2 && interaction && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="glass-panel rounded-[2rem] p-8 md:p-10 relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                  <div className="flex items-center justify-between mb-8 relative z-10 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3 text-indigo-400">
                      <Sparkles className={`w-5 h-5 ${isLoadingExplanation ? 'animate-pulse' : ''}`} />
                      <span className="text-xs font-bold uppercase tracking-[0.2em]">Evidence Snapshot</span>
                    </div>
                    {isLoadingExplanation && (
                      <div className="flex gap-1">
                        <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                        <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.3 }} className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                        <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.6 }} className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                      </div>
                    )}
                  </div>

                  <div className="relative z-10 mb-6 flex flex-wrap gap-2">
                    {resolvedInteraction?.confidenceLabel && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        <ShieldAlert className="w-3.5 h-3.5 text-indigo-300" />
                        Confidence: {resolvedInteraction.confidenceLabel.toUpperCase()}
                      </span>
                    )}
                    {mechanismFamilyLabel && (
                      <span className="inline-flex items-center rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-200">
                        Mechanism family: {mechanismFamilyLabel}
                      </span>
                    )}
                  </div>

                  {isLoadingExplanation ? (
                    <div className="space-y-4 relative z-10 opacity-50">
                      <div className="h-4 bg-white/10 rounded w-3/4 animate-pulse"></div>
                      <div className="h-4 bg-white/10 rounded w-full animate-pulse delay-75"></div>
                      <div className="h-4 bg-white/10 rounded w-5/6 animate-pulse delay-150"></div>
                    </div>
                  ) : (
                    <div className="markdown-body">
                      <Markdown>{explanation}</Markdown>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Detailed Summary */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass-panel rounded-[2rem] p-8 md:p-10 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] -translate-y-1/2 -translate-x-1/2 pointer-events-none" />

                <div className="flex items-center justify-between mb-8 relative z-10 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3 text-emerald-400">
                    <Info className={`w-5 h-5 ${isLoadingSummary ? 'animate-pulse' : ''}`} />
                    <span className="text-xs font-bold uppercase tracking-[0.2em]">Rule-Based Context</span>
                  </div>
                  {isLoadingSummary && (
                    <div className="flex gap-1">
                      <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-emerald-600 rounded-full" />
                      <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-emerald-600 rounded-full" />
                      <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-emerald-600 rounded-full" />
                    </div>
                  )}
                </div>

                {isLoadingSummary ? (
                  <div className="space-y-4 relative z-10 opacity-50">
                    <motion.div
                      initial={{ x: '-100%' }}
                      animate={{ x: '100%' }}
                      transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                      className="absolute top-0 left-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent w-full"
                    />
                    <div className="h-4 bg-white/10 rounded w-3/4 animate-pulse"></div>
                    <div className="h-4 bg-white/10 rounded w-full animate-pulse delay-75"></div>
                    <div className="h-4 bg-white/10 rounded w-5/6 animate-pulse delay-150"></div>
                    <div className="h-4 bg-white/10 rounded w-2/3 animate-pulse delay-200"></div>
                  </div>
                ) : error ? (
                  <div className="flex items-start gap-4 p-6 bg-red-950/30 rounded-2xl border border-red-900/50 relative z-10">
                    <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-red-200/90 text-sm font-medium leading-relaxed">
                      {error}
                    </p>
                  </div>
                ) : (
                  <div className="markdown-body">
                    <Markdown>{summary}</Markdown>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mx-auto mt-24 max-w-xl text-center text-sm sm:text-base italic text-[var(--text-primary)]/75">
          Local browser storage is used for favourites only. Third-party hosting providers may still process network logs.
        </p>

        <ResearchModePanel
          filters={researchFilters}
          onChange={setResearchFilters}
        />

        {isResearchModeActive && (
          <section className="max-w-4xl mx-auto mt-8">
            {visibleResearchInteractions.length === 0 ? (
              <p className="text-center text-sm text-[var(--text-muted)] border border-white/10 rounded-2xl px-4 py-6 bg-white/5">
                No interactions match the current research filters.
              </p>
            ) : (
              <div className="grid gap-3">
                {visibleResearchInteractions.map((item: UIInteraction) => (
                  <article
                    key={item.id}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <div className="text-sm font-semibold text-[var(--text-primary)]">
                      {item.substanceA} + {item.substanceB}
                    </div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">
                      Risk: {item.riskDisplayLabel} | Mechanism: {item.mechanismDisplayLabel} | Confidence: {item.confidenceLabel}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        <footer className="max-w-2xl mx-auto mt-32 pt-12 border-t border-white/5 text-center relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12">
            <a
              href="https://www.newpsychonaut.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-white transition-colors"
            >
              <span className="border-b border-transparent group-hover:border-white/30 transition-colors pb-0.5">NewPsychonaut (NeuroPhenom + research projects)</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
            </a>
            <a
              href="https://www.newpsychonaut.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-white transition-colors"
            >
              <span className="border-b border-transparent group-hover:border-white/30 transition-colors pb-0.5">Citizen science pathway</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
            </a>
            <a
              href="https://x.com/newpsychonaut"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-white transition-colors"
            >
              <span className="border-b border-transparent group-hover:border-white/30 transition-colors pb-0.5">@newpsychonaut on X</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
            </a>
            <a
              href="https://www.instagram.com/newpsychonaut/"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-white transition-colors"
            >
              <span className="border-b border-transparent group-hover:border-white/30 transition-colors pb-0.5">@newpsychonaut on Instagram</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
            </a>
          </div>
        </footer>
      </main>

      {/* Sidebar/Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-[#0a140f] border-l border-white/10 z-[70] shadow-2xl p-8 overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-center mb-12">
                <h2 className="text-xl font-bold tracking-widest uppercase text-white/90">Menu</h2>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/80 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-12">
                {/* Favorites Section */}
                {favorites.length > 0 && (
                  <section className="space-y-6">
                    <div className="flex items-center gap-3 text-yellow-500/80 border-b border-white/5 pb-3">
                      <Star className="w-4 h-4 fill-current" />
                      <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">Favourite Interactions</h3>
                    </div>
                    <div className="grid gap-3">
                      {favorites.map(fav => {
                        const d1Name = getDRUGS().find(d => d.id === fav.d1)?.name || fav.d1;
                        const d2Name = getDRUGS().find(d => d.id === fav.d2)?.name || fav.d2;
                        const inter = LEGEND[fav.code];
                        return (
                          <div
                            key={fav.id}
                            className="group flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/20 transition-all hover:bg-white/10"
                          >
                            <button
                              onClick={() => {
                                setDrug1(fav.d1);
                                setDrug2(fav.d2);
                                setShowResult(true);
                                setIsMenuOpen(false);
                                handleFindOut(fav.d1, fav.d2);
                              }}
                              className="flex-1 text-left"
                            >
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="font-medium text-sm text-[var(--text-primary)]">{d1Name} + {d2Name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: inter?.color, color: inter?.color }} />
                                <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)]">{inter?.label}</span>
                              </div>
                            </button>
                            <button
                              onClick={() => setFavorites(favorites.filter(f => f.id !== fav.id))}
                              className="p-2 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                <section className="space-y-5 bg-white/5 p-6 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3 text-red-400 mb-2">
                    <ShieldAlert className="w-5 h-5" />
                    <h3 className="text-sm font-bold uppercase tracking-[0.2em]">Important</h3>
                  </div>
                  <div className="space-y-4 text-[var(--text-muted)] text-sm leading-relaxed">
                    <p className="font-semibold text-[var(--text-primary)]">This app provides educational harm-reduction guidance, not medical advice.</p>
                    <p>Interaction ratings are derived from a curated, evidence-gated dataset with explicit uncertainty and known gaps.</p>
                    <p>All claims are traceable to source material. See References for full citations.</p>
                    <p className="italic text-red-300/80">If you suspect toxicity, serotonin syndrome, or hypertensive crisis, seek urgent medical help.</p>
                  </div>
                </section>

                <section className="space-y-6">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)] border-b border-white/5 pb-3">Current Reference List</h3>
                  <div className="space-y-4">
                    <div className="px-2 text-sm text-[var(--text-muted)]">
                      <p className="mb-2 font-semibold text-[var(--text-primary)]">Key Sources:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Malcolm (2023)</li>
                        <li>Halman et al. (2023)</li>
                        <li>Ruffell et al. (2020)</li>
                      </ul>
                    </div>
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        setShowReferences(true);
                      }}
                      className="w-full flex justify-between items-center p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group text-left"
                    >
                      <span className="font-semibold text-white/90">Open Current Reference List</span>
                      <ExternalLink className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </div>
                </section>

                <section className="space-y-6">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)] border-b border-white/5 pb-3">Useful Links</h3>
                  <div className="grid gap-3">
                    {[
                      { name: 'Crisis Help UK', url: 'https://thatsmental.co.uk/crisis' },
                      { name: 'Drug Science', url: 'https://www.drugscience.org.uk/' },
                      { name: 'PsyCare', url: 'https://www.psycareuk.org/psychedelic-support' },
                      { name: 'Zendo Project', url: 'https://zendoproject.org/' },
                      { name: '@newpsychonaut on X', url: 'https://x.com/newpsychonaut' },
                      { name: '@newpsychonaut on Instagram', url: 'https://www.instagram.com/newpsychonaut/' }
                    ].map(link => (
                      <a
                        key={link.name}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex justify-between items-center p-4 rounded-2xl bg-black/5 hover:bg-black/10 transition-colors group"
                      >
                        <span className="font-semibold">{link.name}</span>
                        <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    ))}
                  </div>
                </section>

                <section className="pt-8 border-t border-black/5">
                  <p className="text-xs text-black/40 text-center">
                    EntheoGen v0.2 • Ceremonial Interaction Guidance
                  </p>
                </section>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* References Modal */}
      <AnimatePresence>
        {showReferences && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReferences(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[80]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 md:inset-x-auto md:w-[800px] top-[10%] bottom-[10%] max-w-full mx-auto bg-[#0a140f] border border-white/10 z-[90] shadow-2xl rounded-3xl overflow-hidden flex flex-col"
            >
              <div className="flex justify-between items-center p-6 border-b border-white/10 bg-black/20">
                <h2 className="text-xl font-bold tracking-widest uppercase text-white/90">Current Reference List</h2>
                <button
                  onClick={() => setShowReferences(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/80 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                <div className="markdown-body">
                  {/* Markdown rendered directly via vite ?raw string import */}
                  <Markdown
                    components={{
                      h1: () => null,
                      a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" />
                    }}
                  >
                    {currentReferencesMd}
                  </Markdown>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
