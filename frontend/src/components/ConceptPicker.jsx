import { useState, useEffect } from 'react';
import { fetchConcepts } from '../api/client';
import { CONCEPT_ICONS } from '../utils/constants';
import { ChevronDown } from 'lucide-react';

/**
 * ConceptPicker — shows concepts as icon cards or as a compact dropdown.
 * Fetches from API, falls back to a static list if API is unavailable.
 */

const FALLBACK_CONCEPTS = [
  { id: 'specialty-coffee', name: 'Specialty Coffee' },
  { id: 'live-music-venue', name: 'Live Music Venue' },
  { id: 'board-game-cafe', name: 'Board Game Cafe' },
  { id: 'bookstore-cafe', name: 'Bookstore Cafe' },
  { id: 'vegan-restaurant', name: 'Vegan Restaurant' },
  { id: 'co-working-cafe', name: 'Co-working Cafe' },
  { id: 'craft-brewery', name: 'Craft Brewery' },
  { id: 'natural-wine-bar', name: 'Natural Wine Bar' },
];

export default function ConceptPicker({ selectedConcept, onConceptSelect }) {
  const [concepts, setConcepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

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

  const visibleConcepts = showAll ? concepts : concepts.slice(0, 4);

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
        Concept
      </label>

      {loading ? (
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-16 rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {visibleConcepts.map((concept) => {
              const name = concept.name || concept.label || concept;
              const id = concept.id || concept.slug || name;
              const icon = CONCEPT_ICONS[name] || '🔍';
              const isSelected = selectedConcept === id;

              return (
                <button
                  key={id}
                  onClick={() => onConceptSelect(id)}
                  className={`
                    flex flex-col items-center justify-center gap-1 p-3 rounded-lg text-center
                    transition-all duration-150 cursor-pointer border
                    ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-200 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm'
                    }
                  `}
                >
                  <span className="text-xl">{icon}</span>
                  <span className={`text-[11px] font-medium leading-tight ${
                    isSelected ? 'text-indigo-700' : 'text-slate-600'
                  }`}>
                    {name}
                  </span>
                </button>
              );
            })}
          </div>

          {concepts.length > 4 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium mx-auto cursor-pointer"
            >
              {showAll ? 'Show less' : `Show all ${concepts.length}`}
              <ChevronDown className={`h-3 w-3 transition-transform ${showAll ? 'rotate-180' : ''}`} />
            </button>
          )}
        </>
      )}
    </div>
  );
}
