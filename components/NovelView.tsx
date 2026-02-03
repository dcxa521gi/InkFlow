
import React, { useMemo, useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { CopyIcon, ChevronDownIcon, ChevronUpIcon, SparklesIcon, DownloadIcon } from './Icons';
import { Message, NovelTab, Chapter, AppSettings } from '../types';

interface NovelViewProps {
  messages: Message[];
  settings?: AppSettings;
  onBatchGenerateToC: (count: number | 'custom') => void;
  onBatchGenerateContent: (count: number | 'custom') => void;
  onChapterAction: (action: 'optimize' | 'regenerate' | 'analyze', chapterTitle: string, content: string, messageId: string) => void;
  onTextSelectionOptimize: (text: string, fullContext: string, messageId: string) => void;
  isGenerating: boolean;
}

const NovelView: React.FC<NovelViewProps> = ({ 
    messages, 
    settings,
    onBatchGenerateToC,
    onBatchGenerateContent,
    onChapterAction,
    onTextSelectionOptimize,
    isGenerating 
}) => {
  const [activeTab, setActiveTab] = useState<NovelTab>('settings');
  const [copyStatus, setCopyStatus] = useState('复制');
  const [customToCCount, setCustomToCCount] = useState<string>('');
  const [customContentCount, setCustomContentCount] = useState<string>('');
  const [batchError, setBatchError] = useState<string | null>(null);
  
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  const [selectionRect, setSelectionRect] = useState<{top: number, left: number} | null>(null);
  const [selectedText, setSelectedText] = useState('');
  
  const [collapsedChapters, setCollapsedChapters] = useState<Set<string>>(new Set());

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
              setIsDownloadMenuOpen(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const OPTIONS_REGEX = /(?:^|\n)\s*(?:\*\*|__)?Options(?:\*\*|__)?[:：][\s\S]*$/i;

  // --- Robust Content Parsing Engine ---
  const parsedSections = useMemo(() => {
      const validMessages = messages.filter(m => m.role === 'model');
      const sectionsMap = new Map<string, { title: string; content: string; msgId: string, timestamp: number }>();

      // Keywords that identify a "Strong" header (definitely a new section)
      const isStrongHeader = (t: string) => /第[0-9一二三四五六七八九十]+章|Chapter|书名|简介|大纲|世界观|设定|角色|势力|物品|目录|ToC|Outline/i.test(t);

      validMessages.forEach(msg => {
          const cleanContent = msg.content.replace(OPTIONS_REGEX, '').trim();
          const lines = cleanContent.split('\n');
          
          let currentTitle = '';
          let currentBuffer: string[] = [];

          const flush = () => {
              if (currentTitle && currentBuffer.length > 0) {
                  const content = currentBuffer.join('\n').trim();
                  if (content) {
                      const key = currentTitle.replace(/\s+/g, '').toLowerCase();
                      sectionsMap.set(key, { 
                          title: currentTitle, 
                          content: content, 
                          msgId: msg.id,
                          timestamp: msg.timestamp
                      });
                  }
              }
              currentBuffer = [];
          };

          for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) {
                  if (currentTitle) currentBuffer.push(line);
                  continue;
              }

              // Strict Header Detection
              const mdHeader = trimmed.match(/^(#{1,3})\s+(.+)$/);
              const boldHeader = trimmed.match(/^\*\*(.+?)\*\*$/);
              const kvHeader = trimmed.match(/^([^：:]{2,10})[:：](.*)$/);

              let detectedTitle = '';
              let inlineContent = '';

              if (mdHeader) {
                  const level = mdHeader[1].length;
                  const text = mdHeader[2].trim();
                  // H1/H2 always new section. H3 only if it looks like a known section type.
                  // This prevents H3 subheaders (### Scene) from breaking chapters.
                  if (level <= 2 || isStrongHeader(text)) {
                      detectedTitle = text;
                  }
              } else if (boldHeader && boldHeader[1].length < 40) {
                  const text = boldHeader[1].trim();
                  // Bold text is only a header if it looks like a known section type
                  // This prevents emphasized text (**Boom!**) from breaking chapters.
                  if (isStrongHeader(text)) {
                      detectedTitle = text;
                  }
              } else if (kvHeader && !currentTitle) { 
                  detectedTitle = kvHeader[1].trim();
                  inlineContent = kvHeader[2].trim();
              }

              if (detectedTitle) {
                  flush();
                  // --- Title Sanitization ---
                  currentTitle = detectedTitle
                      .replace(/[\*\_\[\]]/g, '') // Remove Markdown syntax
                      .replace(/\(.*\)$/, '')     // Remove trailing parenthesis
                      .replace(/（.*）$/, '')     // Remove Chinese trailing parenthesis
                      .trim();
                      
                  if (inlineContent) {
                      currentBuffer.push(inlineContent);
                  }
              } else {
                  if (currentTitle) {
                      currentBuffer.push(line);
                  } else {
                       const looseKv = trimmed.match(/^([^：:]{2,10})[:：]\s*(.+)/);
                       if (looseKv) {
                           const k = looseKv[1].trim().replace(/[\*\_]/g, '');
                           const v = looseKv[2].trim();
                           const key = k.replace(/\s+/g, '').toLowerCase();
                           sectionsMap.set(key, { title: k, content: v, msgId: msg.id, timestamp: msg.timestamp });
                       }
                  }
              }
          }
          flush();
      });

      return Array.from(sectionsMap.values()).sort((a,b) => a.timestamp - b.timestamp);
  }, [messages]);

  // --- Content Categorization ---

  const settingsContent = useMemo(() => {
    const keywords = [
        '小说名称', '书名', 'Title',
        '核心梗概', '故事梗概', '简介', '概要', '核心冲突', 'Summary',
        '时间', 'Timeline', '时间线',
        '地点', 'Location', '地图',
        '氛围', 'Atmosphere',
        '规则', 'Rule', '力量体系',
        '世界观', '世界', 'World', 'Background',
        '故事线', 'Storyline', '剧情', '大纲', 'Outline',
        '设定集', '基础设定', 'Basic Settings',
        '目录', 'Table of Contents', '章节目录', 'Chapter List'
    ];
    
    const matched = parsedSections
        .filter(s => keywords.some(k => s.title.includes(k) || s.title === k))
        .filter(s => !['角色', '势力', '物品', '等级'].some(ex => s.title.includes(ex)));
    
    if (matched.length === 0) return "## 暂无详细基础设定\n\n请在对话中让 AI 生成书名、大纲、世界观或故事简介。";
    
    return matched.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n---\n\n');
  }, [parsedSections]);

  const databaseContent = useMemo(() => {
      const keywords = [
        '角色', 'Character', '主角', '配角', '反派',
        '势力', 'Faction', '组织', '宗门',
        '关系', 'Relationship', '图谱',
        '物品', 'Item', '法宝', '装备',
        '等级', 'Level', '境界', '体系', '功法'
    ];
    const matched = parsedSections.filter(s => keywords.some(k => s.title.includes(k)));
    if (matched.length === 0) return "## 暂无数据库内容\n\n请在对话中让 AI 生成角色档案、势力分布或物品设定。";
    return matched.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n---\n\n');
  }, [parsedSections]);

  const dialogueContent = useMemo(() => {
    return messages.map(m => `**${m.role === 'user' ? '你' : 'AI'}**: ${m.content.replace(OPTIONS_REGEX, '')}`).join('\n\n---\n\n');
  }, [messages]);

  const chapters = useMemo<Chapter[]>(() => {
      const rawChapters = parsedSections.filter(s => /第[0-9一二三四五六七八九十]+章/.test(s.title));
      
      const realChapters = rawChapters.filter(s => {
          // Robustly filter out ToC headers even if they contain "第X章"
          const isToC = /目录|列表|List|Overview|Summary|大纲|Outline|Structure/i.test(s.title);
          return !isToC;
      });

      return realChapters.sort((a, b) => {
          const getNum = (str: string) => {
              const m = str.match(/第([0-9]+)章/);
              return m ? parseInt(m[1]) : 999999;
          };
          const numA = getNum(a.title);
          const numB = getNum(b.title);
          return numA - numB || a.timestamp - b.timestamp;
      }).map((s, idx) => ({
          id: `${s.msgId}-ch-${idx}`,
          messageId: s.msgId,
          title: s.title, // Title is already sanitized in parsedSections
          content: s.content,
          wordCount: s.content.length,
          startIndex: 0, 
          endIndex: s.content.length
      }));
  }, [parsedSections]);
  
  const hasChapterToC = useMemo(() => {
    // Broader Regex for ToC Detection
    return parsedSections.some(s => /目录|Table of Contents|Chapter List|章节列表|Outline|Structure|章节安排|Detailed ToC/i.test(s.title));
  }, [parsedSections]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus('OK!');
    setTimeout(() => setCopyStatus('复制'), 2000);
  };
  
  const handleDownloadChapter = (title: string, content: string) => {
      const blob = new Blob([`${title}\n\n${content}`], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleBatchDownload = (format: 'txt' | 'word' | 'md') => {
      setIsDownloadMenuOpen(false);
      const bookTitle = settings?.targetTotalChapters ? `小说-${Date.now()}` : "小说导出";
      if (chapters.length === 0) { alert("暂无章节内容可下载。"); return; }
      const fullText = chapters.map(c => `${c.title}\n\n${c.content}`).join('\n\n-------------------\n\n');

      if (format === 'txt') {
          const blob = new Blob([fullText], { type: 'text/plain' });
          triggerDownload(blob, `${bookTitle}.txt`);
      } else if (format === 'md') {
          const blob = new Blob([`# ${bookTitle}\n\n` + fullText], { type: 'text/markdown' });
          triggerDownload(blob, `${bookTitle}.md`);
      } else if (format === 'word') {
          const htmlContent = `<html><head><meta charset='utf-8'></head><body>${chapters.map(c => `<h1>${c.title}</h1><p>${c.content.replace(/\n/g, '<br/>')}</p>`).join('<br/><hr/><br/>')}</body></html>`;
          const blob = new Blob([htmlContent], { type: 'application/msword' });
          triggerDownload(blob, `${bookTitle}.doc`);
      }
  };

  const triggerDownload = (blob: Blob, filename: string) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const toggleCollapse = (chapterId: string) => {
      setCollapsedChapters(prev => {
          const next = new Set(prev);
          if (next.has(chapterId)) next.delete(chapterId);
          else next.add(chapterId);
          return next;
      });
  };

  const toggleCollapseAll = () => {
      if (collapsedChapters.size === chapters.length) setCollapsedChapters(new Set());
      else setCollapsedChapters(new Set(chapters.map(c => c.id)));
  };

  const isAllCollapsed = chapters.length > 0 && collapsedChapters.size === chapters.length;

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) { setSelectionRect(null); setSelectedText(''); return; }
    const text = selection.toString().trim();
    if (text.length < 5) return; 
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSelectionRect({ top: rect.top - 40, left: rect.left + (rect.width / 2) });
    setSelectedText(text);
  };

  const executeSelectionOptimize = () => {
      if (!selectedText) return;
      const foundChapter = chapters.find(c => c.content.includes(selectedText));
      if (foundChapter) {
          onTextSelectionOptimize(selectedText, foundChapter.content, foundChapter.messageId);
      } else {
         const lastModelMsg = messages.filter(m => m.role === 'model').pop();
         if (lastModelMsg) onTextSelectionOptimize(selectedText, lastModelMsg.content, lastModelMsg.id);
      }
      setSelectionRect(null);
      window.getSelection()?.removeAllRanges();
  };

  const triggerBatchToC = (val: number | 'custom') => {
      setBatchError(null);
      if (val === 'custom') {
          const num = parseInt(customToCCount);
          if (num > 0) onBatchGenerateToC(num);
      } else { onBatchGenerateToC(val); }
  };

  const triggerBatchContent = (val: number | 'custom') => {
    setBatchError(null);
    if (!hasChapterToC) { setBatchError('检测不到章节目录，请先生成目录 (ToC) 再批量撰写正文。'); return; }
    if (val === 'custom') {
        const num = parseInt(customContentCount);
        if (num > 0) onBatchGenerateContent(num);
    } else { onBatchGenerateContent(val); }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 transition-colors relative">
      {selectionRect && activeTab === 'chapters' && (
          <div className="fixed z-50 transform -translate-x-1/2 animate-bounce-in" style={{ top: selectionRect.top, left: selectionRect.left }}>
              <button onClick={(e) => { e.stopPropagation(); executeSelectionOptimize(); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-full shadow-lg hover:bg-indigo-500 transition-transform hover:scale-105">
                  <SparklesIcon /> 润色选中段落
              </button>
          </div>
      )}

      <div className="flex items-center justify-between px-2 pt-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {[
                { id: 'settings', icon: '📋', label: '基础设定' },
                { id: 'database', icon: '👥', label: '数据库' },
                { id: 'chapters', icon: '📚', label: '章节正文' },
                { id: 'dialogue', icon: '💬', label: '对话记录' },
            ].map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as NovelTab)} className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'bg-white dark:bg-gray-950 text-indigo-600 dark:text-indigo-400 border-x border-t border-gray-200 dark:border-gray-800 relative top-[1px]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                    <span>{tab.icon}</span> {tab.label}
                </button>
            ))}
        </div>
        
        <div className="flex items-center gap-2 mb-1 mr-2 relative">
             {activeTab === 'chapters' && chapters.length > 0 && (
                <button onClick={toggleCollapseAll} className="text-xs flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-700 shadow-sm transition-colors" title={isAllCollapsed ? "全部展开" : "全部折叠"}>
                    {isAllCollapsed ? <><ChevronDownIcon /> 展开</> : <><ChevronUpIcon /> 折叠</>}
                </button>
             )}
             <div className="relative" ref={downloadMenuRef}>
                 <button onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)} className="text-xs flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-700 shadow-sm">
                     <DownloadIcon />
                 </button>
                 {isDownloadMenuOpen && (
                     <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 py-1 text-xs">
                         <button onClick={() => handleBatchDownload('word')} className="block w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">导出 Word (.doc)</button>
                         <button onClick={() => handleBatchDownload('txt')} className="block w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">导出 TXT</button>
                         <button onClick={() => handleBatchDownload('md')} className="block w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">导出 Markdown</button>
                     </div>
                 )}
             </div>
            <button onClick={() => { if(activeTab === 'chapters') handleCopy(chapters.map(c => `${c.title}\n\n${c.content}`).join('\n\n')); else handleCopy(activeTab === 'dialogue' ? dialogueContent : (activeTab === 'settings' ? settingsContent : databaseContent)); }} className="text-xs flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-700 shadow-sm">
                <CopyIcon /> {copyStatus}
            </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-[#0f1115]" onMouseUp={handleMouseUp}>
          {activeTab === 'settings' && (
              <div className="p-4 space-y-4">
                  {settings && (
                      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg p-4 flex gap-6 animate-fadeIn">
                          <div><div className="text-xs text-indigo-500 dark:text-indigo-400 font-bold uppercase mb-1">预计总章节</div><div className="text-2xl font-black text-indigo-600 dark:text-indigo-300">{settings.targetTotalChapters} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">章</span></div></div>
                          <div><div className="text-xs text-indigo-500 dark:text-indigo-400 font-bold uppercase mb-1">每章字数目标</div><div className="text-2xl font-black text-indigo-600 dark:text-indigo-300">{settings.targetWordsPerChapter} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">字</span></div></div>
                      </div>
                  )}
                  <div className="prose dark:prose-invert prose-indigo max-w-none dark:prose-headings:text-gray-100 dark:prose-p:text-gray-300">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{settingsContent}</ReactMarkdown>
                  </div>
              </div>
          )}

          {(activeTab === 'database' || activeTab === 'dialogue') && (
            <div className="p-8 prose dark:prose-invert prose-indigo max-w-none dark:prose-headings:text-gray-100 dark:prose-p:text-gray-300">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={{ code({node, className, children, ...props}) { const match = /language-(\w+)/.exec(className || ''); return match ? (<div className="mockup-code bg-gray-100 dark:bg-gray-800 rounded-lg p-4 my-4 overflow-x-auto text-sm font-mono border border-gray-200 dark:border-gray-700">{String(children).replace(/\n$/, '')}</div>) : (<code className="bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5 text-sm font-mono text-pink-500 dark:text-pink-300" {...props}>{children}</code>); } }}>
                {activeTab === 'dialogue' ? dialogueContent : databaseContent}
                </ReactMarkdown>
            </div>
          )}

          {activeTab === 'chapters' && (
              <div className="p-4 space-y-4">
                 {chapters.length === 0 && (
                     <div className="text-center py-20 text-gray-500 dark:text-gray-500"><div className="text-4xl mb-2">📚</div><p>暂无正文章节</p><p className="text-xs mt-2">请使用下方工具生成目录和正文。</p></div>
                 )}
                 {chapters.map((chapter) => {
                     const isCollapsed = collapsedChapters.has(chapter.id);
                     return (
                     <div key={chapter.id} className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                         <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 cursor-pointer select-none" onClick={() => toggleCollapse(chapter.id)}>
                             <div className="flex items-center gap-2">
                                <button className="text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400">{isCollapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}</button>
                                <div><h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm md:text-base">{chapter.title}</h3><p className="text-[10px] text-gray-400 mt-0.5">字数: {chapter.wordCount}</p></div>
                             </div>
                             <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                 <button onClick={() => onChapterAction('optimize', chapter.title, chapter.content, chapter.messageId)} className="p-1.5 text-xs text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30 rounded" title="优化润色">✨ 优化</button>
                                 <button onClick={() => onChapterAction('regenerate', chapter.title, chapter.content, chapter.messageId)} className="p-1.5 text-xs text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/30 rounded" title="重新生成">🔄 重写</button>
                                 <button onClick={() => handleDownloadChapter(chapter.title, chapter.content)} className="p-1.5 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 rounded" title="下载本章">⬇️</button>
                             </div>
                         </div>
                         {!isCollapsed && (
                             <div className="p-5 prose dark:prose-invert prose-indigo max-w-none text-sm leading-7 md:text-base md:leading-8 dark:prose-headings:text-gray-100 dark:prose-p:text-gray-300 animate-fadeIn">
                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{chapter.content}</ReactMarkdown>
                             </div>
                         )}
                     </div>
                 )})}
              </div>
          )}
      </div>

      {activeTab === 'chapters' && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 backdrop-blur-sm space-y-4">
            {batchError && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-3 py-2 rounded text-xs">⚠️ {batchError}</div>}
            <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">批量生成目录 (ToC)</label>
                <div className="flex flex-wrap gap-2">
                    {[5, 10, 20].map(num => <button key={num} onClick={() => triggerBatchToC(num)} disabled={isGenerating} className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50">+{num}章</button>)}
                    <div className="flex items-center gap-1"><input type="number" placeholder="自定义" value={customToCCount} onChange={(e) => setCustomToCCount(e.target.value)} className="w-16 px-2 py-1.5 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"/><button onClick={() => triggerBatchToC('custom')} disabled={isGenerating || !customToCCount} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-500 disabled:opacity-50">生成</button></div>
                </div>
            </div>
            <hr className="border-gray-200 dark:border-gray-700" />
            <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">批量撰写正文 (需先有目录)</label>
                <div className="flex flex-wrap gap-2">
                    {[1, 5, 10].map(num => <button key={num} onClick={() => triggerBatchContent(num)} disabled={isGenerating} className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs font-medium hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50 text-green-700 dark:text-green-400">写{num}章</button>)}
                    <div className="flex items-center gap-1"><input type="number" placeholder="自定义" value={customContentCount} onChange={(e) => setCustomContentCount(e.target.value)} className="w-16 px-2 py-1.5 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"/><button onClick={() => triggerBatchContent('custom')} disabled={isGenerating || !customContentCount} className="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-500 disabled:opacity-50">撰写</button></div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default NovelView;
