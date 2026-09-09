import React, { useState } from 'react';
import { api } from '../../services/api';
import { TaskCategory, TaskPriority } from '../../types';
import { 
  X, 
  MapPin, 
  Navigation, 
  Clock, 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  DollarSign, 
  AlertCircle, 
  FileText, 
  ShoppingBag, 
  Truck, 
  Wrench, 
  Home, 
  Laptop, 
  BookOpen, 
  PlusCircle, 
  ShieldCheck,
  CheckCircle2,
  Image as ImageIcon
} from 'lucide-react';

interface Props {
  onClose: () => void;
  onCreated: (task: any) => void;
  initialCategory?: TaskCategory;
}

const CATEGORIES: { id: TaskCategory; name: string; icon: any; desc: string }[] = [
  { id: 'documents', name: 'Document Pickup', icon: FileText, desc: 'Deliver envelopes, stamp papers, IDs' },
  { id: 'delivery', name: 'Pickup & Delivery', icon: Truck, desc: 'Parcels, keys, boxes, food' },
  { id: 'shopping', name: 'Shopping & Groceries', icon: ShoppingBag, desc: 'Market items, medicine, essentials' },
  { id: 'errand', name: 'Quick Errands', icon: BookOpen, desc: 'Queue waiting, bill payment, forms' },
  { id: 'repair', name: 'Small Repairs', icon: Wrench, desc: 'Appliances, wiring, fixtures, plumbing' },
  { id: 'home_help', name: 'Home Help', icon: Home, desc: 'Shifting help, cleaning, organizing' },
  { id: 'digital', name: 'Digital Assistance', icon: Laptop, desc: 'Printer setup, laptop troubleshooting' },
  { id: 'other', name: 'Custom Task', icon: PlusCircle, desc: 'Any other nearby assistance' },
];

const PRESET_LOCATIONS = [
  { name: 'Hitech City (Cyber Towers), Hyderabad', lat: 17.4435, lng: 78.3772 },
  { name: 'Madhapur Main Rd, Hyderabad', lat: 17.4485, lng: 78.3908 },
  { name: 'Kondapur Botanical Garden, Hyderabad', lat: 17.4612, lng: 78.3582 },
  { name: 'Gachibowli Stadium Rd, Hyderabad', lat: 17.4399, lng: 78.3489 },
  { name: 'Jubilee Hills Check Post, Hyderabad', lat: 17.4319, lng: 78.4073 },
  { name: 'Banjara Hills Rd No. 1, Hyderabad', lat: 17.4156, lng: 78.4350 },
];

export const CreateTaskModal: React.FC<Props> = ({ onClose, onCreated, initialCategory }) => {
  const [step, setStep] = useState(1);
  const totalSteps = 6;

  // Form State
  const [category, setCategory] = useState<TaskCategory>(initialCategory || 'documents');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoInput, setPhotoInput] = useState('');

  const [pickupLocation, setPickupLocation] = useState('Hitech City (Cyber Towers), Hyderabad');
  const [pickupLat, setPickupLat] = useState(17.4435);
  const [pickupLng, setPickupLng] = useState(78.3772);

  const [destinationLocation, setDestinationLocation] = useState('Madhapur Main Rd, Hyderabad');
  const [destinationLat, setDestinationLat] = useState(17.4485);
  const [destinationLng, setDestinationLng] = useState(78.3908);

  const [budget, setBudget] = useState(250);
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [preferredTime, setPreferredTime] = useState('Today, Within 45 mins');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleNext = () => {
    setError('');
    if (step === 2 && !title.trim()) {
      setError('Please provide a title for your task.');
      return;
    }
    if (step === 3 && !pickupLocation.trim()) {
      setError('Please specify the pickup or task location.');
      return;
    }
    if (step === 4 && budget <= 0) {
      setError('Please set a valid reward/budget.');
      return;
    }
    setStep((prev) => Math.min(totalSteps, prev + 1));
  };

  const handleBack = () => {
    setError('');
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleSelectPresetPickup = (preset: typeof PRESET_LOCATIONS[0]) => {
    setPickupLocation(preset.name);
    setPickupLat(preset.lat);
    setPickupLng(preset.lng);
  };

  const handleSelectPresetDestination = (preset: typeof PRESET_LOCATIONS[0]) => {
    setDestinationLocation(preset.name);
    setDestinationLat(preset.lat);
    setDestinationLng(preset.lng);
  };

  const handleUseBrowserGPS = () => {
    if (!navigator.geolocation) {
      setError('Browser geolocation not supported.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPickupLat(Number(pos.coords.latitude.toFixed(6)));
        setPickupLng(Number(pos.coords.longitude.toFixed(6)));
        setPickupLocation(`My GPS Coordinates (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`);
      },
      () => {
        setError('Location permission denied. Please choose a preset location.');
      }
    );
  };

  const handleAddPhoto = () => {
    if (photoInput.trim()) {
      setPhotos((prev) => [...prev, photoInput.trim()]);
      setPhotoInput('');
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const res = await api.createTask({
        title,
        description,
        category,
        pickup_location: pickupLocation,
        pickup_latitude: pickupLat,
        pickup_longitude: pickupLng,
        destination_location: destinationLocation || null,
        destination_latitude: destinationLat || null,
        destination_longitude: destinationLng || null,
        budget: Number(budget),
        priority,
        preferred_time: preferredTime,
        special_instructions: specialInstructions || null,
        photos: photos.length > 0 ? photos : null,
      });

      onCreated(res.task);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to post task');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                Step {step} of {totalSteps}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {step === 1 && 'Choose a service'}
                {step === 2 && 'Add details'}
                {step === 3 && 'Choose location'}
                {step === 4 && 'Set your budget'}
                {step === 5 && 'Choose a time'}
                {step === 6 && 'Review booking'}
              </span>
            </div>
            <h2 className="text-lg font-extrabold text-slate-900 mt-1">
              {step === 1 && 'What do you need help with?'}
              {step === 2 && 'Describe your task'}
              {step === 3 && 'Where should this happen?'}
              {step === 4 && 'Set helper reward'}
              {step === 5 && 'When do you need it?'}
              {step === 6 && 'Confirm your booking'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/60 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Multi-step Progress Bar */}
        <div className="w-full bg-slate-100 h-1.5">
          <div
            className="bg-indigo-600 h-full transition-all duration-300 ease-out"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto max-h-[70vh] space-y-4">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: CATEGORY SELECTION */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-50/80 border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                    </div>
                    <div className="mt-3">
                      <h4 className="text-xs font-bold text-slate-900 leading-tight">{cat.name}</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{cat.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* STEP 2: TASK DESCRIPTION */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pick up signed contract from corporate office"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Detailed Instructions
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide any details: whom to contact, building floor, reference IDs..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Special Instructions (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Handle with care, keep dry, confirm OTP on delivery"
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Photo attachment simulation */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Reference Photo URL (Optional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={photoInput}
                    onChange={(e) => setPhotoInput(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddPhoto}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Add
                  </button>
                </div>
                {photos.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {photos.map((url, i) => (
                      <img key={i} src={url} alt="Attached" className="w-12 h-12 rounded-lg object-cover border" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: LOCATION */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Pickup / Origin Point *
                  </label>
                  <button
                    type="button"
                    onClick={handleUseBrowserGPS}
                    className="inline-flex items-center gap-1 text-[11px] text-indigo-600 font-bold hover:underline cursor-pointer"
                  >
                    <Navigation className="w-3 h-3" /> Use Current GPS
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={pickupLocation}
                    onChange={(e) => setPickupLocation(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                  />
                  <MapPin className="w-4 h-4 text-indigo-600 absolute left-3 top-3" />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {PRESET_LOCATIONS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleSelectPresetPickup(preset)}
                      className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                        pickupLocation === preset.name
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {preset.name.split('(')[0].split(',')[0]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Destination / Delivery Point
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={destinationLocation}
                    onChange={(e) => setDestinationLocation(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                  />
                  <Navigation className="w-4 h-4 text-rose-500 absolute left-3 top-3" />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {PRESET_LOCATIONS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleSelectPresetDestination(preset)}
                      className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                        destinationLocation === preset.name
                          ? 'bg-rose-600 text-white font-bold'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {preset.name.split('(')[0].split(',')[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: BUDGET & REWARD */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100 text-center">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                  Recommended Fair Reward
                </span>
                <div className="text-3xl font-black text-emerald-700 mt-1 flex items-center justify-center">
                  ₹{budget}
                </div>
                <p className="text-xs text-emerald-600/90 mt-1">
                  Higher reward attracts faster response times from top-rated nearby agents.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Custom Reward (₹)
                </label>
                <input
                  type="number"
                  min="50"
                  step="10"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
                />
                <div className="flex gap-2 mt-2">
                  {[150, 200, 250, 350, 500].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setBudget(amt)}
                      className={`flex-1 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        budget === amt
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      ₹{amt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: SCHEDULE & URGENCY */}
          {step === 5 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Priority / Urgency
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'LOW', label: 'Flexible', desc: 'Can be done within hours' },
                    { id: 'MEDIUM', label: 'Standard', desc: 'Within 45–60 mins' },
                    { id: 'HIGH', label: 'High Priority', desc: 'Urgent turnaround' },
                    { id: 'URGENT', label: 'Emergency', desc: 'Needs immediate dispatch' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPriority(p.id as TaskPriority)}
                      className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                        priority === p.id
                          ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xs font-bold block text-slate-900">{p.label}</span>
                      <span className="text-[10px] text-slate-500">{p.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Preferred Time Window
                </label>
                <input
                  type="text"
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                />
              </div>
            </div>
          )}

          {/* STEP 6: SUMMARY & CONFIRMATION */}
          {step === 6 && (
            <div className="space-y-4">
              <div className="p-5 bg-gradient-to-br from-indigo-50/80 to-slate-50 rounded-2xl border border-indigo-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider bg-indigo-600 text-white px-2.5 py-0.5 rounded-full">
                    {category.toUpperCase()}
                  </span>
                  <span className="text-xl font-black text-emerald-600">₹{budget}</span>
                </div>

                <h3 className="text-base font-extrabold text-slate-900">{title || 'Untitled Task'}</h3>

                {description && (
                  <p className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-100 leading-relaxed">
                    {description}
                  </p>
                )}

                <div className="space-y-2 pt-2 border-t border-slate-200/60 text-xs">
                  <div className="flex items-start gap-2 text-slate-700">
                    <MapPin className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Pickup: </span>
                      <span>{pickupLocation}</span>
                    </div>
                  </div>

                  {destinationLocation && (
                    <div className="flex items-start gap-2 text-slate-700">
                      <Navigation className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Destination: </span>
                        <span>{destinationLocation}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {preferredTime}
                    </span>
                    <span>•</span>
                    <span className="font-semibold text-indigo-700">{priority} Priority</span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-3 text-xs text-emerald-900">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  Our matching engine will calculate Haversine distance and rank the nearest verified agents in real-time.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {step < totalSteps ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-200 transition-all cursor-pointer flex items-center gap-1.5 ml-auto"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-200 hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Matching Agents...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>POST TASK NOW</span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
