import React, { useState } from 'react';
import { Profile, Task, CustomerWallet, WalletTransaction, Notification } from '../../types';
import { TaskStatusBadge } from '../common/TaskStatusBadge';
import {
  Award,
  Bell,
  CalendarDays,
  CheckCircle2,
  Edit3,
  HelpCircle,
  History,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  UserCircle,
  X,
} from 'lucide-react';

type AccountView = 'PROFILE' | 'BOOKINGS' | 'POINTS' | 'HELP';

interface Props {
  view: AccountView;
  user: Profile;
  wallet: CustomerWallet | null;
  transactions: WalletTransaction[];
  tasks: Task[];
  notifications: Notification[];
  onUpdateProfile: (updates: Partial<Profile>) => Promise<void>;
  onViewBooking: (taskId: string) => void;
  onOpenAssistant: () => void;
  onLogout: () => void;
}

const transactionLabel: Record<string, string> = {
  REWARD_POINTS: 'Points earned',
  COMPENSATION_POINTS: 'Compensation points',
  SERVICE_CREDIT: 'Service credit',
  REFUND: 'Refund',
};

export const CustomerAccountView: React.FC<Props> = ({
  view,
  user,
  wallet,
  transactions,
  tasks,
  notifications,
  onUpdateProfile,
  onViewBooking,
  onOpenAssistant,
  onLogout,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [form, setForm] = useState({
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    address: user.address || '',
    avatar_url: user.avatar_url || '',
  });

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setSaveMessage('');
    setErrorMessage('');
    try {
      await onUpdateProfile(form);
      setSaveMessage('Your profile has been updated.');
      setIsEditing(false);
    } catch (error: any) {
      setErrorMessage(error?.message || 'We could not save your changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const bookingGroups = {
    active: tasks.filter((task) => ['POSTED', 'MATCHING', 'OFFERED', 'ACCEPTED', 'IN_PROGRESS', 'REASSIGNING'].includes(task.status)),
    completed: tasks.filter((task) => ['COMPLETED', 'CONFIRMED'].includes(task.status)),
    cancelled: tasks.filter((task) => task.status === 'CANCELLED'),
    unsuccessful: tasks.filter((task) => ['UNSUCCESSFUL_REQUEST', 'NO_AGENT_AVAILABLE'].includes(task.status)),
  };

  const renderBooking = (task: Task) => (
    <div key={task.id} className="flex flex-col gap-3 border-b border-slate-100 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <TaskStatusBadge status={task.status} size="sm" />
          <h3 className="truncate text-sm font-bold text-slate-900">{task.title}</h3>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{task.pickup_location}</span>
          <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{new Date(task.created_at).toLocaleDateString()}</span>
          {task.agent_name && <span>Provider: {task.agent_name}</span>}
        </div>
      </div>
      <button onClick={() => onViewBooking(task.id)} className="self-start rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-indigo-300 hover:text-indigo-700 sm:self-auto">
        View details
      </button>
    </div>
  );

  const renderBookings = () => (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Bookings</p>
        <h1 className="mt-1 text-2xl font-black text-slate-900">Your booking history</h1>
        <p className="mt-1 text-sm text-slate-500">Track current services and revisit previous bookings.</p>
      </div>
      {Object.entries(bookingGroups).map(([key, group]) => (
        <section key={key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-extrabold capitalize text-slate-900">{key === 'unsuccessful' ? 'Unsuccessful requests' : `${key} bookings`}</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{group.length}</span>
          </div>
          {group.length ? group.map(renderBooking) : <p className="py-5 text-sm text-slate-500">No {key} bookings yet.</p>}
        </section>
      ))}
    </div>
  );

  const renderPoints = () => (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Points</p>
        <h1 className="mt-1 text-2xl font-black text-slate-900">My Points</h1>
        <p className="mt-1 text-sm text-slate-500">Your points may help you receive priority during future bookings.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl bg-indigo-700 p-6 text-white shadow-lg">
          <Award className="h-6 w-6 text-indigo-200" />
          <p className="mt-5 text-sm text-indigo-100">Current points balance</p>
          <p className="mt-1 text-4xl font-black">{wallet?.reward_points || 0}</p>
          <p className="mt-3 text-xs text-indigo-100">Priority level: {wallet?.priority_tier || 'New Customer'}</p>
        </div>
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          <p className="mt-5 text-sm font-bold text-emerald-950">How points work</p>
          <p className="mt-2 text-sm leading-relaxed text-emerald-900">Points are earned from successful completions and useful feedback. Compensation points are kept separate.</p>
        </div>
      </div>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2"><History className="h-5 w-5 text-indigo-600" /><h2 className="font-extrabold text-slate-900">Points history</h2></div>
        {transactions.filter((transaction) => transaction.type === 'REWARD_POINTS' || transaction.type === 'COMPENSATION_POINTS').length ? (
          <div className="mt-2 divide-y divide-slate-100">
            {transactions.filter((transaction) => transaction.type === 'REWARD_POINTS' || transaction.type === 'COMPENSATION_POINTS').map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div><p className="font-semibold text-slate-800">{transactionLabel[transaction.type]}</p><p className="text-xs text-slate-500">{transaction.description}</p></div>
                <span className="font-black text-emerald-600">+{transaction.amount}</span>
              </div>
            ))}
          </div>
        ) : <p className="mt-4 text-sm text-slate-500">Your points history will appear here after your first completed booking.</p>}
      </section>
    </div>
  );

  const renderHelp = () => (
    <div className="space-y-5">
      <div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Help</p><h1 className="mt-1 text-2xl font-black text-slate-900">How can we help?</h1><p className="mt-1 text-sm text-slate-500">Get answers about bookings, points, compensation, or your provider.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <button onClick={onOpenAssistant} className="rounded-3xl border border-indigo-200 bg-indigo-50 p-5 text-left hover:border-indigo-400"><HelpCircle className="h-6 w-6 text-indigo-600" /><p className="mt-4 font-extrabold text-indigo-950">Ask TaskMate Assistant</p><p className="mt-1 text-sm text-indigo-800">Get quick help with your booking.</p></button>
        <div className="rounded-3xl border border-slate-200 bg-white p-5"><Bell className="h-6 w-6 text-amber-500" /><p className="mt-4 font-extrabold text-slate-900">Notifications</p><p className="mt-1 text-sm text-slate-500">{notifications.length ? `${notifications.length} updates from TaskMate.` : 'No new notifications.'}</p></div>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-extrabold text-slate-900">Recent notifications</h2>{notifications.slice(0, 5).map((notification) => <div key={notification.id} className="border-b border-slate-100 py-3 last:border-0"><p className="text-sm font-semibold text-slate-800">{notification.title}</p><p className="mt-1 text-xs text-slate-500">{notification.message}</p></div>)}{!notifications.length && <p className="py-4 text-sm text-slate-500">You are all caught up.</p>}</div>
    </div>
  );

  if (view === 'BOOKINGS') return renderBookings();
  if (view === 'POINTS') return renderPoints();
  if (view === 'HELP') return renderHelp();

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Profile</p><h1 className="mt-1 text-2xl font-black text-slate-900">Your account</h1><p className="mt-1 text-sm text-slate-500">Manage your details, points, bookings, and support.</p></div><button onClick={() => setIsEditing(true)} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700"><Edit3 className="h-4 w-4" />Edit profile</button></div>
      {saveMessage && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{saveMessage}</div>}
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-4"><img src={user.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`} alt={user.name} className="h-20 w-20 rounded-2xl object-cover ring-4 ring-indigo-50" /><div><h2 className="text-xl font-black text-slate-900">{user.name}</h2><p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500"><Mail className="h-4 w-4" />{user.email}</p></div></div><div className="mt-6 grid gap-3 text-sm sm:grid-cols-2"><p className="flex items-center gap-2 text-slate-700"><Phone className="h-4 w-4 text-indigo-600" />{user.phone || 'Phone not added'}</p><p className="flex items-center gap-2 text-slate-700"><MapPin className="h-4 w-4 text-indigo-600" />{user.address || 'Address not added'}</p></div></section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1"><div className="rounded-3xl bg-indigo-700 p-5 text-white"><p className="text-sm text-indigo-100">My Points</p><p className="mt-1 text-3xl font-black">{wallet?.reward_points || 0}</p><p className="mt-1 text-xs text-indigo-100">{wallet?.priority_tier || 'New Customer'}</p></div><div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-sm font-bold text-emerald-950">Compensation balance</p><p className="mt-1 text-2xl font-black text-emerald-800">₹{wallet?.refund_balance || 0}</p><p className="mt-1 text-xs text-emerald-800">Service credits: ₹{wallet?.service_credits || 0} · Compensation points: {wallet?.compensation_points || 0}</p></div></div>
      </div>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-extrabold text-slate-900">Saved address</h2><MapPin className="h-5 w-5 text-indigo-600" /></div><p className="mt-3 text-sm text-slate-600">{user.address || 'Add an address from Edit profile to use it for future bookings.'}</p></section>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-extrabold text-slate-900">Compensation history</h2><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div>{transactions.filter((transaction) => ['REFUND', 'SERVICE_CREDIT', 'COMPENSATION_POINTS'].includes(transaction.type)).length ? <div className="mt-2 divide-y divide-slate-100">{transactions.filter((transaction) => ['REFUND', 'SERVICE_CREDIT', 'COMPENSATION_POINTS'].includes(transaction.type)).map((transaction) => { const relatedTask = transaction.task_id ? tasks.find((task) => task.id === transaction.task_id) : undefined; return <div key={transaction.id} className="flex items-start justify-between gap-4 py-3"><div><p className="text-sm font-semibold text-slate-800">{transactionLabel[transaction.type]}</p><p className="mt-1 text-xs text-slate-500">{transaction.description}</p><p className="mt-1 text-[11px] text-slate-400">{new Date(transaction.created_at).toLocaleDateString()} {relatedTask ? `· ${relatedTask.title}` : ''}</p></div><span className="whitespace-nowrap text-sm font-black text-emerald-700">{transaction.type === 'COMPENSATION_POINTS' ? `+${transaction.amount} pts` : `₹${transaction.amount}`}</span></div>; })}</div> : <p className="mt-3 text-sm text-slate-500">Eligible compensation from unsuccessful bookings will appear here.</p>}</section>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-extrabold text-slate-900">Recent bookings</h2><span className="text-xs font-bold text-slate-500">{tasks.length} total</span></div>{tasks.slice(0, 3).map(renderBooking)}{!tasks.length && <p className="py-5 text-sm text-slate-500">You have not booked a service yet.</p>}</section>
      <section className="grid gap-4 sm:grid-cols-3"><button onClick={() => onOpenAssistant()} className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-left text-sm font-bold text-indigo-900"><HelpCircle className="mb-2 h-5 w-5 text-indigo-600" />Help & support</button><div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800"><ShieldCheck className="mb-2 h-5 w-5 text-emerald-600" />Secure account</div><button onClick={onLogout} className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-left text-sm font-bold text-rose-800"><X className="mb-2 h-5 w-5" />Log out</button></section>
      {isEditing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><form onSubmit={saveProfile} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div><h2 className="text-xl font-black text-slate-900">Edit profile</h2><p className="mt-1 text-sm text-slate-500">Keep your contact details up to date.</p></div><button type="button" onClick={() => setIsEditing(false)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div><div className="mt-5 space-y-4">{[['name', 'Full name'], ['email', 'Email address'], ['phone', 'Phone number'], ['address', 'Saved address'], ['avatar_url', 'Profile photo URL']].map(([key, label]) => <label key={key} className="block text-sm font-bold text-slate-700">{label}<input value={form[key as keyof typeof form]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} type={key === 'email' ? 'email' : 'text'} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label>)}</div>{errorMessage && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</p>}<div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setIsEditing(false)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100">Cancel</button><button type="submit" disabled={isSaving} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" />{isSaving ? 'Saving...' : 'Save changes'}</button></div></form></div>}
    </div>
  );
};

export type { AccountView };