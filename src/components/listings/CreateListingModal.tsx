import React, { useState, useEffect, useCallback } from 'react';
import { MarketplaceItem, PropertyListing, ListingCategory, LandlordRole } from '../../types';
import { BRAND_CONFIG, ItemCondition, AccommodationType, AvailabilityStatus } from '../../config/brand';
import { useAuth } from '../../context/AuthContext';
import { uploadImage, validateImageFile } from '../../services/cloudinary';
import {
  createMarketplace,
  updateMarketplace,
  createProperty,
  updateProperty,
  NewMarketplaceInput,
  NewPropertyInput,
} from '../../services/database';
import { ViewType } from '../../types';
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
  MapPin,
  Building,
  ShoppingBag,
  Loader2,
  AlertTriangle,
  Star,
  RefreshCw,
} from 'lucide-react';

interface CreateListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  editTarget: MarketplaceItem | PropertyListing | null;
  onOpenBoost: (listing: MarketplaceItem | PropertyListing) => void;
  onNavigate: (view: ViewType) => void;
}

type Step = 'form' | 'preview' | 'success';

interface ImageSlot {
  id: string;
  status: 'uploading' | 'done' | 'error';
  progress: number;
  url?: string;
  file?: File;
  error?: string;
}

const LANDLORD_ROLES: LandlordRole[] = ['Student Subletter', 'Lodge Caretaker', 'Direct Landlord', 'Campus Agent'];

const genId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `img-${Date.now()}-${Math.random().toString(36).slice(2)}`);

const doneSlot = (url: string): ImageSlot => ({ id: genId(), status: 'done', progress: 100, url });

const parseAmenities = (raw: string) =>
  raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const inputCls =
  'w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500/50 focus:outline-none';
const selectCls =
  'w-full px-3.5 py-3 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500/50 focus:outline-none';
const labelCls = 'block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2';

export const CreateListingModal: React.FC<CreateListingModalProps> = ({
  isOpen,
  onClose,
  editTarget,
  onOpenBoost,
  onNavigate,
}) => {
  const { user } = useAuth();

  const isEdit = !!editTarget;

  const [listingType, setListingType] = useState<'marketplace' | 'property'>('marketplace');
  const [step, setStep] = useState<Step>('form');
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<MarketplaceItem | PropertyListing | null>(null);

  // Common
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [imageSlots, setImageSlots] = useState<ImageSlot[]>([]);

  // Marketplace
  const [category, setCategory] = useState<ListingCategory>('electronics');
  const [condition, setCondition] = useState<ItemCondition>(BRAND_CONFIG.itemConditions[1]);
  const [location, setLocation] = useState(BRAND_CONFIG.campusLocations.halls[0]);
  const [pickupSpot, setPickupSpot] = useState(BRAND_CONFIG.campusLocations.pickupSpots[0]);
  const [contactPreference, setContactPreference] = useState<'whatsapp' | 'phone' | 'chat' | 'all'>('all');
  const [phoneOrWhatsapp, setPhoneOrWhatsapp] = useState('');

  // Property
  const [area, setArea] = useState(BRAND_CONFIG.campusLocations.offCampusAreas[0]);
  const [distanceToCampus, setDistanceToCampus] = useState('');
  const [roomType, setRoomType] = useState<AccommodationType>(BRAND_CONFIG.accommodationTypes[0]);
  const [availability, setAvailability] = useState<AvailabilityStatus>(BRAND_CONFIG.availabilityStatuses[0]);
  const [waterSource, setWaterSource] = useState(BRAND_CONFIG.waterSources[0]);
  const [powerSetup, setPowerSetup] = useState(BRAND_CONFIG.powerSetups[0]);
  const [security, setSecurity] = useState('');
  const [proximityDesc, setProximityDesc] = useState('');
  const [amenitiesString, setAmenitiesString] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [landlordRole, setLandlordRole] = useState<LandlordRole>('Student Subletter');

  // (Re)initialize whenever the modal opens or the edit target changes.
  useEffect(() => {
    if (!isOpen) return;
    setStep('form');
    setSaving(false);
    setSubmitError(null);
    setFormError(null);
    setCreated(null);

    const t = editTarget;
    if (t && 'roomType' in t) {
      setListingType('property');
      setTitle(t.title);
      setDescription(t.description);
      setPrice(t.pricePerYear);
      setArea(t.area);
      setDistanceToCampus(t.distanceToCampus || '');
      setRoomType(t.roomType as AccommodationType);
      setAvailability(t.availability as AvailabilityStatus);
      setWaterSource(t.waterSource || BRAND_CONFIG.waterSources[0]);
      setPowerSetup(t.powerSetup || BRAND_CONFIG.powerSetups[0]);
      setSecurity(t.security || '');
      setProximityDesc(t.proximityDesc || '');
      setAmenitiesString((t.amenities || []).join(', '));
      setContactPhone(t.contactPhone || '');
      setContactWhatsapp(t.contactWhatsapp || '');
      setLandlordRole((t.landlord?.role as LandlordRole) || 'Student Subletter');
      setImageSlots((t.images || []).map(doneSlot));
    } else if (t) {
      setListingType('marketplace');
      setTitle(t.title);
      setDescription(t.description);
      setPrice(t.price);
      setCategory(t.category as ListingCategory);
      setCondition(t.condition as ItemCondition);
      setLocation(t.location);
      setPickupSpot(t.pickupSpot || BRAND_CONFIG.campusLocations.pickupSpots[0]);
      setContactPreference(t.contactPreference);
      setPhoneOrWhatsapp(t.phoneOrWhatsapp || '');
      setImageSlots((t.images || []).map(doneSlot));
    } else {
      // Fresh create — reset to clean defaults (no demo content).
      setListingType('marketplace');
      setTitle('');
      setDescription('');
      setPrice('');
      setCategory('electronics');
      setCondition(BRAND_CONFIG.itemConditions[1]);
      setLocation(BRAND_CONFIG.campusLocations.halls[0]);
      setPickupSpot(BRAND_CONFIG.campusLocations.pickupSpots[0]);
      setContactPreference('all');
      setPhoneOrWhatsapp('');
      setArea(BRAND_CONFIG.campusLocations.offCampusAreas[0]);
      setDistanceToCampus('');
      setRoomType(BRAND_CONFIG.accommodationTypes[0]);
      setAvailability(BRAND_CONFIG.availabilityStatuses[0]);
      setWaterSource(BRAND_CONFIG.waterSources[0]);
      setPowerSetup(BRAND_CONFIG.powerSetups[0]);
      setSecurity('');
      setProximityDesc('');
      setAmenitiesString('');
      setContactPhone('');
      setContactWhatsapp('');
      setLandlordRole('Student Subletter');
      setImageSlots([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editTarget]);

  const uploadOne = useCallback(async (slotId: string, file: File) => {
    try {
      const res = await uploadImage(file, {
        folder: 'jid/listings',
        onProgress: (p) =>
          setImageSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, progress: p } : s))),
      });
      setImageSlots((prev) =>
        prev.map((s) => (s.id === slotId ? { ...s, status: 'done', url: res.url, progress: 100 } : s))
      );
    } catch (err: any) {
      setImageSlots((prev) =>
        prev.map((s) =>
          s.id === slotId ? { ...s, status: 'error', error: err?.message || 'Upload failed.' } : s
        )
      );
    }
  }, []);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const id = genId();
      const validationError = validateImageFile(file);
      if (validationError) {
        setImageSlots((prev) => [...prev, { id, status: 'error', progress: 0, file, error: validationError }]);
        return;
      }
      setImageSlots((prev) => [...prev, { id, status: 'uploading', progress: 0, file }]);
      void uploadOne(id, file);
    });
  };

  const retrySlot = (slot: ImageSlot) => {
    if (!slot.file) return;
    setImageSlots((prev) =>
      prev.map((s) => (s.id === slot.id ? { ...s, status: 'uploading', progress: 0, error: undefined } : s))
    );
    void uploadOne(slot.id, slot.file);
  };

  const removeSlot = (id: string) => setImageSlots((prev) => prev.filter((s) => s.id !== id));

  const moveSlot = (id: string, dir: 'left' | 'right') =>
    setImageSlots((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      const target = dir === 'left' ? idx - 1 : idx + 1;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[target]] = [copy[target], copy[idx]];
      return copy;
    });

  const makeCover = (id: string) =>
    setImageSlots((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx <= 0) return prev;
      const copy = [...prev];
      const [s] = copy.splice(idx, 1);
      copy.unshift(s);
      return copy;
    });

  const uploadedUrls = imageSlots.filter((s) => s.status === 'done' && s.url).map((s) => s.url!) as string[];
  const anyUploading = imageSlots.some((s) => s.status === 'uploading');

  const handleContinueToPreview = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) return setFormError('Please add a title.');
    if (!description.trim()) return setFormError('Please add a description.');
    if (!price || Number(price) <= 0) return setFormError('Please enter a valid price.');
    if (anyUploading) return setFormError('Please wait for your photos to finish uploading.');
    if (uploadedUrls.length === 0) return setFormError('Please add at least one real photo of your listing.');
    if (listingType === 'property' && !contactPhone.trim())
      return setFormError('Please add a contact phone number for the lodge.');

    setStep('preview');
  };

  const handlePublish = async () => {
    if (saving) return;
    if (!user) {
      setSubmitError('Please sign in to publish your listing.');
      return;
    }
    setSubmitError(null);
    setSaving(true);
    try {
      if (listingType === 'marketplace') {
        const input: NewMarketplaceInput = {
          title: title.trim(),
          description: description.trim(),
          category,
          price: Number(price),
          condition,
          location,
          pickupSpot: pickupSpot || undefined,
          specs: [],
          images: uploadedUrls,
          contactPreference,
          phoneOrWhatsapp: phoneOrWhatsapp.trim() || undefined,
        };
        if (isEdit && editTarget) {
          await updateMarketplace(editTarget.id, input);
          setCreated({ ...(editTarget as MarketplaceItem), ...input, images: uploadedUrls });
        } else {
          setCreated(await createMarketplace(user.id, input));
        }
      } else {
        const input: NewPropertyInput = {
          title: title.trim(),
          description: description.trim(),
          area,
          distanceToCampus: distanceToCampus.trim() || undefined,
          pricePerYear: Number(price),
          roomType,
          availability,
          waterSource: waterSource || undefined,
          powerSetup: powerSetup || undefined,
          security: security.trim() || undefined,
          proximityDesc: proximityDesc.trim() || undefined,
          amenities: parseAmenities(amenitiesString),
          images: uploadedUrls,
          contactPhone: contactPhone.trim(),
          contactWhatsapp: contactWhatsapp.trim() || undefined,
          landlordRole,
        };
        if (isEdit && editTarget) {
          await updateProperty(editTarget.id, input);
          const prev = editTarget as PropertyListing;
          setCreated({
            ...prev,
            title: input.title,
            description: input.description,
            area: input.area,
            distanceToCampus: input.distanceToCampus || '',
            pricePerYear: input.pricePerYear,
            roomType: input.roomType as AccommodationType,
            availability: input.availability as AvailabilityStatus,
            waterSource: input.waterSource || '',
            powerSetup: input.powerSetup || '',
            security: input.security || '',
            proximityDesc: input.proximityDesc || '',
            amenities: input.amenities || [],
            images: uploadedUrls,
            contactPhone: input.contactPhone,
            contactWhatsapp: input.contactWhatsapp,
          });
        } else {
          setCreated(await createProperty(user.id, input));
        }
      }
      setStep('success');
    } catch (err: any) {
      console.error('[create-listing] publish failed', err);
      setSubmitError(err?.message || 'Could not publish your listing. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const priceLabel = listingType === 'marketplace' ? 'Price (₦)' : 'Rent per Year (₦)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div
        className="relative w-full max-w-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-zinc-950 dark:text-white font-display">
              {step === 'form' && (isEdit ? 'Edit Listing' : 'Create New Listing')}
              {step === 'preview' && 'Review Before Publishing'}
              {step === 'success' && (isEdit ? 'Changes Saved!' : 'Listing Published!')}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {step === 'form' && 'Publish items or lodges to the Obafemi Awolowo University community.'}
              {step === 'preview' && 'Check the details students will see, then publish.'}
              {step === 'success' && 'Your listing is live and searchable across campus.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 flex-1">
          {/* STEP 1: FORM */}
          {step === 'form' && (
            <form onSubmit={handleContinueToPreview} className="space-y-6">
              {/* Type switcher (create only) */}
              {!isEdit && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setListingType('marketplace')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      listingType === 'marketplace'
                        ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4" />
                    Marketplace Item
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
                    Accommodation
                  </button>
                </div>
              )}

              {/* Title & price */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelCls}>
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
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{priceLabel} *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    inputMode="numeric"
                    value={price}
                    onChange={(e) => setPrice(e.target.value ? Number(e.target.value) : '')}
                    placeholder="45000"
                    className={`${inputCls} font-bold`}
                  />
                </div>
              </div>

              {/* Type-specific dropdowns */}
              {listingType === 'marketplace' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as ListingCategory)}
                      className={selectCls}
                    >
                      {BRAND_CONFIG.categories
                        .filter((c) => c.id !== 'all')
                        .map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.label}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Condition</label>
                    <select
                      value={condition}
                      onChange={(e) => setCondition(e.target.value as ItemCondition)}
                      className={selectCls}
                    >
                      {BRAND_CONFIG.itemConditions.map((cond) => (
                        <option key={cond} value={cond}>
                          {cond}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Resident Hall / Area</label>
                    <select value={location} onChange={(e) => setLocation(e.target.value)} className={selectCls}>
                      <optgroup label="Halls">
                        {BRAND_CONFIG.campusLocations.halls.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Off Campus">
                        {BRAND_CONFIG.campusLocations.offCampusAreas.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Neighborhood Area</label>
                    <select value={area} onChange={(e) => setArea(e.target.value)} className={selectCls}>
                      {BRAND_CONFIG.campusLocations.offCampusAreas.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Room Type</label>
                    <select
                      value={roomType}
                      onChange={(e) => setRoomType(e.target.value as AccommodationType)}
                      className={selectCls}
                    >
                      {BRAND_CONFIG.accommodationTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Availability</label>
                    <select
                      value={availability}
                      onChange={(e) => setAvailability(e.target.value as AvailabilityStatus)}
                      className={selectCls}
                    >
                      {BRAND_CONFIG.availabilityStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <label className={labelCls}>Detailed Description *</label>
                <textarea
                  rows={4}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    listingType === 'marketplace'
                      ? 'Describe battery health, usage duration, accessories included, and reason for selling…'
                      : 'Describe borehole reliability, prepaid meter setup, gate security, and flatmate expectations…'
                  }
                  className={inputCls}
                />
              </div>

              {/* Property extra details */}
              {listingType === 'property' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Water Source</label>
                    <select
                      value={waterSource}
                      onChange={(e) => setWaterSource(e.target.value)}
                      className={selectCls}
                    >
                      {BRAND_CONFIG.waterSources.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Power Setup</label>
                    <select
                      value={powerSetup}
                      onChange={(e) => setPowerSetup(e.target.value)}
                      className={selectCls}
                    >
                      {BRAND_CONFIG.powerSetups.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Security & Environment</label>
                    <input
                      type="text"
                      value={security}
                      onChange={(e) => setSecurity(e.target.value)}
                      placeholder="Fenced compound, gate & night guard"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Your Role</label>
                    <select
                      value={landlordRole}
                      onChange={(e) => setLandlordRole(e.target.value as LandlordRole)}
                      className={selectCls}
                    >
                      {LANDLORD_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Amenities (comma separated)</label>
                    <input
                      type="text"
                      value={amenitiesString}
                      onChange={(e) => setAmenitiesString(e.target.value)}
                      placeholder="POP Ceiling, Fully Tiled, Borehole, Prepaid Meter"
                      className={inputCls}
                    />
                  </div>
                </div>
              )}

              {/* Contact & handover */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {listingType === 'marketplace' ? (
                  <>
                    <div>
                      <label className={labelCls}>Preferred Contact</label>
                      <select
                        value={contactPreference}
                        onChange={(e) => setContactPreference(e.target.value as any)}
                        className={selectCls}
                      >
                        <option value="all">In-app chat, WhatsApp & Call</option>
                        <option value="whatsapp">WhatsApp only</option>
                        <option value="phone">Phone call only</option>
                        <option value="chat">In-app chat only</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>
                        WhatsApp / Phone Number {contactPreference !== 'chat' ? '' : '(optional)'}
                      </label>
                      <input
                        type="tel"
                        inputMode="tel"
                        value={phoneOrWhatsapp}
                        onChange={(e) => setPhoneOrWhatsapp(e.target.value)}
                        placeholder="+234 812 345 6789"
                        className={inputCls}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelCls}>Suggested Safe Handover Spot</label>
                      <select value={pickupSpot} onChange={(e) => setPickupSpot(e.target.value)} className={selectCls}>
                        {BRAND_CONFIG.campusLocations.pickupSpots.map((spot) => (
                          <option key={spot} value={spot}>
                            {spot}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className={labelCls}>Contact Phone *</label>
                      <input
                        type="tel"
                        inputMode="tel"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="+234 812 345 6789"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>WhatsApp (optional)</label>
                      <input
                        type="tel"
                        inputMode="tel"
                        value={contactWhatsapp}
                        onChange={(e) => setContactWhatsapp(e.target.value)}
                        placeholder="+234 812 345 6789"
                        className={inputCls}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelCls}>Distance to OAU Campus Gate</label>
                      <input
                        type="text"
                        value={distanceToCampus}
                        onChange={(e) => setDistanceToCampus(e.target.value)}
                        placeholder="e.g. 6 mins bike to Campus Gate"
                        className={inputCls}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Real image uploader */}
              <div>
                <label className={labelCls}>
                  Listing Photos ({uploadedUrls.length} ready{anyUploading ? ', uploading…' : ''})
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {imageSlots.map((slot, idx) => (
                    <div
                      key={slot.id}
                      className="relative group aspect-[4/3] rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800"
                    >
                      {slot.status === 'done' && slot.url && (
                        <img src={slot.url} alt="" className="w-full h-full object-cover" />
                      )}

                      {slot.status === 'uploading' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 text-center">
                          <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                          <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 transition-all"
                              style={{ width: `${slot.progress}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-zinc-500">{slot.progress}%</span>
                        </div>
                      )}

                      {slot.status === 'error' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2 text-center bg-rose-50 dark:bg-rose-950/40">
                          <AlertTriangle className="w-5 h-5 text-rose-500" />
                          <span className="text-[9px] text-rose-600 dark:text-rose-300 leading-tight line-clamp-2">
                            {slot.error}
                          </span>
                          <div className="flex gap-1">
                            {slot.file && (
                              <button
                                type="button"
                                onClick={() => retrySlot(slot)}
                                className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-500"
                                title="Retry upload"
                              >
                                <RefreshCw className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => removeSlot(slot.id)}
                              className="p-1 bg-zinc-700 text-white rounded hover:bg-zinc-600"
                              title="Remove"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}

                      {slot.status === 'done' && (
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => moveSlot(slot.id, 'left')}
                              className="p-1 bg-white text-zinc-900 rounded hover:bg-zinc-200"
                              title="Move left"
                            >
                              <ArrowLeft className="w-3 h-3" />
                            </button>
                          )}
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => makeCover(slot.id)}
                              className="p-1 bg-amber-500 text-white rounded hover:bg-amber-400"
                              title="Set as cover"
                            >
                              <Star className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeSlot(slot.id)}
                            className="p-1 bg-rose-600 text-white rounded hover:bg-rose-700"
                            title="Remove"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                          {idx < imageSlots.length - 1 && (
                            <button
                              type="button"
                              onClick={() => moveSlot(slot.id, 'right')}
                              className="p-1 bg-white text-zinc-900 rounded hover:bg-zinc-200"
                              title="Move right"
                            >
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}

                      {idx === 0 && slot.status === 'done' && (
                        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 text-[9px] font-bold bg-zinc-950/80 text-white rounded">
                          Cover
                        </span>
                      )}
                    </div>
                  ))}

                  <label className="aspect-[4/3] border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-emerald-500 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors p-2 text-center bg-zinc-50 dark:bg-zinc-800/40">
                    <Upload className="w-5 h-5 text-zinc-400 mb-1" />
                    <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">Upload Photos</span>
                    <span className="text-[9px] text-zinc-400">JPG, PNG, WEBP · up to 10MB</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => {
                        handleFiles(e.target.files);
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
                <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Photos upload securely to our media host — only real images you add are stored. The first photo is
                  the cover.
                </p>
              </div>

              {formError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 text-xs rounded-xl border border-rose-200 dark:border-rose-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {formError}
                </div>
              )}

              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: PREVIEW */}
          {step === 'preview' && (
            <div className="space-y-6">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl text-xs text-emerald-900 dark:text-emerald-200">
                <p className="font-bold flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  Listing Preview
                </p>
                <p className="mt-0.5">This is how students browsing JID will see your listing.</p>
              </div>

              <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-zinc-50 dark:bg-zinc-800/40">
                {uploadedUrls[0] && (
                  <div className="aspect-[16/9] w-full bg-zinc-200 dark:bg-zinc-800">
                    <img src={uploadedUrls[0]} alt={title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-lg">
                        {listingType === 'marketplace' ? category : roomType}
                      </span>
                      <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white mt-2 font-display">{title}</h3>
                    </div>
                    <div className="text-2xl font-black text-emerald-600 dark:text-emerald-500 font-display text-right">
                      {BRAND_CONFIG.currency.format(Number(price))}
                      {listingType === 'property' && (
                        <span className="text-xs text-zinc-500 font-normal"> / year</span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                    {description}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      {listingType === 'marketplace' ? location : area}
                    </span>
                    <span>{uploadedUrls.length} photo{uploadedUrls.length === 1 ? '' : 's'}</span>
                  </div>
                </div>
              </div>

              {submitError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 text-xs rounded-xl border border-rose-200 dark:border-rose-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {submitError}
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  disabled={saving}
                  className="px-5 py-3 border border-zinc-300 dark:border-zinc-700 text-sm font-semibold text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                  ← Back to Edit
                </button>
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={saving}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold rounded-xl text-sm shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {saving ? 'Publishing…' : isEdit ? 'Save Changes' : 'Publish Now'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS */}
          {step === 'success' && (
            <div className="text-center py-8 space-y-6 animate-fadeIn">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-2xl font-bold text-zinc-950 dark:text-white font-display">
                  {isEdit ? 'Your changes are live!' : 'Your listing is live!'}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Students across OAU can now search and contact you. Manage, pause, or boost it anytime from your
                  listings.
                </p>
              </div>

              <div className="max-w-md mx-auto p-5 bg-gradient-to-br from-emerald-50 to-amber-50 dark:from-emerald-950/30 dark:to-amber-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-3xl text-left space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                    <Zap className="w-4 h-4 fill-current" />
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-900 dark:text-white text-sm">Get more visibility on campus</h4>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      Watch {BRAND_CONFIG.boostRules.requiredAdsCount} short ads to unlock a{' '}
                      {BRAND_CONFIG.boostRules.durationHours}-hour boost — always free.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (created) {
                      onClose();
                      onOpenBoost(created);
                    }
                  }}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow transition-all cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  Boost this listing
                </button>
              </div>

              <div className="pt-2 flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigate('my-listings');
                  }}
                  className="px-6 py-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  View my listings
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
