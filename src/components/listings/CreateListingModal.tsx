import React, { useState } from 'react';
import { MarketplaceItem, PropertyListing, ListingCategory } from '../../types';
import { BRAND_CONFIG, ItemCondition, AccommodationType, AvailabilityStatus } from '../../config/brand';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { uploadImage, DEMO_PRODUCT_IMAGES } from '../../services/cloudinary';
import { 
  X, 
  Upload, 
  Trash2, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  Zap, 
  Eye, 
  Sparkles, 
  Plus, 
  MapPin, 
  Building, 
  ShoppingBag 
} from 'lucide-react';

interface CreateListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onListingCreated?: (listingId: string, type: 'marketplace' | 'property') => void;
  onOpenBoost?: (listing: MarketplaceItem | PropertyListing) => void;
}

export const CreateListingModal: React.FC<CreateListingModalProps> = ({
  isOpen,
  onClose,
  onListingCreated,
  onOpenBoost
}) => {
  if (!isOpen) return null;

  const { createMarketplaceItem, createPropertyListing } = useData();
  const { user } = useAuth();

  // Listing Type: Marketplace vs Accommodation
  const [listingType, setListingType] = useState<'marketplace' | 'property'>('marketplace');

  // Multi-step flow: 'form' | 'preview' | 'success'
  const [currentStep, setCurrentStep] = useState<'form' | 'preview' | 'success'>('form');

  // Common fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [images, setImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Marketplace-specific
  const [category, setCategory] = useState<ListingCategory>('electronics');
  const [condition, setCondition] = useState<ItemCondition>('Like New');
  const [location, setLocation] = useState(BRAND_CONFIG.campusLocations.halls[0]);
  const [pickupSpot, setPickupSpot] = useState(BRAND_CONFIG.campusLocations.pickupSpots[0]);
  const [contactPreference, setContactPreference] = useState<'whatsapp' | 'phone' | 'chat' | 'all'>('all');
  const [phoneOrWhatsapp, setPhoneOrWhatsapp] = useState(user?.whatsappNumber || user?.phoneNumber || '+234 812 345 6789');

  // Accommodation-specific
  const [area, setArea] = useState(BRAND_CONFIG.campusLocations.offCampusAreas[0]);
  const [distanceToCampus, setDistanceToCampus] = useState('6 mins bike to Campus Gate');
  const [roomType, setRoomType] = useState<AccommodationType>('Self-Con');
  const [availability, setAvailability] = useState<AvailabilityStatus>('Available Immediately');
  const [waterSource, setWaterSource] = useState(BRAND_CONFIG.waterSources[0]);
  const [powerSetup, setPowerSetup] = useState(BRAND_CONFIG.powerSetups[0]);
  const [security, setSecurity] = useState('Fenced compound with security gate & night guard');
  const [proximityDesc, setProximityDesc] = useState('Close to central bike stand & market junction');
  const [amenitiesString, setAmenitiesString] = useState('POP Ceiling, Fully Tiled, Borehole Water, Prepaid Meter');

  // Created listing reference for success step
  const [createdItem, setCreatedItem] = useState<MarketplaceItem | PropertyListing | null>(null);

  // Handle local image selection
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploading(true);

    try {
      const files = Array.from(e.target.files);
      const uploadPromises = files.map(file => uploadImage(file));
      const results = await Promise.all(uploadPromises);
      const newUrls = results.map(r => r.url);
      setImages(prev => [...prev, ...newUrls]);
    } catch (err) {
      console.error('Error uploading images', err);
    } finally {
      setIsUploading(false);
    }
  };

  // Add quick sample demo images
  const addSampleImage = (type: 'tech' | 'book' | 'furniture' | 'lodge') => {
    let url = DEMO_PRODUCT_IMAGES.macbook;
    if (type === 'book') url = DEMO_PRODUCT_IMAGES.textbooks;
    if (type === 'furniture') url = DEMO_PRODUCT_IMAGES.desk;
    if (type === 'lodge') url = DEMO_PRODUCT_IMAGES.lodge1;
    setImages(prev => [...prev, url]);
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const moveImage = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;
    const copy = [...images];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;
    setImages(copy);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !price) {
      alert('Please fill in title and price.');
      return;
    }
    setCurrentStep('preview');
  };

  const handlePublish = () => {
    const finalImages = images.length > 0 ? images : [
      listingType === 'marketplace' ? DEMO_PRODUCT_IMAGES.macbook : DEMO_PRODUCT_IMAGES.lodge1
    ];

    if (listingType === 'marketplace') {
      const newItem = createMarketplaceItem({
        userId: user?.id || 'user-julius-adeyemi',
        title: title.trim(),
        description: description.trim() || 'Genuine student item in excellent condition.',
        category,
        price: Number(price),
        condition,
        location,
        pickupSpot,
        specs: ['Inspected & verified condition', 'Available for immediate campus handover'],
        images: finalImages,
        contactPreference,
        phoneOrWhatsapp,
        status: 'active'
      });
      setCreatedItem(newItem);
    } else {
      const newProp = createPropertyListing({
        userId: user?.id || 'user-julius-adeyemi',
        title: title.trim(),
        description: description.trim() || 'Comfortable student lodge around OAU campus.',
        area,
        distanceToCampus,
        pricePerYear: Number(price),
        roomType,
        availability,
        waterSource,
        powerSetup,
        security,
        proximityDesc,
        amenities: amenitiesString.split(',').map(s => s.trim()).filter(Boolean),
        images: finalImages,
        contactPhone: phoneOrWhatsapp || '+234 812 000 1122',
        contactWhatsapp: phoneOrWhatsapp || '+234 812 000 1122',
        isVerified: true,
        status: 'active'
      });
      setCreatedItem(newProp);
    }

    setCurrentStep('success');
  };

  const handleResetAndClose = () => {
    setTitle('');
    setDescription('');
    setPrice('');
    setImages([]);
    setCurrentStep('form');
    setCreatedItem(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div 
        className="relative w-full max-w-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h2 className="text-xl font-bold text-zinc-950 dark:text-white font-display">
              {currentStep === 'form' && 'Create New Listing'}
              {currentStep === 'preview' && 'Review Listing Before Publishing'}
              {currentStep === 'success' && 'Listing Published!'}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {currentStep === 'form' && 'Publish items or lodges to the Obafemi Awolowo University community.'}
              {currentStep === 'preview' && 'Check details to ensure students can easily find and inspect your listing.'}
              {currentStep === 'success' && 'Your listing is live and searchable across campus.'}
            </p>
          </div>
          <button
            onClick={handleResetAndClose}
            className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-6 flex-1">
          {/* STEP 1: FORM */}
          {currentStep === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-3 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setListingType('marketplace')}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    listingType === 'marketplace'
                      ? 'bg-white dark:bg-zinc-900 text-orange-600 dark:text-orange-400 shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  Marketplace Item (Phone, Laptop, Book)
                </button>
                <button
                  type="button"
                  onClick={() => setListingType('property')}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    listingType === 'property'
                      ? 'bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                  }`}
                >
                  <Building className="w-4 h-4" />
                  Accommodation (Lodge / Roommate)
                </button>
              </div>

              {/* Title & Price Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                    {listingType === 'marketplace' ? 'Item Title' : 'Lodge / Apartment Title'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      listingType === 'marketplace'
                        ? 'e.g., MacBook Air M1 (8/256GB Space Gray)'
                        : 'e.g., Sunview Lodge Executive Self-Con Room'
                    }
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                    {listingType === 'marketplace' ? 'Price (₦)' : 'Rent per Year (₦)'} *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value ? Number(e.target.value) : '')}
                    placeholder="e.g., 45000"
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
              </div>

              {/* Marketplace-specific dropdowns */}
              {listingType === 'marketplace' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as ListingCategory)}
                      className="w-full px-3.5 py-3 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200"
                    >
                      {BRAND_CONFIG.categories.filter(c => c.id !== 'all').map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                      Condition
                    </label>
                    <select
                      value={condition}
                      onChange={(e) => setCondition(e.target.value as ItemCondition)}
                      className="w-full px-3.5 py-3 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200"
                    >
                      {BRAND_CONFIG.itemConditions.map((cond) => (
                        <option key={cond} value={cond}>{cond}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                      Resident Hall / Area
                    </label>
                    <select
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full px-3.5 py-3 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200"
                    >
                      <optgroup label="Halls">
                        {BRAND_CONFIG.campusLocations.halls.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Off Campus">
                        {BRAND_CONFIG.campusLocations.offCampusAreas.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                </div>
              ) : (
                /* Accommodation-specific dropdowns */
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                      Neighborhood Area
                    </label>
                    <select
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      className="w-full px-3.5 py-3 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200"
                    >
                      {BRAND_CONFIG.campusLocations.offCampusAreas.map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                      Room Type
                    </label>
                    <select
                      value={roomType}
                      onChange={(e) => setRoomType(e.target.value as AccommodationType)}
                      className="w-full px-3.5 py-3 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200"
                    >
                      {BRAND_CONFIG.accommodationTypes.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                      Availability
                    </label>
                    <select
                      value={availability}
                      onChange={(e) => setAvailability(e.target.value as AvailabilityStatus)}
                      className="w-full px-3.5 py-3 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200"
                    >
                      {BRAND_CONFIG.availabilityStatuses.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                  Detailed Description *
                </label>
                <textarea
                  rows={4}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    listingType === 'marketplace'
                      ? 'Describe battery condition, usage duration, accessories included, and reason for selling...'
                      : 'Describe borehole reliability, prepaid meter setup, gate security, and flatmate expectations...'
                  }
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              {/* Contact & Handover details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                    WhatsApp or Call Phone Number
                  </label>
                  <input
                    type="text"
                    value={phoneOrWhatsapp}
                    onChange={(e) => setPhoneOrWhatsapp(e.target.value)}
                    placeholder="+234 812 345 6789"
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                    {listingType === 'marketplace' ? 'Suggested Safe Handover Spot' : 'Distance to OAU Campus Gate'}
                  </label>
                  {listingType === 'marketplace' ? (
                    <select
                      value={pickupSpot}
                      onChange={(e) => setPickupSpot(e.target.value)}
                      className="w-full px-3.5 py-3 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200"
                    >
                      {BRAND_CONFIG.campusLocations.pickupSpots.map((spot) => (
                        <option key={spot} value={spot}>{spot}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={distanceToCampus}
                      onChange={(e) => setDistanceToCampus(e.target.value)}
                      placeholder="e.g. 6 mins bike to Campus Gate"
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100"
                    />
                  )}
                </div>
              </div>

              {/* Image Uploader & Reordering */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                    Listing Photos ({images.length} added)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => addSampleImage(listingType === 'marketplace' ? 'tech' : 'lodge')}
                      className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 hover:underline"
                    >
                      + Quick Demo Photo
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative group aspect-[4/3] rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-100">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => moveImage(idx, 'left')}
                            className="p-1 bg-white text-zinc-900 rounded hover:bg-zinc-200"
                            title="Move left"
                          >
                            <ArrowLeft className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="p-1 bg-rose-600 text-white rounded hover:bg-rose-700"
                          title="Remove"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        {idx < images.length - 1 && (
                          <button
                            type="button"
                            onClick={() => moveImage(idx, 'right')}
                            className="p-1 bg-white text-zinc-900 rounded hover:bg-zinc-200"
                            title="Move right"
                          >
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      {idx === 0 && (
                        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 text-[9px] font-bold bg-zinc-950/80 text-white rounded">
                          Cover
                        </span>
                      )}
                    </div>
                  ))}

                  {/* Upload Drop target */}
                  <label className="aspect-[4/3] border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-orange-500 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors p-2 text-center bg-zinc-50 dark:bg-zinc-800/40">
                    <Upload className="w-5 h-5 text-zinc-400 mb-1" />
                    <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                      {isUploading ? 'Uploading...' : 'Upload Image'}
                    </span>
                    <span className="text-[9px] text-zinc-400">Multiple allowed</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-5 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-sm shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Preview Listing
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: PREVIEW */}
          {currentStep === 'preview' && (
            <div className="space-y-6">
              <div className="p-4 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 rounded-2xl text-xs text-orange-900 dark:text-orange-200">
                <p className="font-bold flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-orange-600" />
                  Listing Preview Mode
                </p>
                <p className="mt-0.5">
                  This is exactly how students browsing JID will see your listing. Review the details, then click Publish.
                </p>
              </div>

              <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 bg-zinc-50 dark:bg-zinc-800/40 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 rounded-lg">
                      {listingType === 'marketplace' ? category : roomType}
                    </span>
                    <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white mt-2 font-display">
                      {title}
                    </h3>
                  </div>
                  <div className="text-2xl font-black text-orange-600 dark:text-orange-500 font-display">
                    {BRAND_CONFIG.currency.format(Number(price))}
                    {listingType === 'property' && <span className="text-xs text-zinc-500 font-normal"> / year</span>}
                  </div>
                </div>

                <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                  {description}
                </p>

                <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-orange-600" />
                    {listingType === 'marketplace' ? location : area}
                  </span>
                  <span>Photos: {images.length > 0 ? images.length : 1} attached</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setCurrentStep('form')}
                  className="px-5 py-3 border border-zinc-300 dark:border-zinc-700 text-sm font-semibold text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  &larr; Back to Edit
                </button>
                <button
                  type="button"
                  onClick={handlePublish}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Publish Listing Now
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS & PROMPT TO BOOST */}
          {currentStep === 'success' && (
            <div className="text-center py-8 space-y-6 animate-fadeIn">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-2xl font-bold text-zinc-950 dark:text-white font-display">
                  Your listing is live!
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Students across OAU can now search and contact you. You can manage, pause, or boost this listing at any time from your dashboard.
                </p>
              </div>

              {/* Optional Voluntary Boost Prompt */}
              <div className="max-w-md mx-auto p-5 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20 border border-orange-200 dark:border-orange-800/60 rounded-3xl text-left space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center flex-shrink-0">
                    <Zap className="w-4 h-4 fill-current" />
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-900 dark:text-white text-sm">
                      Get 3x Visibility on Campus
                    </h4>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      Watch 5 sponsor ads to unlock a 24-hour boost.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (createdItem && onOpenBoost) {
                      onClose();
                      onOpenBoost(createdItem);
                    }
                  }}
                  className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow transition-all cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  Boost This Listing Now (Voluntary Ads)
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-6 py-2.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                >
                  Done & Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
