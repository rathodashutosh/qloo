import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { sendChatMessage } from '../api/client';
import {
  Send,
  MessageCircle,
  Bot,
  User,
  Sparkles,
  RotateCcw,
  Maximize2,
  Minimize2,
  GripHorizontal,
} from 'lucide-react';

const SUGGESTED_PROMPTS = [
  'What about opening a Chinese restaurant here?',
  'Who are the daily students and commuters here?',
  'What pricing and menu strategy fits this street?',
  'Delivery vs dine-in potential for this corridor?',
];

/**
 * ChatBox — interactive location intelligence chat assistant with adjustable height.
 */
export default function ChatBox({ cellId, conceptId, city, selectedCell, livePointData }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatHeight, setChatHeight] = useState(260); // default height in px
  const scrollRef = useRef(null);

  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(260);

  // Auto-scroll on new messages or typing state
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Handle Drag Resizing
  const handleMouseMove = useCallback((e) => {
    if (!isDraggingRef.current) return;
    const deltaY = startYRef.current - e.clientY; // dragging up expands height
    const nextH = Math.max(130, Math.min(580, startHeightRef.current + deltaY));
    setChatHeight(nextH);
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = (e) => {
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = chatHeight;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleSend = async (textOverride) => {
    const text = (typeof textOverride === 'string' ? textOverride : input).trim();
    if (!text || isTyping) return;

    const userMessage = { role: 'user', content: text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setIsTyping(true);

    // Build rich location context
    const activeData = livePointData || selectedCell;
    const context = {
      city,
      concept_id: conceptId,
      cell_id: cellId,
      label: activeData?.label || selectedCell?.label,
      suburb: activeData?.suburb,
      lat: activeData?.lat,
      lon: activeData?.lon,
      demand: activeData?.demand,
      supply: activeData?.supply,
      gap: activeData?.gap,
      landmarks: activeData?.landmarks || [],
      venues: (activeData?.venues || []).slice(0, 10),
      taste_tags: activeData?.taste_tags || [],
    };

    try {
      const history = nextMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const data = await sendChatMessage(text, context, history);

      const botMessage = {
        role: 'assistant',
        content: data.response || data.reply || data.message || 'No response received.',
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${err.response?.data?.detail || err.message || 'Failed to get response'}.`,
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

  // Preset Height Shortcuts
  const setPresetHeight = (h) => {
    setChatHeight(h);
  };

  const messagesAreaHeight = Math.max(60, chatHeight - 110);

  return (
    <div
      style={{ height: `${chatHeight}px` }}
      className="flex flex-col w-full relative transition-[height] duration-75 select-none"
    >
      {/* Draggable Divider Handle */}
      <div
        onMouseDown={handleMouseDown}
        title="Drag up or down to adjust chat height"
        className="w-full py-1 -mt-2.5 mb-1 flex items-center justify-center cursor-row-resize group hover:bg-indigo-50/80 rounded transition-colors"
      >
        <div className="flex items-center gap-1 text-slate-300 group-hover:text-indigo-500">
          <GripHorizontal className="h-4 w-4" />
          <span className="text-[9px] font-medium tracking-tight text-slate-400 group-hover:text-indigo-600 hidden sm:inline">
            Drag to resize
          </span>
        </div>
      </div>

      {/* Header with Title and Presets */}
      <div className="flex items-center justify-between text-xs font-semibold text-slate-600 tracking-wider mb-1.5 shrink-0">
        <span className="flex items-center gap-1.5 text-slate-800">
          <MessageCircle className="h-3.5 w-3.5 text-indigo-600" />
          <span className="text-[11px] font-bold">Location AI Assistant</span>
        </span>

        {/* Height Controls & Actions */}
        <div className="flex items-center gap-1.5">
          {/* Preset Buttons */}
          <div className="flex items-center bg-slate-200/60 p-0.5 rounded text-[10px] text-slate-600 font-mono">
            <button
              onClick={() => setPresetHeight(150)}
              title="Compact (150px)"
              className={`px-1.5 py-0.2 rounded cursor-pointer transition-all ${
                chatHeight <= 170 ? 'bg-white shadow-2xs font-bold text-indigo-700' : 'hover:text-slate-900'
              }`}
            >
              Sm
            </button>
            <button
              onClick={() => setPresetHeight(270)}
              title="Standard (270px)"
              className={`px-1.5 py-0.2 rounded cursor-pointer transition-all ${
                chatHeight > 170 && chatHeight <= 360 ? 'bg-white shadow-2xs font-bold text-indigo-700' : 'hover:text-slate-900'
              }`}
            >
              Md
            </button>
            <button
              onClick={() => setPresetHeight(460)}
              title="Expanded (460px)"
              className={`px-1.5 py-0.2 rounded cursor-pointer transition-all ${
                chatHeight > 360 ? 'bg-white shadow-2xs font-bold text-indigo-700' : 'hover:text-slate-900'
              }`}
            >
              Lg
            </button>
          </div>

          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              title="Clear conversation"
              className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-0.5"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollRef}
        style={{ height: `${messagesAreaHeight}px` }}
        className="overflow-y-auto space-y-2 mb-2 chat-scroll pr-1 select-text"
      >
        {messages.length === 0 && (
          <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-lg p-2.5 leading-relaxed space-y-1.5">
            <p className="font-semibold text-slate-700 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500" />
              Suggested 1-click questions:
            </p>
            <div className="flex flex-wrap gap-1">
              {SUGGESTED_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  className="text-[10px] text-left bg-white border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-slate-700 px-2 py-1 rounded-md transition-all cursor-pointer shadow-2xs"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-1.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="h-3 w-3 text-indigo-600" />
              </div>
            )}
            <div
              className={`rounded-lg px-3 py-2 text-xs leading-relaxed max-w-[88%] shadow-2xs ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-700'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-xs prose-slate max-w-none break-words">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="h-3 w-3 text-slate-500" />
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <Bot className="h-3 w-3 text-indigo-600" />
            </div>
            <div className="bg-slate-100 rounded-lg px-3 py-2 text-xs text-slate-500 flex items-center gap-1.5">
              <span>Synthesizing location data...</span>
              <span className="inline-flex gap-1">
                <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Suggested chips row when messages already exist */}
      {messages.length > 0 && chatHeight > 200 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1.5 scrollbar-none shrink-0">
          {SUGGESTED_PROMPTS.slice(0, 3).map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(prompt)}
              disabled={isTyping}
              className="text-[10px] whitespace-nowrap bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            >
              {prompt.replace('?', '')}
            </button>
          ))}
        </div>
      )}

      {/* Input Form */}
      <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg bg-white px-2.5 py-1.5 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-300 transition-all shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about this location..."
          disabled={isTyping}
          className="flex-1 text-xs text-slate-700 placeholder-slate-400 outline-none bg-transparent py-0.5"
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || isTyping}
          className="p-1.5 rounded-md bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-700 transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0"
        >
          <Send className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
