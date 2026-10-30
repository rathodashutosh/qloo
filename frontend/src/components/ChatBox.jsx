import { useState, useRef, useEffect, useCallback } from 'react';
import { sendChatMessage } from '../api/client';
import {
  Send,
  Sparkles,
  Bot,
  User,
  GripHorizontal,
  ChevronDown,
  ChevronUp,
  Trash2,
  Compass,
} from 'lucide-react';

/**
 * Format markdown lines and inline styles for assistant chat bubbles.
 */
function renderInline(text) {
  if (!text) return '';
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function formatMessage(content, isUser) {
  if (!content) return '';
  if (isUser) return <p className="whitespace-pre-wrap">{content}</p>;

  const lines = content.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="font-bold text-xs text-slate-900 mt-2 mb-0.5">
              {renderInline(trimmed.replace('### ', ''))}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className="font-bold text-xs text-indigo-950 mt-2 mb-0.5">
              {renderInline(trimmed.replace('## ', ''))}
            </h3>
          );
        }
        if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const clean = trimmed.replace(/^[•\-\*]\s*/, '');
          return (
            <div key={idx} className="flex items-start gap-1.5 text-xs text-slate-800">
              <span className="text-indigo-600 font-bold shrink-0 leading-relaxed">•</span>
              <span className="flex-1 leading-relaxed">{renderInline(clean)}</span>
            </div>
          );
        }
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }
        return (
          <p key={idx} className="text-xs text-slate-800 leading-relaxed">
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
}

/**
 * ChatBox — Gemini 2.5 Flash AI Location & Strategy Assistant.
 */
export default function ChatBox({ cellId, conceptId, city, locationData }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `👋 Hi! I'm your **Gemini AI Location Analyst**.\n\nI can answer **anything** about market opportunity, foot traffic demographics, competitor saturation, or strategic advice for opening in this city. Click any location on the map or ask me a question!`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [height, setHeight] = useState(270);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const scrollRef = useRef(null);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(270);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current && !isMinimized) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, isMinimized]);

  // Drag-to-resize handler
  const handleMouseDown = useCallback(
    (e) => {
      setIsDragging(true);
      dragStartY.current = e.clientY;
      dragStartHeight.current = height;
      setIsMinimized(false);

      const handleMouseMove = (moveEvent) => {
        const delta = dragStartY.current - moveEvent.clientY;
        const newHeight = Math.max(140, Math.min(580, dragStartHeight.current + delta));
        setHeight(newHeight);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [height]
  );

  const sendMessageText = async (textToSend) => {
    const text = textToSend.trim();
    if (!text || isTyping) return;

    const userMessage = { role: 'user', content: text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setIsTyping(true);

    // Build chat history for Gemini multi-turn continuity
    const historyPayload = nextMessages.slice(-8).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const data = await sendChatMessage(text, {
        cell_id: cellId,
        concept_id: conceptId,
        city,
        history: historyPayload,
        lat: locationData?.lat,
        lon: locationData?.lon,
        cell_label: locationData?.label,
        demand: locationData?.demand,
        supply: locationData?.supply,
        gap: locationData?.gap,
        venue_count: locationData?.venues?.length ?? locationData?.venue_count,
        venues: locationData?.venues?.slice(0, 20),
        taste_tags: locationData?.taste_tags || locationData?.tags,
      });

      const botMessage = {
        role: 'assistant',
        content: data.response || data.message || data.answer || 'Analysis complete.',
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ Error communicating with Gemini: ${
            err.response?.data?.detail || err.message || 'Please verify network or key.'
          }`,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = () => sendMessageText(input);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearMessages = () => {
    setMessages([
      {
        role: 'assistant',
        content: `Chat cleared. Ask me any question about the selected area, competitor strategies, or business viability!`,
      },
    ]);
  };

  // Quick suggestion chips based on whether an area is selected
  const hasSelectedArea = Boolean(locationData || cellId);
  const suggestionChips = hasSelectedArea
    ? [
        { label: '☕ Competitor Audit', prompt: 'Who are all the competitors nearby and how saturated is the supply?' },
        { label: '📊 Opportunity Breakdown', prompt: 'Break down the taste demand, supply saturation, and opportunity gap for this area.' },
        { label: '🎯 Target Audience', prompt: 'What does the Qloo consumer taste profile tell us about the audience here?' },
        { label: '💡 Differentiation Strategy', prompt: 'What is the best strategy to stand out and win customers in this spot?' },
      ]
    : [
        { label: '🌆 Top Neighborhoods', prompt: `What are the most promising neighborhoods in ${city || 'this city'} for this concept?` },
        { label: '📈 How Gap Score Works', prompt: 'Explain how the Opportunity Gap formula works and how Qloo taste data is used.' },
        { label: '🚀 Launch Strategy', prompt: 'What are the top three things to verify before signing a commercial lease?' },
      ];

  return (
    <div
      style={{ height: isMinimized ? '44px' : `${height}px` }}
      className={`flex flex-col bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden transition-[height] duration-75 ${
        isDragging ? 'select-none ring-2 ring-indigo-400' : ''
      }`}
    >
      {/* Draggable Resize Bar & Header */}
      <div
        onMouseDown={handleMouseDown}
        className="h-10 bg-gradient-to-r from-slate-50 via-indigo-50/30 to-purple-50/40 border-b border-slate-200 px-3 flex items-center justify-between cursor-row-resize select-none shrink-0 group hover:bg-slate-100 transition-colors"
        title="Drag up or down to resize chat height"
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center text-slate-400 group-hover:text-indigo-600 transition-colors">
            <GripHorizontal className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <Sparkles className="h-3.5 w-3.5 text-indigo-600 animate-pulse" />
            <span>Gemini AI Assistant</span>
          </div>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-2xs">
            2.5 Flash
          </span>
        </div>

        {/* Height Controls & Presets */}
        <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
          {messages.length > 1 && (
            <button
              onClick={clearMessages}
              title="Clear chat"
              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-white cursor-pointer transition-colors"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}

          {/* Quick preset sizes */}
          <button
            onClick={() => {
              setIsMinimized(false);
              setHeight(190);
            }}
            className={`px-1.5 py-0.5 text-[10px] rounded font-medium cursor-pointer transition-colors ${
              !isMinimized && height <= 210 ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-white'
            }`}
          >
            Compact
          </button>
          <button
            onClick={() => {
              setIsMinimized(false);
              setHeight(320);
            }}
            className={`px-1.5 py-0.5 text-[10px] rounded font-medium cursor-pointer transition-colors ${
              !isMinimized && height > 210 && height < 440
                ? 'bg-indigo-600 text-white'
                : 'text-slate-500 hover:bg-white'
            }`}
          >
            Standard
          </button>
          <button
            onClick={() => {
              setIsMinimized(false);
              setHeight(480);
            }}
            className={`px-1.5 py-0.5 text-[10px] rounded font-medium cursor-pointer transition-colors ${
              !isMinimized && height >= 440 ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-white'
            }`}
          >
            Expand
          </button>

          {/* Minimize / Restore toggle */}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Expand Chat' : 'Minimize Chat'}
            className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-white cursor-pointer ml-1"
          >
            {isMinimized ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Messages, Quick Chips & Input (hidden when minimized) */}
      {!isMinimized && (
        <div className="flex flex-col flex-1 p-2.5 overflow-hidden min-h-0 bg-white">
          {/* Scrollable message thread */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2.5 pr-1 chat-scroll min-h-0 mb-1.5">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <Sparkles className="h-3 w-3" />
                  </div>
                )}
                <div
                  className={`rounded-xl px-3 py-2 text-xs leading-relaxed max-w-[90%] shadow-2xs ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-xs'
                      : 'bg-slate-50 text-slate-800 rounded-bl-xs border border-slate-200/70'
                  }`}
                >
                  {formatMessage(msg.content, msg.role === 'user')}
                </div>
                {msg.role === 'user' && (
                  <div className="w-6 h-6 rounded-lg bg-slate-200 flex items-center justify-center shrink-0 mt-0.5 text-slate-600">
                    <User className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Sparkles className="h-3 w-3 animate-spin" />
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-indigo-700 font-medium flex items-center gap-2">
                  <span className="text-[11px]">Gemini 2.5 Flash is thinking...</span>
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Suggestion Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 shrink-0 no-scrollbar mb-1.5">
            {suggestionChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => sendMessageText(chip.prompt)}
                disabled={isTyping}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 border border-slate-200 text-[10px] font-medium transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="flex items-center gap-2 border border-slate-200 rounded-xl bg-slate-50 focus-within:bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 px-2.5 py-1 shrink-0 transition-all">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about this location, competitors, strategy..."
              className="flex-1 text-xs text-slate-800 placeholder-slate-400 outline-none bg-transparent py-1.5"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="p-1.5 rounded-lg bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-700 transition-all cursor-pointer disabled:cursor-not-allowed shadow-xs"
              title="Send message"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
