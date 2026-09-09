import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../services/api';
import { 
  X, 
  Send, 
  Sparkles, 
  Bot, 
  User, 
  Clock, 
  ShieldCheck, 
  HelpCircle, 
  ChevronRight 
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAction?: (action: string, payload?: any) => void;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  suggestedActions?: { label: string; action: string; payload?: any }[];
  timestamp: string;
}

export const AICustomerAssistantDrawer: React.FC<Props> = ({ isOpen, onClose, onAction }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Hi! How can I help you today? I can help you book a service, check a booking, explain your points, or get support.',
      suggestedActions: [
        { label: 'Book a service', action: 'CREATE_TASK' },
        { label: 'Check my booking', action: 'QUERY_STATUS' },
        { label: 'Find a nearby provider', action: 'QUERY_AGENTS' },
        { label: 'Explain my points', action: 'QUERY_POINTS' },
        { label: 'Get help', action: 'QUERY_COMPENSATION' },
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLastQuery(query);
    setError(null);
    setIsLoading(true);

    try {
      const res = await api.queryCustomerAssistant(query);
      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        sender: 'assistant',
        text: res.reply,
        suggestedActions: res.suggestedActions,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setError('AI Assistant is temporarily unavailable. You can still use TaskMate normally.');
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: 'Sorry, the AI Assistant is temporarily unavailable. You can still book services, view your bookings, and get support normally.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionClick = (action: { label: string; action: string; payload?: any }) => {
    if (action.action === 'CREATE_TASK' || action.action === 'VIEW_WALLET') {
      onAction?.(action.action, action.payload);
      onClose();
      return;
    }

    if (action.action === 'QUERY_STATUS') {
      handleSend('Where is my agent and what is the live ETA?');
    } else if (action.action === 'QUERY_COMPENSATION') {
      handleSend('Explain my compensation policy and wallet balances.');
    } else if (action.action === 'QUERY_POINTS') {
      handleSend('How many reward points do I have and what are my priority perks?');
    } else if (action.action === 'QUERY_AGENTS') {
      handleSend('Find available verified helpers near my location.');
    } else {
      handleSend(action.label);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-300">
      
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-900 to-indigo-800 text-white">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center text-indigo-200">
            <Bot className="w-5 h-5 text-indigo-200" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold">TaskMate AI Assistant</h3>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-[10px] text-indigo-200">Ask about tasks, ETA, points, or refunds</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 text-indigo-200 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50">
        {messages.map((m) => {
          const isAssistant = m.sender === 'assistant';
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'} space-y-1`}
            >
              <div
                className={`max-w-[88%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                  isAssistant
                    ? 'bg-white border border-slate-200 text-slate-800 shadow-xs whitespace-pre-line'
                    : 'bg-indigo-600 text-white shadow-sm'
                }`}
              >
                {m.text}
              </div>

              {m.suggestedActions && m.suggestedActions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  {m.suggestedActions.map((act, i) => (
                    <button
                      key={i}
                      onClick={() => handleActionClick(act)}
                      className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 font-semibold text-[11px] rounded-xl border border-indigo-200 shadow-2xs cursor-pointer transition-colors flex items-center gap-1"
                    >
                      <span>{act.label}</span>
                      <ChevronRight className="w-3 h-3 text-indigo-400" />
                    </button>
                  ))}
                </div>
              )}

              <span className="text-[9px] text-slate-400 px-1">{m.timestamp}</span>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 p-3 bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs w-fit">
            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span>AI Assistant thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="mx-3 mb-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          <p className="font-bold">{error}</p>
          <p className="mt-1 text-amber-800">Your bookings and support options are still available.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setError(null);
                if (lastQuery) handleSend(lastQuery);
              }}
              disabled={!lastQuery || isLoading}
              className="rounded-xl bg-amber-900 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => {
                onAction?.('CREATE_TASK');
                onClose();
              }}
              className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-[11px] font-bold text-amber-900"
            >
              Book a service
            </button>
            <button
              type="button"
              onClick={() => {
                onAction?.('CONTACT_SUPPORT');
                onClose();
              }}
              className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-[11px] font-bold text-amber-900"
            >
              Contact support
            </button>
          </div>
        </div>
      )}

      {/* Input Box */}
      <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
        <input
          type="text"
          placeholder="Ask about tasks, ETA, refunds..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || isLoading}
          className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl cursor-pointer disabled:opacity-40 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
};
