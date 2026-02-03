
import React, { useState } from 'react';
import { NovelSession } from '../types';
import { XIcon, TrashIcon, PlusIcon, BookOpenIcon, EditIcon, SparklesIcon } from './Icons';

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  novels: NovelSession[];
  currentNovelId: string;
  onSelectNovel: (id: string) => void;
  onCreateNovel: () => void;
  onDeleteNovel: (id: string) => void;
  onRenameNovel: (id: string, newTitle: string) => void;
  onDeconstructNovel: (input: string) => void;
}

const LibraryModal: React.FC<LibraryModalProps> = ({ 
    isOpen, onClose, novels, currentNovelId, onSelectNovel, onCreateNovel, onDeleteNovel, onRenameNovel, onDeconstructNovel
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  
  // Deconstruction State
  const [deconstructInput, setDeconstructInput] = useState('');

  if (!isOpen) return null;

  const startEditing = (e: React.MouseEvent, novel: NovelSession) => {
      e.stopPropagation();
      setEditingId(novel.id);
      setEditName(novel.title);
  };

  const saveEditing = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (editName.trim()) {
          onRenameNovel(id, editName.trim());
      }
      setEditingId(null);
  };

  const handleDelete = (e: React.MouseEvent, id: string, title: string) => {
      e.stopPropagation();
      if(window.confirm(`确定要删除《${title}》吗？此操作无法撤销。`)) {
          onDeleteNovel(id);
      }
  };

  const handleDeconstruct = () => {
      if (!deconstructInput.trim()) return;
      onDeconstructNovel(deconstructInput);
      setDeconstructInput('');
      onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl w-full max-w-5xl h-[700px] max-h-[90vh] overflow-hidden flex flex-col transition-colors">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 shrink-0">
          <div className="flex items-center gap-2">
             <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                 <BookOpenIcon />
             </div>
             <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">创作中心 (Workspace)</h2>
                <p className="text-xs text-gray-500">管理小说与灵感拆解</p>
             </div>
          </div>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            <XIcon />
          </button>
        </div>

        {/* Body Layout */}
        <div className="flex flex-1 overflow-hidden">
            
            {/* Left: Novel List */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-700 dark:text-gray-300">我的作品</h3>
                    <span className="text-xs text-gray-500">{novels.length} 本书</span>
                </div>

                <div className="grid gap-3">
                    {/* Create New Card */}
                    <button 
                        onClick={onCreateNovel}
                        className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-500 hover:text-indigo-600 transition-all gap-2 group w-full"
                    >
                        <PlusIcon />
                        <span className="font-medium text-sm">新建空白小说</span>
                    </button>

                    {/* Novel Cards */}
                    {novels.sort((a,b) => b.lastModified - a.lastModified).map(novel => {
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
                                <div className="flex-1 min-w-0 mr-4">
                                    {editingId === novel.id ? (
                                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                            <input 
                                                type="text" 
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="w-full px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                autoFocus
                                            />
                                            <button onClick={(e) => saveEditing(e, novel.id)} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded">确定</button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 group/title">
                                            <h3 className={`font-bold text-base truncate ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-white'}`}>
                                                {novel.title}
                                            </h3>
                                            <button 
                                                onClick={(e) => startEditing(e, novel)}
                                                className="opacity-0 group-hover/title:opacity-100 text-gray-400 hover:text-indigo-500 transition-opacity"
                                            >
                                                <EditIcon />
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        <span>字数: {(wordCount/10000).toFixed(1)}万</span>
                                        <span>更新: {new Date(novel.lastModified).toLocaleDateString()}</span>
                                    </div>
                                </div>

                                {/* Fixed Delete Button Z-index and Click Handling */}
                                <button
                                    onClick={(e) => handleDelete(e, novel.id, novel.title)}
                                    className="relative z-10 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                    title="删除小说"
                                >
                                    <TrashIcon />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Right: Deconstruction / Tools */}
            <div className="w-[350px] bg-white dark:bg-gray-900 p-6 flex flex-col gap-6">
                 <div>
                     <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                         <SparklesIcon /> 小说拆解 / 仿写
                     </h3>
                     <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                         不知道怎么开头？输入番茄、起点等网站的小说链接或书名。AI 将分析其题材、节奏、爽点和文风，并基于该风格为您创建新的大纲。
                     </p>
                 </div>

                 <div className="flex-1 flex flex-col gap-4">
                     <div className="space-y-2">
                         <label className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">目标小说 (链接/书名)</label>
                         <textarea 
                            value={deconstructInput}
                            onChange={(e) => setDeconstructInput(e.target.value)}
                            placeholder="例如：\n《诡秘之主》\n或者\nhttps://fanqienovel.com/..."
                            className="w-full h-32 p-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                         />
                     </div>
                     
                     <button 
                        onClick={handleDeconstruct}
                        disabled={!deconstructInput.trim()}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                     >
                         <SparklesIcon /> 开始拆解并创建
                     </button>
                     
                     <div className="mt-auto p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-100 dark:border-yellow-800/30">
                         <h4 className="text-xs font-bold text-yellow-800 dark:text-yellow-500 mb-1">💡 提示</h4>
                         <p className="text-[10px] text-yellow-700 dark:text-yellow-600">
                             AI 会根据您提供的目标进行深度分析，自动生成"风格设定"并填入系统提示词中，帮助您写出纯正的"番茄味"或"起点风"。
                         </p>
                     </div>
                 </div>
            </div>

        </div>

      </div>
    </div>
  );
};

export default LibraryModal;
