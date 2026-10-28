import { useState, useRef, useEffect } from 'react';
import { sendChatMessage } from '../api/client';
import { Send, MessageCircle, Bot, User } from 'lucide-react';

/**
 * ChatBox — chat input at bottom of sidebar for follow-up questions.
 */
export default function ChatBox({ cellId, conceptId, city }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

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
      });

      const botMessage = {
        role: 'assistant',
        content: data.response || data.message || data.answer || 'No response received.',
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${err.message || 'Failed to get response'}. Make sure the API server is running.`,
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

  return (
    <div className="flex flex-col h-full max-h-[280px]">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
        <MessageCircle className="h-3.5 w-3.5" />
        Ask a Question
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-2 mb-2 chat-scroll min-h-0"
      >
        {messages.length === 0 && (
          <p className="text-[11px] text-slate-400 italic py-2">
            Ask about demand patterns, location strategy, or competitive landscape...
          </p>
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
              className={`rounded-lg px-2.5 py-1.5 text-xs leading-relaxed max-w-[85%] ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {msg.content}
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
            <div className="bg-slate-100 rounded-lg px-3 py-2 text-xs text-slate-400">
              <span className="inline-flex gap-1">
                <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg bg-white px-2 py-1">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a follow-up question..."
          className="flex-1 text-xs text-slate-700 placeholder-slate-400 outline-none bg-transparent py-1"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isTyping}
          className="p-1.5 rounded-md bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-700 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          <Send className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
