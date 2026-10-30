import { useState, useMemo } from 'react';
import { Search, Plus, Sparkles, X, Check, Utensils, Coffee, Wine, Store } from 'lucide-react';

const EXTENDED_CONCEPTS = [
  // Cafes & Coffee
  { id: 'specialty-coffee', name: 'Specialty Coffee', category: 'cafe', icon: '☕' },
  { id: 'bakery-patisserie', name: 'Bakery & Patisserie', category: 'cafe', icon: '🥐' },
  { id: 'boba-bubble-tea', name: 'Boba & Bubble Tea', category: 'cafe', icon: '🧋' },
  { id: 'dessert-gelato', name: 'Artisan Gelato & Desserts', category: 'cafe', icon: '🍨' },
  { id: 'board-game-cafe', name: 'Board Game Cafe', category: 'cafe', icon: '🎲' },
  { id: 'bookstore-cafe', name: 'Bookstore Cafe', category: 'cafe', icon: '📚' },
  { id: 'co-working-cafe', name: 'Co-working Cafe', category: 'cafe', icon: '💻' },
  { id: 'pet-cafe', name: 'Cat & Pet Cafe', category: 'cafe', icon: '🐾' },

  // Food & Dining
  { id: 'chinese-restaurant', name: 'Chinese Restaurant', category: 'food', icon: '🥢' },
  { id: 'italian-trattoria', name: 'Italian Trattoria & Pizzeria', category: 'food', icon: '🍕' },
  { id: 'sushi-bar', name: 'Sushi & Japanese Dining', category: 'food', icon: '🍣' },
  { id: 'ramen-shop', name: 'Authentic Ramen Shop', category: 'food', icon: '🍜' },
  { id: 'mexican-taqueria', name: 'Mexican Taqueria', category: 'food', icon: '🌮' },
  { id: 'vegan-restaurant', name: 'Vegan & Plant-Based Dining', category: 'food', icon: '🥗' },
  { id: 'indian-street-food', name: 'Gourmet Indian Street Food', category: 'food', icon: '🍲' },
  { id: 'burger-diner', name: 'Smash Burger & Craft Shakes', category: 'food', icon: '🍔' },
  { id: 'dim-sum-parlor', name: 'Dim Sum Parlor', category: 'food', icon: '🥟' },
  { id: 'korean-bbq', name: 'Korean BBQ & Fried Chicken', category: 'food', icon: '🍗' },

  // Bars & Nightlife
  { id: 'craft-brewery', name: 'Craft Brewery & Taproom', category: 'bar', icon: '🍺' },
  { id: 'natural-wine-bar', name: 'Natural Wine Bar', category: 'bar', icon: '🍷' },
  { id: 'live-music-venue', name: 'Live Music & Jazz Lounge', category: 'bar', icon: '🎷' },
  { id: 'cocktail-speakeasy', name: 'Speakeasy Cocktail Bar', category: 'bar', icon: '🍸' },
  { id: 'sports-bar', name: 'Sports Bar & Gastro Pub', category: 'bar', icon: '⚽' },
  { id: 'rooftop-lounge', name: 'Rooftop Scenic Lounge', category: 'bar', icon: '🌆' },
];

const CATEGORIES = [
  { id: 'all', label: 'All Concepts' },
  { id: 'cafe', label: '☕ Cafes' },
  { id: 'food', label: '🍽️ Dining' },
  { id: 'bar', label: '🍸 Bars' },
];

export default function ConceptPicker({ selectedConcept, onConceptSelect }) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [customConcepts, setCustomConcepts] = useState([]);

  // Merge presets with any created custom concepts
  const allAvailableConcepts = useMemo(() => {
    return [...customConcepts, ...EXTENDED_CONCEPTS];
  }, [customConcepts]);

  // Find currently selected concept metadata
  const currentConceptObj = useMemo(() => {
    return (
      allAvailableConcepts.find((c) => c.id === selectedConcept) || {
        id: selectedConcept,
        name: selectedConcept.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        icon: '🎯',
      }
    );
  }, [allAvailableConcepts, selectedConcept]);

  // Filtered list based on search and category
  const filteredConcepts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allAvailableConcepts.filter((c) => {
      const matchesCategory = activeCategory === 'all' || c.category === activeCategory;
      const matchesSearch = !q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [allAvailableConcepts, search, activeCategory]);

  // Check if search query exact match exists
  const hasExactMatch = useMemo(() => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return allAvailableConcepts.some((c) => c.name.toLowerCase() === q || c.id.toLowerCase() === q);
  }, [allAvailableConcepts, search]);

  const handleCreateCustom = () => {
    const name = search.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const newConcept = {
      id,
      name,
      category: 'custom',
      icon: '✨',
    };
    setCustomConcepts((prev) => [newConcept, ...prev]);
    onConceptSelect(id);
    setSearch('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredConcepts.length > 0) {
        onConceptSelect(filteredConcepts[0].id);
        setSearch('');
      } else if (!hasExactMatch && search.trim()) {
        handleCreateCustom();
      }
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
          <Store className="h-3.5 w-3.5 text-indigo-600" />
          Business Concept
        </label>
        {currentConceptObj && (
          <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full flex items-center gap-1">
            <span>{currentConceptObj.icon}</span>
            <span className="truncate max-w-[150px]">{currentConceptObj.name}</span>
          </span>
        )}
      </div>

      {/* Search Bar for Concepts */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search or type ANY concept (e.g. Chinese, Boba, Bakery)..."
          className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300 transition-all"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Category Filter Chips */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap transition-all cursor-pointer ${
              activeCategory === cat.id
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Custom Concept Prompt if not matching */}
      {!hasExactMatch && search.trim() && (
        <button
          onClick={handleCreateCustom}
          className="w-full flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 text-xs text-indigo-700 hover:border-indigo-400 transition-all cursor-pointer shadow-2xs group"
        >
          <div className="flex items-center gap-1.5 font-medium">
            <Sparkles className="h-3.5 w-3.5 text-indigo-600 group-hover:rotate-12 transition-transform" />
            <span>Search custom: <strong>&ldquo;{search.trim()}&rdquo;</strong></span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 bg-indigo-600 text-white rounded font-medium">
            Select
          </span>
        </button>
      )}

      {/* Grid of Concept Chips */}
      <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1 sidebar-scroll">
        {filteredConcepts.map((concept) => {
          const isSelected = selectedConcept === concept.id;
          return (
            <button
              key={concept.id}
              onClick={() => onConceptSelect(concept.id)}
              className={`flex items-center gap-2 p-2 rounded-lg text-left transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-400 shadow-2xs'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
              }`}
            >
              <span className="text-base shrink-0">{concept.icon || '📍'}</span>
              <div className="truncate flex-1">
                <p className={`text-[11px] font-medium leading-tight truncate ${
                  isSelected ? 'text-indigo-900 font-semibold' : 'text-slate-700'
                }`}>
                  {concept.name}
                </p>
              </div>
              {isSelected && <Check className="h-3 w-3 text-indigo-600 shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
