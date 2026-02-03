
import React, { useState, useEffect } from 'react';
import { XIcon, SparklesIcon } from './Icons';
import { AnchorConfig } from '../types';

interface AnchorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig?: AnchorConfig;
  onExecuteNow: () => void;
  onSaveConfig: (config: AnchorConfig) => void;
  currentChapterCount: number;
}

const AnchorModal: React.FC<AnchorModalProps> = ({ 
    isOpen, onClose, currentConfig, onExecuteNow, onSaveConfig, currentChapterCount
}) => {
    const [config, setConfig] = useState<AnchorConfig>({
        enabled: false,
        mode: 'chapter',
        chapterInterval: 20,
        nextTrigger: 20
    });

    useEffect(() => {
        if (isOpen && currentConfig) {
            setConfig(currentConfig);
        } else if (isOpen) {
            // Default initialization if no config exists
            setConfig(prev => ({
                ...prev,
                nextTrigger: Math.ceil((currentChapterCount + 1) / 20) * 20
            }));
        }
    }, [isOpen, currentConfig, currentChapterCount]);

    if (!isOpen) return null;

    const handleSave = () => {
        // Recalculate next trigger based on current chapters to ensure it's in the future
        const nextTrigger = Math.max(
            config.nextTrigger, 
            Math.ceil((currentChapterCount + 1) / config.chapterInterval) * config.chapterInterval
        );
        onSaveConfig({ ...config, nextTrigger });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white dark:bg-gray-900 ec:bg-ec-bg border border-gray-200 dark:border-gray-700 ec:border-ec-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col transition-colors">
                
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 ec:border-ec-border bg-gray-50 dark:bg-gray-900 ec:bg-ec-surface">
                    <h3 className="font-bold text-gray-900 dark:text-white ec:text-ec-text flex items-center gap-2">
                        <span>⚓</span> 剧情锚点设置 (Anchor Settings)
                    </h3>
                    <button onClick={onClose} className="ec:text-ec-text"><XIcon/></button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 ec:bg-white p-4 rounded-lg border border-indigo-100 dark:border-indigo-800 ec:border-ec-border text-sm text-indigo-800 dark:text-indigo-300 ec:text-ec-text">
                        <p className="leading-relaxed">
                            <strong>剧情锚点</strong>用于压缩过长的上下文，防止 AI 遗忘前文设定。开启自动锚定后，系统将在生成过程中根据条件自动执行压缩，并无缝继续后续生成。
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="font-medium text-gray-700 dark:text-gray-300 ec:text-ec-text">启用自动锚定</label>
                            <input 
                                type="checkbox" 
                                checked={config.enabled} 
                                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300" 
                            />
                        </div>

                        <div className={`space-y-4 transition-opacity ${!config.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 ec:text-ec-text mb-2">触发模式</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={() => setConfig({ ...config, mode: 'chapter' })}
                                        className={`px-3 py-2 rounded-lg text-sm border ${config.mode === 'chapter' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-800 ec:bg-ec-surface border-gray-200 dark:border-gray-700 ec:border-ec-border text-gray-700 dark:text-gray-300 ec:text-ec-text'}`}
                                    >
                                        按章节计数
                                    </button>
                                    <button 
                                        onClick={() => setConfig({ ...config, mode: 'volume' })}
                                        className={`px-3 py-2 rounded-lg text-sm border ${config.mode === 'volume' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-800 ec:bg-ec-surface border-gray-200 dark:border-gray-700 ec:border-ec-border text-gray-700 dark:text-gray-300 ec:text-ec-text'}`}
                                        title="需手动在正文中标记 '## 第X卷'"
                                    >
                                        按分卷 (实验性)
                                    </button>
                                </div>
                             </div>

                             {config.mode === 'chapter' && (
                                 <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 ec:text-ec-text mb-2">压缩间隔</label>
                                    <select 
                                        value={config.chapterInterval} 
                                        onChange={(e) => setConfig({ ...config, chapterInterval: Number(e.target.value) as 20 | 50 })}
                                        className="w-full bg-white dark:bg-gray-800 ec:bg-ec-surface border border-gray-300 dark:border-gray-700 ec:border-ec-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white ec:text-ec-text focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    >
                                        <option value={20}>每 20 章 (推荐)</option>
                                        <option value={50}>每 50 章</option>
                                    </select>
                                    <p className="text-xs text-gray-500 ec:text-ec-text mt-1">
                                        当前章节: {currentChapterCount}，预计下次触发: 第 {Math.max(config.nextTrigger, Math.ceil((currentChapterCount+1)/config.chapterInterval)*config.chapterInterval)} 章
                                    </p>
                                 </div>
                             )}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-200 dark:border-gray-800 ec:border-ec-border bg-gray-50 dark:bg-gray-900 ec:bg-ec-surface flex justify-between gap-3">
                     <button 
                        onClick={() => { onExecuteNow(); onClose(); }}
                        className="px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 ec:text-ec-accent hover:bg-indigo-50 dark:hover:bg-indigo-900/20 ec:hover:bg-white rounded-lg transition-colors"
                     >
                        仅立即执行一次
                     </button>
                     <button 
                        onClick={handleSave}
                        className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 ec:bg-ec-accent rounded-lg shadow-lg shadow-indigo-500/20 transition-all"
                     >
                        保存自动化配置
                     </button>
                </div>

            </div>
        </div>
    );
};

export default AnchorModal;
