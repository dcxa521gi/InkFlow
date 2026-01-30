
import React from 'react';
import { NovelSession } from '../types';
import { XIcon, TrashIcon, PlusIcon, BookOpenIcon } from './Icons';

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  novels: NovelSession[];
  currentNovelId: string;
  onSelectNovel: (id: string) => void;
  onCreateNovel: () => void;
  onDeleteNovel: (id: string) => void;
}

const LibraryModal: React.FC<LibraryModalProps> = ({ 
    isOpen, onClose, novels, currentNovelId, onSelectNovel, onCreateNovel, onDeleteNovel 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl h-[600px] max-h-[90vh] overflow-hidden flex flex-col transition-colors">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-2">
             <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                 <BookOpenIcon />
             </div>
             <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">图书库 (Library)</h2>
                <p className="text-xs text-gray-500">管理你的所有小说创作</p>
             </div>
          </div>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            <XIcon />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-950">
            <div className="grid gap-4">
                {/* Create New Card */}
                <button 
                    onClick={onCreateNovel}
                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-500 hover:text-indigo-600 transition-all gap-2 group min-h-[120px]"
                >
                    <div className="p-2 bg-gray-200 dark:bg-gray-800 rounded-full group-hover:bg-indigo-200 dark:group-hover:bg-indigo-800 transition-colors">
                        <PlusIcon />
                    </div>
                    <span className="font-medium text-sm">新建小说</span>
                </button>

                {/* Novel Cards */}
                {novels.sort((a,b) => b.lastModified - a.lastModified).map(novel => {
                    // Estimate word count from messages
                    const wordCount = novel.messages.reduce((acc, msg) => acc + msg.content.length, 0);
                    const isActive = novel.id === currentNovelId;

                    return (
                        <div 
                            key={novel.id} 
                            onClick={() => onSelectNovel(novel.id)}
                            className={`relative flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-all shadow-sm group
                                ${isActive 
                                    ? 'bg-white dark:bg-gray-900 border-indigo-500 ring-1 ring-indigo-500' 
                                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                                }
                            `}
                        >
                            <div className="flex-1 min-w-0">
                                <h3 className={`font-bold text-base truncate ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-white'}`}>
                                    {novel.title}
                                </h3>
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                    <span>字数: {(wordCount/10000).toFixed(1)}万</span>
                                    <span>最后修改: {new Date(novel.lastModified).toLocaleString()}</span>
                                    <span className="truncate max-w-[150px] opacity-70">Model: {novel.settings.provider}</span>
                                </div>
                            </div>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if(confirm(`确定要删除《${novel.title}》吗？此操作无法撤销。`)) {
                                        onDeleteNovel(novel.id);
                                    }
                                }}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                title="删除小说"
                            >
                                <TrashIcon />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>

      </div>
    </div>
  );
};

export default LibraryModal;
