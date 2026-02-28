import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import SortableItem from '../../components/dnd/SortableItem';
import {
  Plus,
  GripVertical,
  X,
  ArrowRight,
  Save,
  Send,
  ChevronRight,
  Edit3,
  Check,
  Layers,
  Zap,
} from 'lucide-react';

const STAGE_TYPES = [
  { value: 'landing', label: 'Landing Page' },
  { value: 'thankyou', label: 'Thank You' },
  { value: 'sales', label: 'Sales Page' },
  { value: 'upsell', label: 'Upsell' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'checkout', label: 'Checkout' },
];

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function generateId() {
  return 'stage-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
}

const defaultStages = [
  {
    id: 'stage-1',
    name: 'Landing Page',
    type: 'landing',
    color: '#6366f1',
    conversionGoal: 'Lead capture',
    url: 'landing-page',
    content: '',
  },
  {
    id: 'stage-2',
    name: 'Thank You',
    type: 'thankyou',
    color: '#10b981',
    conversionGoal: 'Confirmation',
    url: 'thank-you',
    content: '',
  },
  {
    id: 'stage-3',
    name: 'Sales Page',
    type: 'sales',
    color: '#f59e0b',
    conversionGoal: 'Purchase',
    url: 'sales-page',
    content: '',
  },
  {
    id: 'stage-4',
    name: 'Upsell',
    type: 'upsell',
    color: '#ef4444',
    conversionGoal: 'Upsell offer',
    url: 'upsell',
    content: '',
  },
];

function createNewStage() {
  const id = generateId();
  return {
    id,
    name: 'New Stage',
    type: 'landing',
    color: '#6366f1',
    conversionGoal: '',
    url: 'new-stage',
    content: '',
  };
}

const funnelTemplates = [
  { id: 'tpl-sales', name: 'Sales Funnel', description: 'Classic sales conversion funnel', color: '#6366f1', stages: [
    { id: 's1', name: 'Landing Page', type: 'landing', color: '#6366f1', conversionGoal: 'Lead capture', url: 'landing', content: '' },
    { id: 's2', name: 'Sales Page', type: 'sales', color: '#f59e0b', conversionGoal: 'Purchase', url: 'sales', content: '' },
    { id: 's3', name: 'Upsell', type: 'upsell', color: '#ef4444', conversionGoal: 'Upsell offer', url: 'upsell', content: '' },
    { id: 's4', name: 'Thank You', type: 'thankyou', color: '#10b981', conversionGoal: 'Confirmation', url: 'thank-you', content: '' },
  ]},
  { id: 'tpl-webinar', name: 'Webinar Funnel', description: 'Drive webinar registrations', color: '#8b5cf6', stages: [
    { id: 's1', name: 'Registration Page', type: 'landing', color: '#6366f1', conversionGoal: 'Registration', url: 'register', content: '' },
    { id: 's2', name: 'Confirmation', type: 'thankyou', color: '#10b981', conversionGoal: 'Confirm attendance', url: 'confirmed', content: '' },
    { id: 's3', name: 'Webinar Room', type: 'webinar', color: '#8b5cf6', conversionGoal: 'Attend webinar', url: 'live', content: '' },
    { id: 's4', name: 'Offer Page', type: 'sales', color: '#f59e0b', conversionGoal: 'Purchase', url: 'offer', content: '' },
  ]},
  { id: 'tpl-launch', name: 'Product Launch', description: 'Pre-launch to purchase flow', color: '#f59e0b', stages: [
    { id: 's1', name: 'Coming Soon', type: 'landing', color: '#6366f1', conversionGoal: 'Waitlist signup', url: 'coming-soon', content: '' },
    { id: 's2', name: 'Launch Page', type: 'sales', color: '#f59e0b', conversionGoal: 'Purchase', url: 'launch', content: '' },
    { id: 's3', name: 'Checkout', type: 'checkout', color: '#10b981', conversionGoal: 'Complete purchase', url: 'checkout', content: '' },
  ]},
  { id: 'tpl-leadmagnet', name: 'Lead Magnet', description: 'Capture leads with free content', color: '#10b981', stages: [
    { id: 's1', name: 'Opt-in Page', type: 'landing', color: '#6366f1', conversionGoal: 'Email capture', url: 'opt-in', content: '' },
    { id: 's2', name: 'Thank You', type: 'thankyou', color: '#10b981', conversionGoal: 'Download', url: 'download', content: '' },
  ]},
  { id: 'tpl-trial', name: 'Free Trial', description: 'Trial signup to paid conversion', color: '#ec4899', stages: [
    { id: 's1', name: 'Trial Landing', type: 'landing', color: '#6366f1', conversionGoal: 'Trial signup', url: 'trial', content: '' },
    { id: 's2', name: 'Welcome', type: 'thankyou', color: '#10b981', conversionGoal: 'Onboarding', url: 'welcome', content: '' },
    { id: 's3', name: 'Upgrade', type: 'sales', color: '#f59e0b', conversionGoal: 'Paid upgrade', url: 'upgrade', content: '' },
  ]},
  { id: 'tpl-consultation', name: 'Consultation', description: 'Book a free consultation', color: '#ef4444', stages: [
    { id: 's1', name: 'Landing Page', type: 'landing', color: '#6366f1', conversionGoal: 'Book call', url: 'book-call', content: '' },
    { id: 's2', name: 'Booking Confirmation', type: 'thankyou', color: '#10b981', conversionGoal: 'Confirmed', url: 'confirmed', content: '' },
  ]},
];

const mockFunnels = {
  1: { name: 'Real Estate Lead Funnel', stages: [
    { id: 's1', name: 'Property Landing', type: 'landing', color: '#6366f1', conversionGoal: 'Lead capture', url: 'property', content: '' },
    { id: 's2', name: 'Property Details', type: 'sales', color: '#f59e0b', conversionGoal: 'Enquiry', url: 'details', content: '' },
    { id: 's3', name: 'Schedule Visit', type: 'landing', color: '#8b5cf6', conversionGoal: 'Book visit', url: 'schedule', content: '' },
    { id: 's4', name: 'Thank You', type: 'thankyou', color: '#10b981', conversionGoal: 'Confirmation', url: 'thanks', content: '' },
  ]},
  2: { name: 'Product Launch Funnel', stages: [
    { id: 's1', name: 'Teaser Page', type: 'landing', color: '#6366f1', conversionGoal: 'Waitlist', url: 'teaser', content: '' },
    { id: 's2', name: 'Launch Page', type: 'sales', color: '#f59e0b', conversionGoal: 'Purchase', url: 'launch', content: '' },
    { id: 's3', name: 'Upsell', type: 'upsell', color: '#ef4444', conversionGoal: 'Add-on', url: 'upsell', content: '' },
    { id: 's4', name: 'Checkout', type: 'checkout', color: '#10b981', conversionGoal: 'Payment', url: 'checkout', content: '' },
    { id: 's5', name: 'Thank You', type: 'thankyou', color: '#10b981', conversionGoal: 'Success', url: 'thanks', content: '' },
  ]},
  3: { name: 'Webinar Registration', stages: [
    { id: 's1', name: 'Register', type: 'landing', color: '#6366f1', conversionGoal: 'Registration', url: 'register', content: '' },
    { id: 's2', name: 'Confirmed', type: 'thankyou', color: '#10b981', conversionGoal: 'Confirm', url: 'confirmed', content: '' },
    { id: 's3', name: 'Webinar', type: 'webinar', color: '#8b5cf6', conversionGoal: 'Attend', url: 'live', content: '' },
  ]},
  4: { name: 'Free Trial Signup', stages: [
    { id: 's1', name: 'Trial Page', type: 'landing', color: '#6366f1', conversionGoal: 'Signup', url: 'trial', content: '' },
    { id: 's2', name: 'Welcome', type: 'thankyou', color: '#10b981', conversionGoal: 'Onboard', url: 'welcome', content: '' },
  ]},
};

export default function FunnelBuilder() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('template');

  const getInitialState = () => {
    if (id && mockFunnels[id]) {
      return { stages: mockFunnels[id].stages, name: mockFunnels[id].name };
    }
    if (templateId) {
      const tpl = funnelTemplates.find(t => t.id === templateId);
      if (tpl) return { stages: tpl.stages, name: tpl.name };
    }
    return { stages: defaultStages, name: 'New Sales Funnel' };
  };

  const [showTemplates, setShowTemplates] = useState(!id && !templateId);
  const initial = getInitialState();
  const [stages, setStages] = useState(initial.stages);
  const [selectedStageId, setSelectedStageId] = useState(initial.stages[0].id);
  const [funnelName, setFunnelName] = useState(initial.name);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(initial.name);
  const [hoveredStageId, setHoveredStageId] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  // Draft state for right panel edits
  const [draft, setDraft] = useState(null);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setStages(prev => {
        const oldIndex = prev.findIndex(s => s.id === active.id);
        const newIndex = prev.findIndex(s => s.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const handleSelectTemplate = (tpl) => {
    setStages(tpl.stages);
    setFunnelName(tpl.name);
    setSelectedStageId(tpl.stages[0].id);
    setShowTemplates(false);
    toast.success(`Template "${tpl.name}" loaded`);
  };

  const selectedStage = stages.find((s) => s.id === selectedStageId) || null;

  // When selecting a stage, initialize draft from that stage
  function selectStage(id) {
    setSelectedStageId(id);
    const stage = stages.find((s) => s.id === id);
    if (stage) {
      setDraft({ ...stage });
    }
  }

  // Initialize draft on first render if needed
  if (selectedStage && !draft) {
    // Will run once
    setTimeout(() => setDraft({ ...selectedStage }), 0);
  }

  function handleInsertStage(index) {
    const newStage = createNewStage();
    const updated = [...stages];
    updated.splice(index, 0, newStage);
    setStages(updated);
    selectStage(newStage.id);
    toast.success('New stage added');
  }

  function handleDeleteStage(id) {
    if (stages.length <= 1) {
      toast.error('Funnel must have at least one stage');
      return;
    }
    const updated = stages.filter((s) => s.id !== id);
    setStages(updated);
    if (selectedStageId === id) {
      selectStage(updated[0].id);
    }
    toast.success('Stage deleted');
  }

  function handleApplyChanges() {
    if (!draft) return;
    setStages((prev) =>
      prev.map((s) => (s.id === draft.id ? { ...draft } : s))
    );
    toast.success('Changes applied');
  }

  function handleDraftChange(field, value) {
    setDraft((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, [field]: value };
      // Auto-generate slug when name changes
      if (field === 'name') {
        updated.url = generateSlug(value);
      }
      return updated;
    });
  }

  function handleSaveDraft() {
    toast.success('Funnel draft saved successfully');
  }

  function handlePublish() {
    toast.success('Funnel published successfully!');
  }

  function handleNameEditStart() {
    setNameInput(funnelName);
    setIsEditingName(true);
  }

  function handleNameEditConfirm() {
    const trimmed = nameInput.trim();
    if (trimmed) {
      setFunnelName(trimmed);
    }
    setIsEditingName(false);
  }

  function handleNameKeyDown(e) {
    if (e.key === 'Enter') handleNameEditConfirm();
    if (e.key === 'Escape') setIsEditingName(false);
  }

  function getTypeBadgeColor(type) {
    switch (type) {
      case 'landing':
        return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300';
      case 'thankyou':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
      case 'sales':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
      case 'upsell':
        return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
      case 'webinar':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
      case 'checkout':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
    }
  }

  if (showTemplates) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Choose a Funnel Template</h1>
          <p className="text-sm text-slate-500">Start with a pre-built funnel or create from scratch</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {funnelTemplates.map(tpl => (
            <button key={tpl.id} onClick={() => handleSelectTemplate(tpl)} className="text-left bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:shadow-md transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: tpl.color + '20' }}>
                  <Layers className="w-5 h-5" style={{ color: tpl.color }} />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{tpl.name}</h3>
              </div>
              <p className="text-sm text-slate-500 mb-3">{tpl.description}</p>
              <span className="text-xs text-slate-400">{tpl.stages.length} stages</span>
            </button>
          ))}
          <button onClick={() => setShowTemplates(false)} className="text-left bg-white dark:bg-slate-800 rounded-xl p-5 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-400 transition-all flex flex-col items-center justify-center">
            <Plus className="w-8 h-8 text-slate-400 mb-2" />
            <h3 className="font-semibold text-slate-900 dark:text-white">Blank Funnel</h3>
            <p className="text-sm text-slate-500">Start from scratch</p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Layers className="w-5 h-5 text-indigo-600 shrink-0" />
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={handleNameKeyDown}
                onBlur={handleNameEditConfirm}
                autoFocus
                className="px-2 py-1 border border-indigo-400 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleNameEditConfirm}
                className="p-1 text-indigo-600 hover:text-indigo-800"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleNameEditStart}
              className="flex items-center gap-2 group"
            >
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
                {funnelName}
              </h1>
              <Edit3 className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
          <span className="text-sm text-slate-500 dark:text-slate-400 ml-2">
            {stages.length} stage{stages.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveDraft}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <Save className="w-4 h-4" />
            Save Draft
          </button>
          <button
            onClick={handlePublish}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Send className="w-4 h-4" />
            Publish
          </button>
        </div>
      </div>

      {/* Main Content: Left Panel + Right Panel */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Left Panel - Stage List */}
        <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col shrink-0 max-h-[40vh] md:max-h-none">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
              Funnel Stages
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {/* Insert button before first stage */}
            <div className="flex justify-center py-1">
              <button
                onClick={() => handleInsertStage(0)}
                className="flex items-center justify-center w-7 h-7 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                title="Insert stage here"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={stages.map(s => s.id)} strategy={verticalListSortingStrategy}>
                {stages.map((stage, index) => (
                  <SortableItem key={stage.id} id={stage.id}>
                    {({ ref, style, attributes, listeners }) => (
                      <div ref={ref} style={style} {...attributes}>
                        {/* Stage Card */}
                        <div
                          onClick={() => selectStage(stage.id)}
                          onMouseEnter={() => setHoveredStageId(stage.id)}
                          onMouseLeave={() => setHoveredStageId(null)}
                          className={`relative flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-all ${
                            selectedStageId === stage.id
                              ? 'border-2 border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                              : 'border-2 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700/50'
                          }`}
                        >
                          {/* Drag Handle */}
                          <button {...listeners} className="cursor-grab active:cursor-grabbing" title="Drag to reorder">
                            <GripVertical className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                          </button>

                          {/* Color Dot */}
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: stage.color }}
                          />

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                              {stage.name}
                            </div>
                            <span
                              className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${getTypeBadgeColor(stage.type)}`}
                            >
                              {STAGE_TYPES.find((t) => t.value === stage.type)?.label || stage.type}
                            </span>
                          </div>

                          {/* Delete Button */}
                          {hoveredStageId === stage.id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteStage(stage.id);
                              }}
                              className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              title="Delete stage"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Insert button after each stage */}
                        <div className="flex justify-center py-1">
                          <button
                            onClick={() => handleInsertStage(index + 1)}
                            className="flex items-center justify-center w-7 h-7 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                            title="Insert stage here"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </SortableItem>
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </div>

        {/* Right Panel - Stage Configuration */}
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
          {draft && selectedStage ? (
            <div className="max-w-2xl mx-auto p-6">
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: draft.color }}
                  />
                  Configure Stage
                </h2>

                <div className="space-y-5">
                  {/* Stage Name */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Stage Name
                    </label>
                    <input
                      type="text"
                      value={draft.name}
                      onChange={(e) => handleDraftChange('name', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Enter stage name"
                    />
                  </div>

                  {/* Type Select */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Stage Type
                    </label>
                    <select
                      value={draft.type}
                      onChange={(e) => handleDraftChange('type', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      {STAGE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Color */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={draft.color}
                        onChange={(e) => handleDraftChange('color', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="#6366f1"
                      />
                      <div
                        className="w-10 h-10 rounded-lg border border-slate-300 dark:border-slate-600 shrink-0"
                        style={{ backgroundColor: draft.color }}
                      />
                    </div>
                  </div>

                  {/* Conversion Goal */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Conversion Goal
                    </label>
                    <input
                      type="text"
                      value={draft.conversionGoal}
                      onChange={(e) =>
                        handleDraftChange('conversionGoal', e.target.value)
                      }
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="e.g., Lead capture, Purchase"
                    />
                  </div>

                  {/* URL Slug */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      URL Slug
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-slate-500 dark:text-slate-400">/</span>
                      <input
                        type="text"
                        value={draft.url}
                        onChange={(e) => handleDraftChange('url', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="auto-generated-slug"
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Auto-generated from stage name. You can edit manually.
                    </p>
                  </div>

                  {/* Content / Description */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Content / Description
                    </label>
                    <textarea
                      value={draft.content}
                      onChange={(e) => handleDraftChange('content', e.target.value)}
                      rows={5}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                      placeholder="Describe the purpose and content of this stage..."
                    />
                  </div>

                  {/* Apply Button */}
                  <div className="pt-2">
                    <button
                      onClick={handleApplyChanges}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      Apply Changes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500">
              <div className="text-center">
                <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Select a stage to configure</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Flow Visualization Strip */}
      <div className="px-4 sm:px-6 py-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shrink-0 overflow-x-auto">
        <div className="flex items-center justify-center gap-0 min-w-max">
          {stages.map((stage, index) => (
            <div key={stage.id} className="flex items-center shrink-0">
              {/* Stage Circle */}
              <button
                onClick={() => selectStage(stage.id)}
                className="flex flex-col items-center group"
                title={stage.name}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold transition-all cursor-pointer ${
                    selectedStageId === stage.id
                      ? 'ring-4 ring-indigo-300 dark:ring-indigo-600 scale-110'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: stage.color }}
                >
                  {index + 1}
                </div>
                <span
                  className={`mt-1 text-xs max-w-[80px] truncate ${
                    selectedStageId === stage.id
                      ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {stage.name}
                </span>
              </button>

              {/* Arrow connector */}
              {index < stages.length - 1 && (
                <div className="flex items-center mx-2 mb-5">
                  <div className="w-8 h-0.5 bg-slate-300 dark:bg-slate-600" />
                  <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 -ml-1" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
