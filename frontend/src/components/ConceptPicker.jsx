import { useState, useEffect, useMemo } from 'react';
import { fetchConcepts, createConcept } from '../api/client';
import { CONCEPT_ICONS } from '../utils/constants';
import { Search, Plus, Sparkles, ChevronDown, Check, X, Filter } from 'lucide-react';

const FALLBACK_CONCEPTS = [
  { id: 'specialty-coffee', name: 'Specialty Coffee', description: 'Third-wave, artisan, and single-origin coffee shops', category: 'cafe' },
  { id: 'live-music-venue', name: 'Live Music Venue', description: 'Venues with live music performances and acoustic gigs', category: 'nightlife' },
  { id: 'board-game-cafe', name: 'Board Game Cafe', description: 'Cafes with board games and tabletop gaming', category: 'social' },
  { id: 'bookstore-cafe', name: 'Bookstore Cafe', description: 'Bookstores with cafe / book cafes', category: 'social' },
  { id: 'vegan-restaurant', name: 'Vegan Restaurant', description: 'Plant-based, organic, and clean dining', category: 'dining' },
  { id: 'co-working-cafe', name: 'Co-working Cafe', description: 'Coworking spaces and remote-work-friendly cafes', category: 'cafe' },
  { id: 'craft-brewery', name: 'Craft Brewery', description: 'Microbreweries and craft beer taprooms', category: 'nightlife' },
  { id: 'natural-wine-bar', name: 'Natural Wine Bar', description: 'Natural and organic wine & cocktail bars', category: 'nightlife' },
];

export default function ConceptPicker({ selectedConcept, onConceptSelect }) {
  const [concepts, setConcepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchConcepts()
      .then((data) => {
        if (!cancelled) {
          const list = Array.isArray(data) ? data : data?.concepts || [];
          setConcepts(list.length > 0 ? list : FALLBACK_CONCEPTS);
        }
      })
      .catch(() => {
        if (!cancelled) setConcepts(FALLBACK_CONCEPTS);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Filter concepts based on search query and category
  const filteredConcepts = useMemo(() => {
    let list = concepts;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((c) => {
        const name = (c.name || '').toLowerCase();
        const desc = (c.description || '').toLowerCase();
        const tags = Array.isArray(c.qloo_tags) ? c.qloo_tags.join(' ').toLowerCase() : '';
        return name.includes(q) || desc.includes(q) || tags.includes(q);
      });
    }
    return list;
  }, [concepts, searchQuery]);

  const visibleConcepts = showAll || searchQuery.trim() ? filteredConcepts : filteredConcepts.slice(0, 4);

  // Check if current search matches an existing concept exactly
  const exactMatchExists = useMemo(() => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return concepts.some((c) => (c.name || '').toLowerCase() === q || (c.id || '').toLowerCase() === q);
  }, [concepts, searchQuery]);

  // Handle creating a custom concept
  const handleCreateCustom = async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed || creating) return;

    setCreating(true);
    try {
      const newConcept = await createConcept({
        name: trimmed,
        description: `Custom business concept: ${trimmed}`,
      });

      setConcepts((prev) => [newConcept, ...prev.filter((c) => c.id !== newConcept.id)]);
      onConceptSelect(newConcept.id);
      setSearchQuery('');
    } catch (err) {
      console.error('Failed to create custom concept:', err);
      // Fallback local create
      const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const localConcept = {
        id: slug,
        name: trimmed,
        description: `Custom concept: ${trimmed}`,
        qloo_tags: [trimmed.toLowerCase()],
        saturation: 5,
      };
      setConcepts((prev) => [localConcept, ...prev]);
      onConceptSelect(localConcept.id);
      setSearchQuery('');
    } finally {
      setCreating(false);
    }
  };

  const getIcon = (name) => {
    return CONCEPT_ICONS[name] || '✨';
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <span>Business Concept</span>
          <span className="text-[10px] text-indigo-600 bg-indigo-50 font-medium px-1.5 py-0.2 rounded">
            {concepts.length} Available
          </span>
        </label>
        {selectedConcept && (
          <span className="text-[10px] text-slate-400 font-mono">
            ID: {selectedConcept}
          </span>
        )}
      </div>

      {/* Search Input for Concepts */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
          <Search className="h-3.5 w-3.5 text-slate-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search concepts or type any custom concept..."
          className="w-full text-xs pl-8 pr-7 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder-slate-400"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Custom Concept Creation Card when query has no exact match */}
      {searchQuery.trim() && !exactMatchExists && (
        <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-lg p-2.5 flex items-center justify-between text-xs animate-in fade-in duration-150">
          <div className="space-y-0.5 pr-2">
            <div className="flex items-center gap-1 text-indigo-900 font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
              <span className="truncate">"{searchQuery.trim()}"</span>
            </div>
            <p className="text-[11px] text-indigo-700/80">
              Create custom concept & evaluate with Qloo taste signals
            </p>
          </div>
          <button
            onClick={handleCreateCustom}
            disabled={creating}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium text-[11px] shrink-0 shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
          >
            <Plus className="h-3 w-3" />
            {creating ? 'Adding...' : 'Add & Analyze'}
          </button>
        </div>
      )}

      {/* Concept Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-slate-100 animate-pulse border border-slate-200" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-0.5 custom-scrollbar">
            {visibleConcepts.map((concept) => {
              const name = concept.name || concept.label || concept;
              const id = concept.id || concept.slug || name;
              const icon = getIcon(name);
              const isSelected = selectedConcept === id;

              return (
                <button
                  key={id}
                  onClick={() => onConceptSelect(id)}
                  className={`
                    flex flex-col items-center justify-center gap-1 p-2.5 rounded-lg text-center
                    transition-all duration-150 cursor-pointer border relative text-left group
                    ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200/80 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50/80'
                    }
                  `}
                >
                  {isSelected && (
                    <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                      <Check className="h-2 w-2 stroke-[3]" />
                    </span>
                  )}
                  <span className="text-xl group-hover:scale-110 transition-transform">{icon}</span>
                  <span className={`text-[11px] font-semibold leading-tight line-clamp-1 ${
                    isSelected ? 'text-indigo-800' : 'text-slate-700'
                  }`}>
                    {name}
                  </span>
                  {concept.description && (
                    <span className="text-[9px] text-slate-400 line-clamp-1 leading-none">
                      {concept.description}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {filteredConcepts.length === 0 && !searchQuery.trim() && (
            <p className="text-xs text-slate-400 text-center py-4">No concepts available.</p>
          )}

          {/* Toggle show all / show less */}
          {!searchQuery.trim() && filteredConcepts.length > 4 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium mx-auto pt-1 cursor-pointer transition-colors"
            >
              {showAll ? 'Show fewer options' : `Show all ${filteredConcepts.length} concepts`}
              <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${showAll ? 'rotate-180' : ''}`} />
            </button>
          )}
        </>
      )}
    </div>
  );
}
