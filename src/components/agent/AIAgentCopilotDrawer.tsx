import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../services/api';
import { 
  X, 
  Send, 
  Sparkles, 
  Bot, 
  ChevronRight, 
  TrendingUp, 
  Compass, 
  Briefcase 
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

export const AIAgentCopilotDrawer: React.FC<Props> = ({ isOpen, onClose, onAction }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Hello! I am your AI Agent Copilot. I help you evaluate your workload capacity, identify high-yield multi-task batches, optimize travel routes, and maximize your earnings.',
      suggestedActions: [
        { label: 'Check workload & capacity', action: 'QUERY_WORKLOAD' },
        { label: 'Explain my earnings', action: 'QUERY_EARNINGS' },
        { label: 'Available nearby tasks', action: 'QUERY_TASKS' },
        { label: 'Check verification status', action: 'QUERY_VERIF' },
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
      const res = await api.queryAgentAssistant(query);
      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        sender: 'assistant',
        text: res.reply,
        suggestedActions: res.suggestedActions,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setError('AI Assistant is temporarily unavailable. You can still manage your tasks normally.');
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: 'Sorry, the AI Assistant is temporarily unavailable. Your tasks, availability, and route tools are still available.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionClick = (action: { label: string; action: string; payload?: any }) => {
    if (action.action === 'VIEW_ROUTE') {
      onAction?.('VIEW_ROUTE');
      onClose();
      return;
    }

    if (action.action === 'QUERY_WORKLOAD') {
      handleSend('What is my current workload capacity and multi-task availability?');
    } else if (action.action === 'QUERY_EARNINGS') {
      handleSend('Explain my earnings and completed task metrics.');
    } else if (action.action === 'QUERY_TASKS') {
      handleSend('Are there any open nearby tasks in the matching queue?');
    } else if (action.action === 'QUERY_VERIF') {
      handleSend('What is my verification status and AI trust score?');
    } else {
      handleSend(action.label);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-300">
      
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-indigo-950 text-white">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
            <Sparkles className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold">AI Agent Copilot</h3>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-[10px] text-slate-300">Ask about workload, tasks, earnings, or routes</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
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
                      className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-800 font-semibold text-[11px] rounded-xl border border-emerald-200 shadow-2xs cursor-pointer transition-colors flex items-center gap-1"
                    >
                      <span>{act.label}</span>
                      <ChevronRight className="w-3 h-3 text-emerald-600" />
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
            <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span>AI Copilot checking fleet data...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="mx-3 mb-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          <p className="font-bold">{error}</p>
          <p className="mt-1 text-amber-800">Your tasks and route tools are still available.</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              if (lastQuery) handleSend(lastQuery);
            }}
            disabled={!lastQuery || isLoading}
            className="mt-3 rounded-xl bg-amber-900 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50"
          >
            Try again
          </button>
        </div>
      )}

      {/* Input */}
      <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
        <input
          type="text"
          placeholder="Ask about workload, earnings, routes..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || isLoading}
          className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl cursor-pointer disabled:opacity-40 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
};
