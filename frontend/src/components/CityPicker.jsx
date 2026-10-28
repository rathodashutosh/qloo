import { CITIES } from '../utils/constants';
import { MapPin, X } from 'lucide-react';

/**
 * City picker with preset chips and text input.
 */
export default function CityPicker({ selectedCity, onCitySelect }) {
  const cityNames = Object.keys(CITIES);

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
        City
      </label>

      {/* Chip buttons for preset cities */}
      <div className="flex flex-wrap gap-1.5">
        {cityNames.map((name) => {
          const isSelected = selectedCity === name;
          return (
            <button
              key={name}
              onClick={() => onCitySelect(name)}
              className={`
                inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium
                transition-all duration-150 cursor-pointer border
                ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
                }
              `}
            >
              <MapPin className="h-3 w-3" />
              {name}
              {isSelected && (
                <X
                  className="h-3 w-3 ml-0.5 opacity-70 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCitySelect(name); // toggle stays selected
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
