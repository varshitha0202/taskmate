import React from 'react';
import { TaskStatus } from '../../types';
import { 
  Clock, 
  Search, 
  Send, 
  Check, 
  PlayCircle, 
  CheckCircle2, 
  Award, 
  XCircle, 
  AlertCircle 
} from 'lucide-react';

interface Props {
  status: TaskStatus;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const TaskStatusBadge: React.FC<Props> = ({ status, className = '', size = 'md' }) => {
  let config: { label: string; bg: string; icon: React.ReactNode; animate: boolean } = {
    label: status,
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: <Clock className="w-3.5 h-3.5" />,
    animate: false,
  };

  switch (status) {
    case 'POSTED':
      config = {
        label: 'Posted',
        bg: 'bg-slate-100 text-slate-700 border-slate-300',
        icon: <Clock className="w-3.5 h-3.5" />,
        animate: false,
      };
      break;

    case 'MATCHING':
      config = {
        label: 'Finding your provider',
        bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        icon: <Search className="w-3.5 h-3.5 animate-spin" />,
        animate: true,
      };
      break;

    case 'OFFERED':
      config = {
        label: 'Provider considering booking',
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: <Send className="w-3.5 h-3.5" />,
        animate: true,
      };
      break;

    case 'ACCEPTED':
      config = {
        label: 'Provider assigned',
        bg: 'bg-blue-50 text-blue-700 border-blue-200',
        icon: <Check className="w-3.5 h-3.5" />,
        animate: false,
      };
      break;

    case 'IN_PROGRESS':
      config = {
        label: 'Service in progress',
        bg: 'bg-purple-50 text-purple-700 border-purple-200',
        icon: <PlayCircle className="w-3.5 h-3.5" />,
        animate: true,
      };
      break;

    case 'COMPLETED':
      config = {
        label: 'Service completed',
        bg: 'bg-teal-50 text-teal-700 border-teal-200',
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        animate: false,
      };
      break;

    case 'CONFIRMED':
      config = {
        label: 'Booking complete',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: <Award className="w-3.5 h-3.5" />,
        animate: false,
      };
      break;

    case 'CANCELLED':
      config = {
        label: 'Cancelled',
        bg: 'bg-rose-50 text-rose-700 border-rose-200',
        icon: <XCircle className="w-3.5 h-3.5" />,
        animate: false,
      };
      break;

    case 'NO_AGENT_AVAILABLE':
      config = {
        label: 'Still looking for a provider',
        bg: 'bg-orange-50 text-orange-700 border-orange-200',
        icon: <AlertCircle className="w-3.5 h-3.5" />,
        animate: true,
      };
      break;

    case 'UNSUCCESSFUL_REQUEST':
      config = {
        label: 'We could not find a provider',
        bg: 'bg-rose-50 text-rose-700 border-rose-300 font-bold',
        icon: <AlertCircle className="w-3.5 h-3.5" />,
        animate: false,
      };
      break;
  }

  const sizeClass = size === 'sm' 
    ? 'text-[11px] px-2 py-0.5 gap-1' 
    : size === 'lg' 
      ? 'text-sm px-3.5 py-1.5 gap-2' 
      : 'text-xs px-2.5 py-1 gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border shadow-2xs ${sizeClass} ${config.bg} ${className}`}
    >
      {config.animate && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping mr-0.5" />
      )}
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
};
