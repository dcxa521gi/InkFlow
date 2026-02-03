
import React, { useRef, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Message } from '../types';
import { SendIcon, CopyIcon, StopIcon, EditIcon, SparklesIcon } from './Icons';

interface ChatAreaProps {
  messages: Message[];
  input: string;
  isStreaming: boolean;
  placeholderText: string;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSend: (text?: string) => void;
  onStop: () => void;
  onMessageEdit: (id: string, newContent: string) => void;
  onSummarize: () => void;
}

const ChatArea: React.FC<ChatAreaProps> = ({ 
  messages, 
  input, 
  isStreaming, 
  placeholderText,
  onInputChange, 
  onSend,
  onStop,
  onMessageEdit,
  onSummarize
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputLength = input.length;
  const maxLength = 2000;

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!editingId) {
        scrollToBottom();
    }
  }, [messages, isStreaming, editingId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
  };

  // Robust regex for matching Options at the end of text
  // Matches: \nOptions:, \n**Options**:, \nOptions： (Chinese)
  const OPTIONS_REGEX = /(?:^|\n)\s*(?:\*\*|__)?Options(?:\*\*|__)?[:：][\s\S]*$/i;

  const startEditing = (msg: Message) => {
      setEditingId(msg.id);
      setEditContent(msg.content.replace(OPTIONS_REGEX, '').trim());
  };

  const saveEdit = () => {
      if (editingId) {
          onMessageEdit(editingId, editContent);
          setEditingId(null);
          setEditContent('');
      }
  };

  const cancelEdit = () => {
      setEditingId(null);
      setEditContent('');
  };

  // Extract suggestions from the last message if it's from the model and not streaming
  const suggestions = useMemo(() => {
    if (messages.length === 0) return [];
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== 'model' || isStreaming) return [];

    // Regex with capturing group for the content after "Options:"
    const match = lastMsg.content.match(/(?:^|\n)\s*(?:\*\*|__)?Options(?:\*\*|__)?[:：]([\s\S]*)$/i);
    
    if (match && match[1]) {
        // Extract content inside brackets [Option]
        const rawOptions = match[1].match(/\[(.*?)\]/g);
        if (rawOptions) {
            return rawOptions.map(o => o.replace(/[\[\]]/g, '').trim());
        }
    }
    return [];
  }, [messages, isStreaming]);

  // Clean content for display (remove the Options line and everything after it)
  const getDisplayContent = (content: string) => {
      return content.replace(OPTIONS_REGEX, '').trim();
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900/50 relative">
      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 opacity-60">
             <div className="text-6xl mb-4">✒️</div>
             <p>开始构思你的小说吧...</p>
          </div>
        )}
        
        {messages.map((msg, index) => (
          <div 
            key={msg.id} 
            className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[85%] rounded-2xl px-5 py-3.5 shadow-sm relative group ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-br-none' 
                  : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-none border border-gray-200 dark:border-gray-700'
              }`}
            >
              {editingId === msg.id ? (
                  <div className="flex flex-col gap-2 min-w-[300px]">
                      <textarea 
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full h-32 p-2 text-sm bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-900 dark:text-gray-100"
                      />
                      <div className="flex justify-end gap-2">
                          <button onClick={cancelEdit} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">取消</button>
                          <button onClick={saveEdit} className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-500">保存</button>
                      </div>
                  </div>
              ) : (
                <div className={`text-sm leading-relaxed prose prose-sm max-w-none 
                    ${msg.role === 'user' 
                        ? 'prose-invert text-white' 
                        : 'text-gray-800 dark:text-gray-200 dark:prose-invert dark:prose-headings:text-gray-100 dark:prose-p:text-gray-300 dark:prose-strong:text-white dark:prose-blockquote:text-gray-400 dark:prose-code:text-pink-300'
                    }`}>
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkBreaks]}
                        components={{
                            p: ({children}) => <p className="!mb-2 !mt-0 last:!mb-0">{children}</p>,
                            a: ({node, ...props}) => <a {...props} className="text-blue-300 hover:underline" target="_blank" rel="noopener noreferrer" />,
                            code: ({node, className, children, ...props}: any) => {
                                const match = /language-(\w+)/.exec(className || '')
                                return match ? (
                                    <code className="block bg-black/20 rounded p-2 my-2 text-xs font-mono whitespace-pre-wrap overflow-x-auto" {...props}>{children}</code>
                                ) : (
                                    <code className="bg-black/20 rounded px-1 py-0.5 text-xs font-mono" {...props}>{children}</code>
                                )
                            }
                        }}
                    >
                    {msg.role === 'model' ? getDisplayContent(msg.content) : msg.content}
                    </ReactMarkdown>

                    {msg.role === 'model' && isStreaming && index === messages.length - 1 && (
                    <span className="typing-cursor inline-block w-2 h-4 bg-indigo-400 align-middle ml-1"></span>
                    )}
                </div>
              )}
              
              {/* Message Actions */}
              {!isStreaming && editingId !== msg.id && (
                  <div className={`absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
                     {msg.role === 'model' && (
                        <button 
                            onClick={() => startEditing(msg)}
                            className="p-1 rounded hover:bg-black/10 dark:hover:bg-black/20 text-gray-400"
                            title="编辑"
                        >
                            <EditIcon />
                        </button>
                     )}
                     <button 
                        onClick={() => copyToClipboard(getDisplayContent(msg.content))}
                        className={`p-1 rounded hover:bg-black/10 dark:hover:bg-black/20 ${msg.role === 'user' ? 'text-indigo-200' : 'text-gray-400'}`}
                        title="复制内容"
                    >
                        <CopyIcon />
                    </button>
                  </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips */}
      {!isStreaming && suggestions.length > 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-2 justify-end animate-fadeIn">
              {suggestions.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSend(option)}
                    className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs px-3 py-1.5 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-800 transition-colors shadow-sm"
                  >
                      {option}
                  </button>
              ))}
          </div>
      )}

      {/* Input Area */}
      <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shrink-0">
        <div className="relative max-w-4xl mx-auto flex flex-col gap-2">
            
            {/* Input Toolbar */}
            <div className="flex justify-between items-center px-1">
                 <div className="text-[10px] text-gray-400 dark:text-gray-500">
                     {isStreaming ? '正在生成...' : 'Ready'}
                 </div>
                 {!isStreaming && messages.length > 2 && (
                     <button 
                        onClick={onSummarize}
                        className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
                        title="生成当前对话摘要"
                     >
                         <SparklesIcon /> 总结对话
                     </button>
                 )}
            </div>

            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={onInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={isStreaming ? "AI 正在创作中..." : placeholderText}
                    disabled={isStreaming}
                    className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 border border-gray-200 dark:border-gray-700 rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                />
                {isStreaming ? (
                    <button
                        onClick={onStop}
                        className="p-3 rounded-xl transition-all bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20"
                        title="停止生成"
                    >
                        <StopIcon />
                    </button>
                ) : (
                    <button
                        onClick={() => onSend()}
                        disabled={!input.trim()}
                        className={`p-3 rounded-xl transition-all ${
                        !input.trim() 
                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed' 
                            : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20'
                        }`}
                    >
                        <SendIcon />
                    </button>
                )}
            </div>
            {/* Character Counter */}
            <div className="flex justify-end pr-1">
                <span className={`text-[10px] ${inputLength > maxLength ? 'text-red-500 font-bold' : 'text-gray-400 dark:text-gray-600'}`}>
                    {inputLength} / {maxLength}
                </span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ChatArea;
