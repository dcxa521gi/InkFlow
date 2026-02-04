
import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, MCPItem, SkillItem } from '../types';
import { AVAILABLE_OPENAI_MODELS, DEFAULT_SYSTEM_INSTRUCTION } from '../constants';
import { XIcon, RefreshIcon, TrashIcon } from './Icons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
}

type Tab = 'general' | 'prompt' | 'mcp' | 'skills' | 'site';

const PRESETS = [
  { name: 'DeepSeek', url: 'https://api.deepseek.com', model: 'deepseek-chat' },
  { name: 'Kimi', url: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { name: '心流Ai', url: 'https://apis.iflow.cn/v1', model: 'deepseek-v3.2' },
  { name: '智谱', url: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4' },
  { name: '硅基流动', url: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3.2' },
  { name: '火山引擎豆包', url: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-pro-32k' },
  { name: '腾讯混元', url: 'https://api.hunyuan.cloud.tencent.com/v1', model: 'hunyuan-lite' },
  { name: '阿里千问', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { name: '自定义', url: '', model: '' },
];

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = React.useState<AppSettings>(settings);
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [availableOpenAIModels, setAvailableOpenAIModels] = useState(AVAILABLE_OPENAI_MODELS);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');

  // Refs to track internal state and prevent loops
  const onSaveRef = useRef(onSave);
  const isFirstSync = useRef(true);

  // Update ref when prop changes
  useEffect(() => {
      onSaveRef.current = onSave;
  }, [onSave]);

  // Sync with props when opened
  React.useEffect(() => {
    if (isOpen) {
        setLocalSettings({ ...settings }); 
        isFirstSync.current = true; // Reset flag on open
        setSaveStatus('saved');
    }
  }, [isOpen]); // Only run when open state toggles

  // Auto-save logic
  useEffect(() => {
      if (!isOpen) return;

      // Skip the save on the very first render/sync when opening
      if (isFirstSync.current) {
          isFirstSync.current = false;
          return;
      }

      setSaveStatus('saving');
      const timer = setTimeout(() => {
          onSaveRef.current(localSettings);
          setSaveStatus('saved');
      }, 800);

      return () => clearTimeout(timer);
  }, [localSettings, isOpen]);

  if (!isOpen) return null;

  const handleChange = (key: keyof AppSettings, value: any) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };
  
  const handleSiteChange = (key: keyof AppSettings['siteSettings'], value: any) => {
      setLocalSettings(prev => ({
          ...prev,
          siteSettings: {
              ...prev.siteSettings,
              [key]: value
          }
      }));
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
      if (preset.name === '自定义') return;
      setLocalSettings(prev => ({
          ...prev,
          openaiBaseUrl: preset.url,
          openaiModel: preset.model
      }));
  };

  const resetSystemInstruction = () => {
      handleChange('systemInstruction', DEFAULT_SYSTEM_INSTRUCTION);
  };

  // Model Fetching Logic
  const fetchModels = async () => {
    if (!localSettings.openaiApiKey) {
        setFetchError('需先填写 API Key');
        return;
    }
    setIsFetchingModels(true);
    setFetchError('');
    try {
        const baseUrl = localSettings.openaiBaseUrl.replace(/\/+$/, "");
        const res = await fetch(`${baseUrl}/models`, {
            headers: { 'Authorization': `Bearer ${localSettings.openaiApiKey}` }
        });
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        // Assume standard OpenAI format: { data: [{ id: '...' }, ...] }
        if (data.data && Array.isArray(data.data)) {
            const fetchedModels = data.data.map((m: any) => ({ id: m.id, name: m.id }));
            
            const merged = fetchedModels.map((fm: any) => {
                const existing = AVAILABLE_OPENAI_MODELS.find(am => am.id === fm.id);
                return existing ? existing : fm;
            }).sort((a: any, b: any) => a.id.localeCompare(b.id));
            
            setAvailableOpenAIModels(merged);
        } else {
             throw new Error('Invalid format');
        }
    } catch (e) {
        console.error(e);
        setFetchError('获取失败，请检查 URL/Key');
    } finally {
        setIsFetchingModels(false);
    }
  };

  // MCP Handlers
  const addMCPItem = () => {
    const newItem: MCPItem = { id: Date.now().toString(), name: '新设定', content: '', isActive: true };
    handleChange('mcpItems', [...localSettings.mcpItems, newItem]);
  };
  const updateMCPItem = (id: string, updates: Partial<MCPItem>) => {
    const newItems = localSettings.mcpItems.map(item => item.id === id ? { ...item, ...updates } : item);
    handleChange('mcpItems', newItems);
  };
  const deleteMCPItem = (id: string) => handleChange('mcpItems', localSettings.mcpItems.filter(item => item.id !== id));

  // Skills Handlers
  const addSkillItem = () => {
    const newItem: SkillItem = { id: Date.now().toString(), name: '新技能', content: '', isActive: true };
    handleChange('skillItems', [...(localSettings.skillItems || []), newItem]);
  };
  const updateSkillItem = (id: string, updates: Partial<SkillItem>) => {
    const newItems = (localSettings.skillItems || []).map(item => item.id === id ? { ...item, ...updates } : item);
    handleChange('skillItems', newItems);
  };
  const deleteSkillItem = (id: string) => handleChange('skillItems', (localSettings.skillItems || []).filter(item => item.id !== id));
  
  // Image Upload
  const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              handleSiteChange('contactQrCode', reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  const navClass = (tab: Tab) => `text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-400 ec:text-ec-text hover:bg-gray-200 dark:hover:bg-gray-900 ec:hover:bg-ec-surface hover:text-gray-900 dark:hover:text-white'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white dark:bg-gray-900 ec:bg-ec-bg border border-gray-200 dark:border-gray-700 ec:border-ec-border rounded-xl shadow-2xl w-full max-w-5xl h-[750px] max-h-[95vh] overflow-hidden flex flex-col transition-colors">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800 ec:border-ec-border bg-gray-50 dark:bg-gray-900 ec:bg-ec-surface">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white ec:text-ec-text">设置 (Configuration)</h2>
            {saveStatus === 'saving' ? (
                <div className="flex items-center gap-1.5 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 rounded text-yellow-600 dark:text-yellow-500 border border-yellow-200 dark:border-yellow-800/30">
                    <div className="w-1.5 h-1.5 rounded-full bg-current animate-ping"></div>
                    <span className="text-xs font-medium">保存中...</span>
                </div>
            ) : (
                <div className="flex items-center gap-1.5 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded text-green-600 dark:text-green-500 border border-green-200 dark:border-green-800/30">
                     <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                    <span className="text-xs font-medium">已保存</span>
                </div>
            )}
          </div>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 ec:text-ec-text hover:text-gray-900 dark:hover:text-white transition-colors">
            <XIcon />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 bg-gray-100 dark:bg-gray-950 ec:bg-ec-bg border-r border-gray-200 dark:border-gray-800 ec:border-ec-border p-4 flex flex-col gap-2 shrink-0">
            <button onClick={() => setActiveTab('general')} className={navClass('general')}>通用 / 模型</button>
            <button onClick={() => setActiveTab('prompt')} className={navClass('prompt')}>预置参数 / 人设</button>
            <button onClick={() => setActiveTab('mcp')} className={navClass('mcp')}>MCP 知识库</button>
            <button onClick={() => setActiveTab('skills')} className={navClass('skills')}>⚡ SKILL 技能</button>
            <button onClick={() => setActiveTab('site')} className={navClass('site')}>🌐 网站/显示</button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-gray-900 ec:bg-ec-surface">
            
            {activeTab === 'general' && (
              <div className="space-y-6">
                
                {/* Presets Grid */}
                <div>
                   <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 ec:text-ec-text mb-3">预设接口 (Presets)</label>
                   <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                      {PRESETS.map(preset => (
                          <button
                            key={preset.name}
                            onClick={() => applyPreset(preset)}
                            className={`px-2 py-1.5 text-xs rounded-md border transition-all ${
                                localSettings.openaiBaseUrl === preset.url && preset.name !== '自定义'
                                ? 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-bold'
                                : 'bg-white dark:bg-gray-800 ec:bg-white border-gray-200 dark:border-gray-700 ec:border-ec-border text-gray-600 dark:text-gray-400 ec:text-ec-text hover:border-indigo-300 dark:hover:border-indigo-600'
                            }`}
                          >
                              {preset.name}
                          </button>
                      ))}
                   </div>
                </div>

                {/* OpenAI Configuration */}
                <div className="space-y-4 animate-fadeIn border-t border-gray-200 dark:border-gray-800 ec:border-ec-border pt-6">
                     <h3 className="text-sm font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider">接口参数配置</h3>
                     <div>
                       <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 ec:text-ec-text mb-1">API Key</label>
                       <input 
                          type="password"
                          value={localSettings.openaiApiKey}
                          onChange={(e) => handleChange('openaiApiKey', e.target.value)}
                          placeholder="sk-..."
                          className="w-full bg-gray-50 dark:bg-gray-800 ec:bg-white border border-gray-300 dark:border-gray-700 ec:border-ec-border rounded-lg px-4 py-2 text-gray-900 dark:text-white ec:text-ec-text focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                       />
                     </div>
                     <div>
                       <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 ec:text-ec-text mb-1">Base URL (接口地址)</label>
                       <input 
                          type="text"
                          value={localSettings.openaiBaseUrl}
                          onChange={(e) => handleChange('openaiBaseUrl', e.target.value)}
                          placeholder="https://api.openai.com/v1"
                          className="w-full bg-gray-50 dark:bg-gray-800 ec:bg-white border border-gray-300 dark:border-gray-700 ec:border-ec-border rounded-lg px-4 py-2 text-gray-900 dark:text-white ec:text-ec-text focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                       />
                     </div>
                     
                     {/* Optimized Model Selection */}
                     <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 ec:text-ec-text mb-1">模型 (Model ID)</label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <input 
                                list="model-suggestions"
                                type="text"
                                value={localSettings.openaiModel}
                                onChange={(e) => handleChange('openaiModel', e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-800 ec:bg-white border border-gray-300 dark:border-gray-700 ec:border-ec-border rounded-lg px-4 py-2 text-gray-900 dark:text-white ec:text-ec-text focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                placeholder="输入或选择模型 ID"
                            />
                            <datalist id="model-suggestions">
                                {availableOpenAIModels.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </datalist>
                        </div>
                        <button 
                            onClick={fetchModels}
                            disabled={isFetchingModels}
                            className="px-3 bg-gray-50 dark:bg-gray-800 ec:bg-white border border-gray-300 dark:border-gray-700 ec:border-ec-border rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 ec:text-ec-text transition-colors disabled:opacity-50"
                            title="从接口获取模型列表"
                        >
                            <RefreshIcon />
                        </button>
                      </div>
                      {fetchError && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{fetchError}</p>}
                    </div>
                  </div>

                {/* Novel Constraints */}
                 <div className="pt-4 border-t border-gray-200 dark:border-gray-800 ec:border-ec-border space-y-4">
                     <h3 className="text-sm font-semibold text-gray-900 dark:text-white ec:text-ec-text uppercase tracking-wider">小说生成目标 (Generation Constraints)</h3>
                     <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 p-3 rounded-lg text-xs text-yellow-800 dark:text-yellow-500">
                         ⚠️ 注意：此处修改的【总章节】和【每章字数】将作为最高指令注入 AI。在对话开始后，除非用户明确要求修改，否则 AI 不会自行变更。
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 ec:text-ec-text mb-1">预计总章节数</label>
                            <input 
                              type="number"
                              min="1"
                              value={localSettings.targetTotalChapters || 20}
                              onChange={(e) => handleChange('targetTotalChapters', parseInt(e.target.value) || 20)}
                              className="w-full bg-gray-50 dark:bg-gray-800 ec:bg-white border border-gray-300 dark:border-gray-700 ec:border-ec-border rounded-lg px-4 py-2 text-gray-900 dark:text-white ec:text-ec-text focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 ec:text-ec-text mb-1">每章目标字数</label>
                            <input 
                              type="number"
                              min="500"
                              step="500"
                              value={localSettings.targetWordsPerChapter || 3000}
                              onChange={(e) => handleChange('targetWordsPerChapter', parseInt(e.target.value) || 3000)}
                              className="w-full bg-gray-50 dark:bg-gray-800 ec:bg-white border border-gray-300 dark:border-gray-700 ec:border-ec-border rounded-lg px-4 py-2 text-gray-900 dark:text-white ec:text-ec-text focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                        </div>
                     </div>
                 </div>
              </div>
            )}

            {/* Prompt Tab */}
            {activeTab === 'prompt' && (
              <div className="h-full flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                       <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white ec:text-ec-text">预置参数 / 人设 (System Prompt)</h3>
                          <p className="text-sm text-gray-500 ec:text-ec-text opacity-70">定义 AI 的角色、语气和行为规范。</p>
                       </div>
                       <button onClick={resetSystemInstruction} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 ec:bg-white border border-gray-200 dark:border-gray-700 ec:border-ec-border hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-xs flex items-center gap-1 text-gray-600 dark:text-gray-300 ec:text-ec-text transition-colors">
                          <RefreshIcon /> 重置默认
                       </button>
                  </div>
                  <textarea 
                    value={localSettings.systemInstruction}
                    onChange={(e) => handleChange('systemInstruction', e.target.value)}
                    className="flex-1 w-full bg-gray-50 dark:bg-gray-800 ec:bg-white border border-gray-200 dark:border-gray-700 ec:border-ec-border rounded-lg px-4 py-4 text-sm text-gray-800 dark:text-gray-300 ec:text-ec-text focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono resize-none leading-relaxed"
                    placeholder="在此输入 System Prompt..."
                  />
              </div>
            )}

            {/* MCP Tab */}
            {activeTab === 'mcp' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white ec:text-ec-text">MCP 知识库 (Library)</h3>
                    <p className="text-sm text-gray-500 ec:text-ec-text opacity-70">定义世界观、角色卡或设定集。启用后自动注入。</p>
                  </div>
                  <button onClick={addMCPItem} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors">+ 添加</button>
                </div>
                <div className="space-y-4">
                   {(localSettings.mcpItems || []).map((item) => (
                     <div key={item.id} className="bg-gray-50 dark:bg-gray-800 ec:bg-white border border-gray-200 dark:border-gray-700 ec:border-ec-border rounded-lg p-4 flex flex-col gap-3 group">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-3 flex-1">
                              <input type="checkbox" checked={item.isActive} onChange={(e) => updateMCPItem(item.id, { isActive: e.target.checked })} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"/>
                              <input type="text" value={item.name} onChange={(e) => updateMCPItem(item.id, { name: e.target.value })} className="bg-transparent border-b border-transparent focus:border-indigo-500 focus:outline-none text-gray-900 dark:text-white ec:text-ec-text font-medium w-full"/>
                           </div>
                           <button onClick={() => deleteMCPItem(item.id)} className="text-gray-500 hover:text-red-500 transition-opacity"><TrashIcon/></button>
                        </div>
                        <textarea value={item.content} onChange={(e) => updateMCPItem(item.id, { content: e.target.value })} rows={3} className="w-full bg-gray-100 dark:bg-gray-900/50 ec:bg-ec-surface border border-gray-200 dark:border-gray-700 ec:border-ec-border rounded-md px-3 py-2 text-sm text-gray-800 dark:text-gray-300 ec:text-ec-text focus:ring-1 focus:ring-indigo-500 focus:outline-none resize-y"/>
                     </div>
                   ))}
                </div>
              </div>
            )}

            {/* Skills Tab */}
            {activeTab === 'skills' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white ec:text-ec-text">⚡ 写作技能 (SKILL)</h3>
                    <p className="text-sm text-gray-500 ec:text-ec-text opacity-70">定义特殊的写作技巧、文风要求或描写规范。</p>
                  </div>
                  <button onClick={addSkillItem} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors">+ 添加技能</button>
                </div>
                <div className="space-y-4">
                   {(localSettings.skillItems || []).map((item) => (
                     <div key={item.id} className="bg-gray-50 dark:bg-gray-800 ec:bg-white border border-gray-200 dark:border-gray-700 ec:border-ec-border rounded-lg p-4 flex flex-col gap-3 group">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-3 flex-1">
                              <input type="checkbox" checked={item.isActive} onChange={(e) => updateSkillItem(item.id, { isActive: e.target.checked })} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"/>
                              <input type="text" value={item.name} onChange={(e) => updateSkillItem(item.id, { name: e.target.value })} placeholder="技能名称" className="bg-transparent border-b border-transparent focus:border-indigo-500 focus:outline-none text-gray-900 dark:text-white ec:text-ec-text font-medium w-full"/>
                           </div>
                           <button onClick={() => deleteSkillItem(item.id)} className="text-gray-500 hover:text-red-500 transition-opacity"><TrashIcon/></button>
                        </div>
                        <textarea value={item.content} onChange={(e) => updateSkillItem(item.id, { content: e.target.value })} placeholder="输入技能的具体要求..." rows={3} className="w-full bg-gray-100 dark:bg-gray-900/50 ec:bg-ec-surface border border-gray-200 dark:border-gray-700 ec:border-ec-border rounded-md px-3 py-2 text-sm text-gray-800 dark:text-gray-300 ec:text-ec-text focus:ring-1 focus:ring-indigo-500 focus:outline-none resize-y"/>
                     </div>
                   ))}
                </div>
              </div>
            )}

            {/* Site Tab */}
            {activeTab === 'site' && (
                <div className="space-y-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white ec:text-ec-text">🌐 网站与显示设置</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                           <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 ec:text-ec-text mb-1">网站名称</label>
                           <input type="text" value={localSettings.siteSettings?.siteName || 'InkFlow'} onChange={(e) => handleSiteChange('siteName', e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 ec:bg-white border border-gray-300 dark:border-gray-700 ec:border-ec-border rounded-lg px-4 py-2 text-gray-900 dark:text-white ec:text-ec-text focus:ring-2 focus:ring-indigo-500 focus:outline-none"/>
                        </div>
                        <div>
                           <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 ec:text-ec-text mb-1">网站简介/Slogan</label>
                           <input type="text" value={localSettings.siteSettings?.siteDescription || ''} onChange={(e) => handleSiteChange('siteDescription', e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 ec:bg-white border border-gray-300 dark:border-gray-700 ec:border-ec-border rounded-lg px-4 py-2 text-gray-900 dark:text-white ec:text-ec-text focus:ring-2 focus:ring-indigo-500 focus:outline-none"/>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 ec:text-ec-text mb-2">
                            整站正文字号: {localSettings.siteSettings?.defaultFontSize || 16}px
                        </label>
                        <input 
                            type="range" min="14" max="28" step="1"
                            value={localSettings.siteSettings?.defaultFontSize || 16}
                            onChange={(e) => handleSiteChange('defaultFontSize', parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-200 dark:bg-gray-700 ec:bg-ec-border rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>14px (最小)</span>
                            <span>28px (最大)</span>
                        </div>
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-800 ec:border-ec-border pt-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 ec:text-ec-text mb-2">联系开发者二维码 (上传图片)</label>
                        <div className="flex items-center gap-4">
                            <input type="file" accept="image/*" onChange={handleQrUpload} className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                            {localSettings.siteSettings?.contactQrCode && (
                                <img src={localSettings.siteSettings.contactQrCode} alt="QR Preview" className="w-16 h-16 object-cover border rounded-lg" />
                            )}
                        </div>
                    </div>
                </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 ec:border-ec-border flex justify-end gap-3 bg-gray-50 dark:bg-gray-900 ec:bg-ec-surface">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-white dark:bg-gray-800 ec:bg-white hover:bg-gray-100 dark:hover:bg-gray-700 ec:hover:bg-ec-hover text-gray-600 dark:text-gray-300 ec:text-ec-text font-medium rounded-lg transition-colors border border-gray-200 dark:border-gray-700 ec:border-ec-border text-sm"
          >
            关闭
          </button>
        </div>

      </div>
    </div>
  );
};

export default SettingsModal;
