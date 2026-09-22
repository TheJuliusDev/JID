import React, { useState, useMemo } from 'react';
import { PropertyListing } from '../../types';
import { BRAND_CONFIG } from '../../config/brand';
import { useData } from '../../context/DataContext';
import { PropertyCard } from './PropertyCard';
import { PropertyDetailModal } from './PropertyDetailModal';
import { 
  Search, 
  Home, 
  SlidersHorizontal, 
  PlusCircle, 
  X, 
  MapPin, 
  Droplets, 
  ArrowUpDown,
  Building,
  ShieldAlert
} from 'lucide-react';

interface AccommodationExplorerProps {
  onOpenCreateListing: () => void;
  onStartChat: (landlord: any, property: PropertyListing) => void;
  onOpenReport: (property: PropertyListing) => void;
  onOpenBoost: (property: PropertyListing) => void;
}

export const AccommodationExplorer: React.FC<AccommodationExplorerProps> = ({
  onOpenCreateListing,
  onStartChat,
  onOpenReport,
  onOpenBoost
}) => {
  const { propertyListings } = useData();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedRoomType, setSelectedRoomType] = useState<string>('all');
  const [selectedAvailability, setSelectedAvailability] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'boosted' | 'price-asc' | 'price-desc' | 'newest'>('boosted');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [selectedProperty, setSelectedProperty] = useState<PropertyListing | null>(null);

  const filteredProperties = useMemo(() => {
    return propertyListings
      .filter(p => {
        if (p.status !== 'active') return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = p.title.toLowerCase().includes(q);
          const matchDesc = p.description.toLowerCase().includes(q);
          const matchArea = p.area.toLowerCase().includes(q);
          if (!matchTitle && !matchDesc && !matchArea) return false;
        }

        if (selectedArea !== 'all' && !p.area.toLowerCase().includes(selectedArea.toLowerCase())) {
          return false;
        }

        if (selectedRoomType !== 'all' && p.roomType !== selectedRoomType) {
          return false;
        }

        if (selectedAvailability !== 'all' && p.availability !== selectedAvailability) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'boosted') {
          if (a.isBoosted && !b.isBoosted) return -1;
          if (!a.isBoosted && b.isBoosted) return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === 'newest') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === 'price-asc') {
          return a.pricePerYear - b.pricePerYear;
        }
        if (sortBy === 'price-desc') {
          return b.pricePerYear - a.pricePerYear;
        }
        return 0;
      });
  }, [propertyListings, searchQuery, selectedArea, selectedRoomType, selectedAvailability, sortBy]);

  const activeFiltersCount = 
    (selectedArea !== 'all' ? 1 : 0) +
    (selectedRoomType !== 'all' ? 1 : 0) +
    (selectedAvailability !== 'all' ? 1 : 0);

  const resetFilters = () => {
    setSelectedArea('all');
    setSelectedRoomType('all');
    setSelectedAvailability('all');
    setSearchQuery('');
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-bold uppercase tracking-wider rounded-full mb-2">
            <span>OAU Student Accommodations</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-950 dark:text-white font-display tracking-tight">
            Off-Campus Lodges & Roommates
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1 max-w-2xl text-sm sm:text-base">
            Find verified self-con apartments, shared flats, and reliable roommates across Asherifa, Damico, Mayfair, and Ede Road without exorbitant agent exploitation.
          </p>
        </div>

        <button
          onClick={onOpenCreateListing}
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 font-bold rounded-2xl shadow-lg transition-all text-sm flex-shrink-0 cursor-pointer"
        >
          <Building className="w-5 h-5" />
          List a Lodge / Room
        </button>
      </div>

      {/* Search & Area Filter Pills */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Sunview Lodge, Damico Road 7, Asherifa self-con, roommate..."
              className="w-full pl-12 pr-10 py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-52">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full appearance-none pl-4 pr-10 py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer shadow-sm"
              >
                <option value="boosted">Featured Lodges First</option>
                <option value="newest">Recently Listed</option>
                <option value="price-asc">Rent: Low to High</option>
                <option value="price-desc">Rent: High to Low</option>
              </select>
              <ArrowUpDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            </div>

            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`flex items-center gap-2 px-4 py-3.5 rounded-2xl border text-sm font-medium transition-all ${
                activeFiltersCount > 0
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFiltersCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[11px] font-bold flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Quick Area Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {['all', ...BRAND_CONFIG.campusLocations.offCampusAreas].map((area) => {
            const isSelected = selectedArea === area;
            return (
              <button
                key={area}
                onClick={() => setSelectedArea(area)}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-sm'
                    : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-700'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-orange-500" />
                <span>{area === 'all' ? 'All OAU Neighborhoods' : area}</span>
              </button>
            );
          })}
        </div>

        {/* Filter Drawer */}
        {isFilterOpen && (
          <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fadeIn">
            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2">
                Room / Property Type
              </label>
              <select
                value={selectedRoomType}
                onChange={(e) => setSelectedRoomType(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none"
              >
                <option value="all">All Room Types</option>
                {BRAND_CONFIG.accommodationTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2">
                Availability Status
              </label>
              <select
                value={selectedAvailability}
                onChange={(e) => setSelectedAvailability(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none"
              >
                <option value="all">Any Availability</option>
                {BRAND_CONFIG.availabilityStatuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={resetFilters}
                className="w-full py-2.5 px-4 border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-amber-600 rounded-xl text-xs font-semibold transition-colors"
              >
                Reset Housing Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <div>
          Showing <span className="font-bold text-zinc-900 dark:text-zinc-100">{filteredProperties.length}</span> verified lodges & rooms
          {selectedArea !== 'all' && <span> in {selectedArea}</span>}
        </div>
        {activeFiltersCount > 0 && (
          <button
            onClick={resetFilters}
            className="text-amber-600 dark:text-amber-400 font-semibold hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Properties Grid */}
      {filteredProperties.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProperties.map((prop) => (
            <PropertyCard
              key={prop.id}
              property={prop}
              onClick={() => setSelectedProperty(prop)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 px-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
            <Home className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              No lodges found for this selection
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Try selecting another neighborhood like Asherifa or Damico, or clearing your room type filters.
            </p>
          </div>
          <button
            onClick={resetFilters}
            className="px-5 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold text-xs rounded-xl shadow transition-all"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Property Detail Modal */}
      {selectedProperty && (
        <PropertyDetailModal
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
          onStartChat={onStartChat}
          onOpenReport={onOpenReport}
          onOpenBoost={onOpenBoost}
        />
      )}
    </div>
  );
};
