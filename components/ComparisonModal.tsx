
import React, { useState, useEffect, useRef } from 'react';
import { XIcon, SparklesIcon, EditIcon } from './Icons';

interface ComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  oldContent: string;
  newContent: string; // Streamed content from parent
  onConfirm: (finalContent: string) => void;
  isApplying: boolean;
  isStreaming: boolean;
}

const ComparisonModal: React.FC<ComparisonModalProps> = ({
  isOpen, onClose, title, oldContent, newContent, onConfirm, isApplying, isStreaming
}) => {
  const [localContent, setLocalContent] = useState(newContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync local content with streaming content, but only if streaming is active
  // This allows the user to edit the text once streaming stops without it being overwritten
  useEffect(() => {
    if (isStreaming) {
        setLocalContent(newContent);
        // Auto-scroll to bottom while streaming
        if (textareaRef.current) {
            textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
        }
    } else if (newContent && !localContent) {
        // Initial load if not streaming
        setLocalContent(newContent);
    }
  }, [newContent, isStreaming]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl w-full max-w-6xl h-[80vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                <SparklesIcon />
            </div>
            <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">优化建议对比 (Optimization Review)</h2>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{title}</span>
                    {!isStreaming && (
                        <span className="flex items-center gap-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                           <EditIcon /> 右侧内容可编辑
                        </span>
                    )}
                </div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:hover:text-white">
            <XIcon />
          </button>
        </div>

        {/* Content Comparison */}
        <div className="flex-1 flex overflow-hidden">
            {/* Old Content (Read Only) */}
            <div className="flex-1 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-red-50/30 dark:bg-red-900/10 w-1/2">
                <div className="p-2 text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 text-center shrink-0">
                    原文 (Original)
                </div>
                <div className="flex-1 overflow-y-auto p-4 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-serif leading-relaxed text-gray-700 dark:text-gray-300 select-text">
                    {oldContent}
                </div>
            </div>

            {/* New Content (Editable) */}
            <div className="flex-1 flex flex-col bg-green-50/30 dark:bg-green-900/10 w-1/2">
                <div className="p-2 text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 text-center shrink-0 flex justify-between px-4 items-center">
                    <span>优化后 (New Version) - 可编辑</span>
                    {isStreaming && <span className="animate-pulse">生成中...</span>}
                </div>
                <div className="flex-1 relative">
                    <textarea 
                        ref={textareaRef}
                        value={localContent}
                        onChange={(e) => setLocalContent(e.target.value)}
                        disabled={isStreaming}
                        className="w-full h-full p-4 bg-transparent border-none resize-none focus:ring-0 focus:outline-none font-serif leading-relaxed text-gray-900 dark:text-gray-100 text-sm overflow-y-auto"
                        placeholder="AI 生成的内容将显示在这里。生成结束后，你可以自由编辑这里的内容，保留你满意的部分..."
                    />
                </div>
            </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-end gap-3 items-center">
            <span className="text-xs text-gray-400 mr-auto hidden sm:block">
                提示：请在右侧编辑框中删除多余的选项或废话，确认后将替换原文。
            </span>
            <button 
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
                取消 (保留原文)
            </button>
            <button 
                onClick={() => onConfirm(localContent)}
                disabled={isApplying || isStreaming}
                className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isApplying ? '应用中...' : '确认替换 (Replace)'}
            </button>
        </div>

      </div>
    </div>
  );
};

export default ComparisonModal;
