import React from 'react';
import { Check, MapPin } from 'lucide-react';

interface Props {
  compact?: boolean;
  light?: boolean;
}

export const BrandMark: React.FC<Props> = ({ compact = false, light = false }) => (
  <div className={`flex items-center ${compact ? 'gap-2' : 'gap-3'}`}>
    <div className={`relative flex shrink-0 items-center justify-center rounded-2xl ${compact ? 'h-9 w-9' : 'h-11 w-11'} ${light ? 'bg-white text-[#0b7285] shadow-lg shadow-black/10' : 'bg-[#0b7285] text-white shadow-lg shadow-[#0b7285]/20'}`}>
      <MapPin className={compact ? 'h-5 w-5' : 'h-6 w-6'} strokeWidth={2.4} />
      <span className={`absolute flex items-center justify-center rounded-full bg-[#f3a44d] text-white ring-2 ${light ? 'ring-white' : 'ring-[#0b7285]'} ${compact ? '-right-1 -top-1 h-4 w-4' : '-right-1.5 -top-1.5 h-5 w-5'}`}>
        <Check className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} strokeWidth={3} />
      </span>
    </div>
    <div>
      <div className={`font-black tracking-tight ${compact ? 'text-lg' : 'text-xl'} ${light ? 'text-white' : 'text-[#18314f]'}`}>
        Task<span className={light ? 'text-[#f6c267]' : 'text-[#0b7285]'}>Mate</span>
      </div>
      {!compact && <p className={`text-[10px] font-semibold tracking-wide ${light ? 'text-white/70' : 'text-[#6f8299]'}`}>Local help, made easy</p>}
    </div>
  </div>
);
