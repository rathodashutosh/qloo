import { useState, useRef, useEffect, useCallback } from 'react';
import { sendChatMessage } from '../api/client';
import {
  Send,
  MessageCircle,
  Bot,
  User,
  GripHorizontal,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Trash2,
  Sparkles
} from 'lucide-react';

/**
 * ChatBox — adjustable, resizable chat assistant for location intelligence questions.
 */
export default function ChatBox({ cellId, conceptId, city, locationData }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [height, setHeight] = useState(250);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const scrollRef = useRef(null);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(250);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current && !isMinimized) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, isMinimized]);

  // Drag-to-resize handler
  const handleMouseDown = useCallback((e) => {
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartHeight.current = height;
    setIsMinimized(false);

    const handleMouseMove = (moveEvent) => {
      // Dragging UP increases height, dragging DOWN decreases height
      const delta = dragStartY.current - moveEvent.clientY;
      const newHeight = Math.max(120, Math.min(560, dragStartHeight.current + delta));
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [height]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;

    const userMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const data = await sendChatMessage(text, {
        cell_id: cellId,
        concept_id: conceptId,
        city,
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
          content: `Error: ${err.message || 'Failed to get response'}. Check that your Qloo API key is configured.`,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

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
        className="h-10 bg-gradient-to-r from-slate-50 to-indigo-50/40 border-b border-slate-200 px-3 flex items-center justify-between cursor-row-resize select-none shrink-0 group hover:bg-slate-100 transition-colors"
        title="Drag up or down to resize chat height"
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center text-slate-400 group-hover:text-indigo-600 transition-colors">
            <GripHorizontal className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <MessageCircle className="h-3.5 w-3.5 text-indigo-600" />
            <span>AI Location Analyst</span>
          </div>
          {messages.length > 0 && (
            <span className="text-[10px] bg-indigo-100 text-indigo-700 font-semibold px-1.5 py-0.2 rounded-full">
              {messages.length}
            </span>
          )}
        </div>

        {/* Height Controls & Presets */}
        <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
          {messages.length > 0 && (
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
              setHeight(180);
            }}
            className={`px-1.5 py-0.5 text-[10px] rounded font-medium cursor-pointer transition-colors ${
              !isMinimized && height <= 200
                ? 'bg-indigo-600 text-white'
                : 'text-slate-500 hover:bg-white'
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
              !isMinimized && height > 200 && height < 440
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
              !isMinimized && height >= 440
                ? 'bg-indigo-600 text-white'
                : 'text-slate-500 hover:bg-white'
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

      {/* Messages and Input (hidden when minimized) */}
      {!isMinimized && (
        <div className="flex flex-col flex-1 p-2.5 overflow-hidden min-h-0 bg-white">
          {/* Scrollable message thread */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto space-y-2.5 pr-1 chat-scroll min-h-0 mb-2"
          >
            {messages.length === 0 && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-center space-y-1.5 my-auto">
                <Sparkles className="h-5 w-5 text-indigo-500 mx-auto" />
                <p className="text-xs font-semibold text-slate-700">
                  Ask about location strategy & taste affinity
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  e.g. <em>"Why is this location scored high?"</em> or <em>"What makes the target audience unique here?"</em>
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0 mt-0.5 text-indigo-700">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                )}
                <div
                  className={`rounded-xl px-3 py-2 text-xs leading-relaxed max-w-[88%] shadow-2xs ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-xs'
                      : 'bg-slate-100 text-slate-800 rounded-bl-xs border border-slate-200/60'
                  }`}
                >
                  {msg.content}
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
                <div className="w-6 h-6 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0 text-indigo-700">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-500 flex items-center gap-1.5">
                  <span className="text-[11px]">Analyzing with Qloo intelligence...</span>
                  <span className="inline-flex gap-1 ml-1">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Input Box */}
          <div className="flex items-center gap-2 border border-slate-200 rounded-xl bg-slate-50 focus-within:bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 px-2.5 py-1.5 shrink-0 transition-all">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about this location or concept..."
              className="flex-1 text-xs text-slate-800 placeholder-slate-400 outline-none bg-transparent py-1"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="p-1.5 rounded-lg bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-700 transition-all cursor-pointer disabled:cursor-not-allowed shadow-xs"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
