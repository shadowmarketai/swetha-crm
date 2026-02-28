import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import SortableItem from '../../components/dnd/SortableItem';
import {
  Plus,
  X,
  Eye,
  EyeOff,
  ChevronRight,
  Save,
  Send,
  Edit3,
  Check,
  Layout,
  Grid,
  MessageSquare,
  CreditCard,
  MousePointer,
  HelpCircle,
  Image,
  FileText,
  Video,
  BarChart3,
  Monitor,
  FileCode,
  GripVertical,
} from 'lucide-react';

const SECTION_TYPES = [
  { value: 'hero', label: 'Hero' },
  { value: 'features', label: 'Features' },
  { value: 'testimonials', label: 'Testimonials' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'cta', label: 'CTA' },
  { value: 'faq', label: 'FAQ' },
  { value: 'gallery', label: 'Gallery' },
  { value: 'form', label: 'Form' },
  { value: 'video', label: 'Video' },
  { value: 'stats', label: 'Stats' },
];

const SECTION_ICON_MAP = {
  hero: Layout,
  features: Grid,
  testimonials: MessageSquare,
  pricing: CreditCard,
  cta: MousePointer,
  faq: HelpCircle,
  gallery: Image,
  form: FileText,
  video: Video,
  stats: BarChart3,
};

function generateId() {
  return 'section-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
}

function getDefaultContent(type) {
  switch (type) {
    case 'hero':
      return {
        headline: '',
        subheadline: '',
        ctaButtonText: 'Get Started',
        backgroundColor: '#6366f1',
        textAlignment: 'center',
      };
    case 'features':
      return {
        sectionTitle: 'Features',
        columns: '3',
        items: [
          { name: 'Feature 1', description: 'Description of feature 1' },
          { name: 'Feature 2', description: 'Description of feature 2' },
          { name: 'Feature 3', description: 'Description of feature 3' },
        ],
      };
    case 'testimonials':
      return {
        sectionTitle: 'What Our Customers Say',
        entries: [
          { name: 'Jane Doe', role: 'CEO', quote: 'Amazing product!' },
          { name: 'John Smith', role: 'CTO', quote: 'Highly recommended.' },
        ],
      };
    case 'pricing':
      return {
        sectionTitle: 'Pricing Plans',
        tierCount: '3',
        tiers: [
          { name: 'Starter', price: '$9/mo' },
          { name: 'Pro', price: '$29/mo' },
          { name: 'Enterprise', price: '$99/mo' },
        ],
      };
    case 'cta':
      return {
        headline: 'Ready to get started?',
        buttonText: 'Sign Up Now',
        buttonColor: '#6366f1',
        backgroundColor: '#1e293b',
      };
    default:
      return {
        name: '',
        content: '',
      };
  }
}

const defaultSections = [
  {
    id: 'section-1',
    name: 'Hero Section',
    type: 'hero',
    visible: true,
    content: {
      headline: 'Build Something Amazing',
      subheadline: 'The all-in-one platform for your business',
      ctaButtonText: 'Get Started',
      backgroundColor: '#6366f1',
      textAlignment: 'center',
    },
  },
  {
    id: 'section-2',
    name: 'Features',
    type: 'features',
    visible: true,
    content: {
      sectionTitle: 'Powerful Features',
      columns: '3',
      items: [
        { name: 'Fast', description: 'Lightning fast performance' },
        { name: 'Secure', description: 'Enterprise-grade security' },
        { name: 'Scalable', description: 'Grows with your business' },
      ],
    },
  },
  {
    id: 'section-3',
    name: 'Testimonials',
    type: 'testimonials',
    visible: true,
    content: {
      sectionTitle: 'What Our Customers Say',
      entries: [
        { name: 'Jane Doe', role: 'CEO at TechCo', quote: 'Incredible platform that transformed our workflow.' },
        { name: 'John Smith', role: 'Marketing Lead', quote: 'The best investment we made this year.' },
      ],
    },
  },
  {
    id: 'section-4',
    name: 'Pricing',
    type: 'pricing',
    visible: true,
    content: {
      sectionTitle: 'Simple Pricing',
      tierCount: '3',
      tiers: [
        { name: 'Starter', price: '$9/mo' },
        { name: 'Pro', price: '$29/mo' },
        { name: 'Enterprise', price: '$99/mo' },
      ],
    },
  },
  {
    id: 'section-5',
    name: 'CTA / Footer',
    type: 'cta',
    visible: true,
    content: {
      headline: 'Ready to get started?',
      buttonText: 'Sign Up Now',
      buttonColor: '#6366f1',
      backgroundColor: '#1e293b',
    },
  },
];

function createNewSection() {
  return {
    id: generateId(),
    name: 'New Section',
    type: 'hero',
    visible: true,
    content: getDefaultContent('hero'),
  };
}

const pageTemplates = [
  { id: 'tpl-saas', name: 'SaaS Landing', description: 'Modern SaaS product page', color: '#6366f1', sections: [
    { id: 's1', name: 'Hero', type: 'hero', visible: true, content: { headline: 'Supercharge Your Workflow', subheadline: 'The all-in-one SaaS platform', ctaButtonText: 'Start Free Trial', backgroundColor: '#6366f1', textAlignment: 'center' } },
    { id: 's2', name: 'Features', type: 'features', visible: true, content: { sectionTitle: 'Why Choose Us', columns: '3', items: [{ name: 'Fast', description: 'Lightning fast' }, { name: 'Secure', description: 'Enterprise security' }, { name: 'Scalable', description: 'Grows with you' }] } },
    { id: 's3', name: 'Pricing', type: 'pricing', visible: true, content: { sectionTitle: 'Simple Pricing', tierCount: '3', tiers: [{ name: 'Starter', price: '$9/mo' }, { name: 'Pro', price: '$29/mo' }, { name: 'Enterprise', price: '$99/mo' }] } },
    { id: 's4', name: 'CTA', type: 'cta', visible: true, content: { headline: 'Ready to get started?', buttonText: 'Sign Up Free', buttonColor: '#6366f1', backgroundColor: '#1e293b' } },
  ]},
  { id: 'tpl-product', name: 'Product Showcase', description: 'Highlight your product features', color: '#10b981', sections: [
    { id: 's1', name: 'Hero', type: 'hero', visible: true, content: { headline: 'Meet Our Product', subheadline: 'Built for teams that move fast', ctaButtonText: 'See Demo', backgroundColor: '#10b981', textAlignment: 'center' } },
    { id: 's2', name: 'Features', type: 'features', visible: true, content: { sectionTitle: 'Key Features', columns: '4', items: [{ name: 'Analytics', description: 'Real-time insights' }, { name: 'Automation', description: 'Save hours' }, { name: 'Integration', description: '100+ apps' }, { name: 'Support', description: '24/7 help' }] } },
    { id: 's3', name: 'Testimonials', type: 'testimonials', visible: true, content: { sectionTitle: 'Loved by Teams', entries: [{ name: 'Sarah L.', role: 'CEO', quote: 'Game changer for our team.' }] } },
  ]},
  { id: 'tpl-event', name: 'Event Registration', description: 'Event sign-up page', color: '#f59e0b', sections: [
    { id: 's1', name: 'Hero', type: 'hero', visible: true, content: { headline: 'Join Our Event', subheadline: 'Limited seats available', ctaButtonText: 'Register Now', backgroundColor: '#f59e0b', textAlignment: 'center' } },
    { id: 's2', name: 'Details', type: 'features', visible: true, content: { sectionTitle: 'Event Details', columns: '2', items: [{ name: 'Date & Time', description: 'March 15, 2026' }, { name: 'Location', description: 'Virtual Event' }] } },
    { id: 's3', name: 'Registration', type: 'form', visible: true, content: { name: 'Registration Form', content: '' } },
  ]},
  { id: 'tpl-comingsoon', name: 'Coming Soon', description: 'Pre-launch teaser page', color: '#8b5cf6', sections: [
    { id: 's1', name: 'Hero', type: 'hero', visible: true, content: { headline: 'Something Big is Coming', subheadline: 'Be the first to know', ctaButtonText: 'Notify Me', backgroundColor: '#8b5cf6', textAlignment: 'center' } },
  ]},
  { id: 'tpl-app', name: 'App Download', description: 'Mobile app landing page', color: '#ec4899', sections: [
    { id: 's1', name: 'Hero', type: 'hero', visible: true, content: { headline: 'Download Our App', subheadline: 'Available on iOS & Android', ctaButtonText: 'Download Free', backgroundColor: '#ec4899', textAlignment: 'center' } },
    { id: 's2', name: 'Features', type: 'features', visible: true, content: { sectionTitle: 'App Features', columns: '3', items: [{ name: 'Offline Mode', description: 'Works without internet' }, { name: 'Push Alerts', description: 'Stay updated' }, { name: 'Dark Mode', description: 'Easy on eyes' }] } },
    { id: 's3', name: 'Stats', type: 'stats', visible: true, content: { name: 'Stats', content: '50K+ Downloads' } },
  ]},
  { id: 'tpl-portfolio', name: 'Portfolio', description: 'Showcase your work', color: '#ef4444', sections: [
    { id: 's1', name: 'Hero', type: 'hero', visible: true, content: { headline: 'My Portfolio', subheadline: 'Creative work & projects', ctaButtonText: 'View Work', backgroundColor: '#ef4444', textAlignment: 'center' } },
    { id: 's2', name: 'Gallery', type: 'gallery', visible: true, content: { name: 'Projects', content: '' } },
    { id: 's3', name: 'CTA', type: 'cta', visible: true, content: { headline: 'Let\'s Work Together', buttonText: 'Contact Me', buttonColor: '#ef4444', backgroundColor: '#1e293b' } },
  ]},
];

const mockPages = {
  1: { name: 'Property Investment', sections: [
    { id: 's1', name: 'Hero', type: 'hero', visible: true, content: { headline: 'Invest in Premium Properties', subheadline: 'High returns guaranteed', ctaButtonText: 'Learn More', backgroundColor: '#6366f1', textAlignment: 'center' } },
    { id: 's2', name: 'Features', type: 'features', visible: true, content: { sectionTitle: 'Why Invest', columns: '3', items: [{ name: 'High ROI', description: '12% annual returns' }, { name: 'Safe', description: 'RERA approved' }, { name: 'Flexible', description: 'Easy exit' }] } },
    { id: 's3', name: 'CTA', type: 'cta', visible: true, content: { headline: 'Start Investing Today', buttonText: 'Get Started', buttonColor: '#6366f1', backgroundColor: '#1e293b' } },
  ]},
  2: { name: 'Free Consultation', sections: [
    { id: 's1', name: 'Hero', type: 'hero', visible: true, content: { headline: 'Free Expert Consultation', subheadline: 'Book your 30-min call', ctaButtonText: 'Book Now', backgroundColor: '#10b981', textAlignment: 'center' } },
    { id: 's2', name: 'Testimonials', type: 'testimonials', visible: true, content: { sectionTitle: 'What Clients Say', entries: [{ name: 'Amit K.', role: 'Business Owner', quote: 'Very helpful session!' }] } },
  ]},
  3: { name: 'Product Demo', sections: defaultSections },
  4: { name: 'Webinar Registration', sections: [
    { id: 's1', name: 'Hero', type: 'hero', visible: true, content: { headline: 'Free Webinar', subheadline: 'Learn AI Marketing', ctaButtonText: 'Register Free', backgroundColor: '#8b5cf6', textAlignment: 'center' } },
    { id: 's2', name: 'Form', type: 'form', visible: true, content: { name: 'Registration', content: '' } },
  ]},
};

export default function LandingPageBuilder() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('template');

  const getInitialState = () => {
    if (id && mockPages[id]) {
      return { sections: mockPages[id].sections, name: mockPages[id].name };
    }
    if (templateId) {
      const tpl = pageTemplates.find(t => t.id === templateId);
      if (tpl) return { sections: tpl.sections, name: tpl.name };
    }
    return { sections: defaultSections, name: 'New Landing Page' };
  };

  const [showTemplates, setShowTemplates] = useState(!id && !templateId);
  const initial = getInitialState();
  const [sections, setSections] = useState(initial.sections);
  const [selectedSectionId, setSelectedSectionId] = useState(initial.sections[0].id);
  const [pageName, setPageName] = useState(initial.name);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(initial.name);
  const [draft, setDraft] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setSections(prev => {
        const oldIndex = prev.findIndex(s => s.id === active.id);
        const newIndex = prev.findIndex(s => s.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const handleSelectTemplate = (tpl) => {
    setSections(tpl.sections);
    setPageName(tpl.name);
    setSelectedSectionId(tpl.sections[0].id);
    setShowTemplates(false);
    toast.success(`Template "${tpl.name}" loaded`);
  };

  const selectedSection = sections.find((s) => s.id === selectedSectionId) || null;

  function selectSection(id) {
    setSelectedSectionId(id);
    const section = sections.find((s) => s.id === id);
    if (section) {
      setDraft(JSON.parse(JSON.stringify(section)));
    }
  }

  // Initialize draft on first render
  if (selectedSection && !draft) {
    setTimeout(() => setDraft(JSON.parse(JSON.stringify(selectedSection))), 0);
  }

  function handleInsertSection(index) {
    const newSection = createNewSection();
    const updated = [...sections];
    updated.splice(index, 0, newSection);
    setSections(updated);
    selectSection(newSection.id);
    toast.success('New section added');
  }

  function handleDeleteSection(id) {
    if (sections.length <= 1) {
      toast.error('Page must have at least one section');
      return;
    }
    const updated = sections.filter((s) => s.id !== id);
    setSections(updated);
    if (selectedSectionId === id) {
      selectSection(updated[0].id);
    }
    toast.success('Section deleted');
  }

  function handleToggleVisibility(id) {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s))
    );
    const section = sections.find((s) => s.id === id);
    toast.success(section?.visible ? 'Section hidden' : 'Section visible');
  }

  function handleApplyChanges() {
    if (!draft) return;
    setSections((prev) =>
      prev.map((s) => (s.id === draft.id ? JSON.parse(JSON.stringify(draft)) : s))
    );
    toast.success('Changes applied');
  }

  function handleDraftChange(field, value) {
    setDraft((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, [field]: value };
      // When type changes, reset content to new type defaults
      if (field === 'type') {
        updated.content = getDefaultContent(value);
      }
      return updated;
    });
  }

  function handleDraftContentChange(field, value) {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        content: { ...prev.content, [field]: value },
      };
    });
  }

  // Feature items for features type
  function handleFeatureItemChange(index, field, value) {
    setDraft((prev) => {
      if (!prev) return prev;
      const items = [...(prev.content.items || [])];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, content: { ...prev.content, items } };
    });
  }

  function handleAddFeatureItem() {
    setDraft((prev) => {
      if (!prev) return prev;
      const items = [...(prev.content.items || [])];
      if (items.length >= 6) {
        toast.error('Maximum 6 feature items allowed');
        return prev;
      }
      items.push({ name: '', description: '' });
      return { ...prev, content: { ...prev.content, items } };
    });
  }

  function handleRemoveFeatureItem(index) {
    setDraft((prev) => {
      if (!prev) return prev;
      const items = [...(prev.content.items || [])];
      items.splice(index, 1);
      return { ...prev, content: { ...prev.content, items } };
    });
  }

  // Testimonial entries
  function handleTestimonialChange(index, field, value) {
    setDraft((prev) => {
      if (!prev) return prev;
      const entries = [...(prev.content.entries || [])];
      entries[index] = { ...entries[index], [field]: value };
      return { ...prev, content: { ...prev.content, entries } };
    });
  }

  function handleAddTestimonial() {
    setDraft((prev) => {
      if (!prev) return prev;
      const entries = [...(prev.content.entries || [])];
      if (entries.length >= 4) {
        toast.error('Maximum 4 testimonials allowed');
        return prev;
      }
      entries.push({ name: '', role: '', quote: '' });
      return { ...prev, content: { ...prev.content, entries } };
    });
  }

  function handleRemoveTestimonial(index) {
    setDraft((prev) => {
      if (!prev) return prev;
      const entries = [...(prev.content.entries || [])];
      entries.splice(index, 1);
      return { ...prev, content: { ...prev.content, entries } };
    });
  }

  // Pricing tiers
  function handleTierChange(index, field, value) {
    setDraft((prev) => {
      if (!prev) return prev;
      const tiers = [...(prev.content.tiers || [])];
      tiers[index] = { ...tiers[index], [field]: value };
      return { ...prev, content: { ...prev.content, tiers } };
    });
  }

  function handleTierCountChange(count) {
    setDraft((prev) => {
      if (!prev) return prev;
      const numCount = parseInt(count, 10);
      const tiers = [...(prev.content.tiers || [])];
      while (tiers.length < numCount) {
        tiers.push({ name: `Tier ${tiers.length + 1}`, price: '$0/mo' });
      }
      const trimmedTiers = tiers.slice(0, numCount);
      return {
        ...prev,
        content: { ...prev.content, tierCount: count, tiers: trimmedTiers },
      };
    });
  }

  function handleSaveDraft() {
    toast.success('Landing page draft saved successfully');
  }

  function handlePublish() {
    toast.success('Landing page published successfully!');
  }

  function handlePreview() {
    toast.success('Preview opened in new tab');
  }

  function handleNameEditStart() {
    setNameInput(pageName);
    setIsEditingName(true);
  }

  function handleNameEditConfirm() {
    const trimmed = nameInput.trim();
    if (trimmed) {
      setPageName(trimmed);
    }
    setIsEditingName(false);
  }

  function handleNameKeyDown(e) {
    if (e.key === 'Enter') handleNameEditConfirm();
    if (e.key === 'Escape') setIsEditingName(false);
  }

  function getSectionIcon(type) {
    const IconComponent = SECTION_ICON_MAP[type] || FileCode;
    return IconComponent;
  }

  function renderRightPanel() {
    if (!draft || !selectedSection) {
      return (
        <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500">
          <div className="text-center">
            <Layout className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Select a section to configure</p>
          </div>
        </div>
      );
    }

    const inputClass =
      'w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            {(() => {
              const Icon = getSectionIcon(draft.type);
              return <Icon className="w-5 h-5 text-indigo-600" />;
            })()}
            Configure Section
          </h2>

          <div className="space-y-5">
            {/* Section Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Section Name
              </label>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => handleDraftChange('name', e.target.value)}
                className={inputClass}
                placeholder="Enter section name"
              />
            </div>

            {/* Section Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Section Type
              </label>
              <select
                value={draft.type}
                onChange={(e) => handleDraftChange('type', e.target.value)}
                className={inputClass}
              >
                {SECTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Type-specific fields */}
            {draft.type === 'hero' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Headline
                  </label>
                  <input
                    type="text"
                    value={draft.content.headline || ''}
                    onChange={(e) => handleDraftContentChange('headline', e.target.value)}
                    className={inputClass}
                    placeholder="Main headline"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Subheadline
                  </label>
                  <input
                    type="text"
                    value={draft.content.subheadline || ''}
                    onChange={(e) => handleDraftContentChange('subheadline', e.target.value)}
                    className={inputClass}
                    placeholder="Supporting text"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    CTA Button Text
                  </label>
                  <input
                    type="text"
                    value={draft.content.ctaButtonText || ''}
                    onChange={(e) => handleDraftContentChange('ctaButtonText', e.target.value)}
                    className={inputClass}
                    placeholder="Get Started"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Background Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={draft.content.backgroundColor || ''}
                      onChange={(e) => handleDraftContentChange('backgroundColor', e.target.value)}
                      className={inputClass}
                      placeholder="#6366f1"
                    />
                    <div
                      className="w-10 h-10 rounded-lg border border-slate-300 dark:border-slate-600 shrink-0"
                      style={{ backgroundColor: draft.content.backgroundColor || '#6366f1' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Text Alignment
                  </label>
                  <select
                    value={draft.content.textAlignment || 'center'}
                    onChange={(e) => handleDraftContentChange('textAlignment', e.target.value)}
                    className={inputClass}
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>
              </>
            )}

            {draft.type === 'features' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Section Title
                  </label>
                  <input
                    type="text"
                    value={draft.content.sectionTitle || ''}
                    onChange={(e) => handleDraftContentChange('sectionTitle', e.target.value)}
                    className={inputClass}
                    placeholder="Features"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Number of Columns
                  </label>
                  <select
                    value={draft.content.columns || '3'}
                    onChange={(e) => handleDraftContentChange('columns', e.target.value)}
                    className={inputClass}
                  >
                    <option value="2">2 Columns</option>
                    <option value="3">3 Columns</option>
                    <option value="4">4 Columns</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Feature Items ({(draft.content.items || []).length}/6)
                  </label>
                  <div className="space-y-3">
                    {(draft.content.items || []).map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            Feature {idx + 1}
                          </span>
                          <button
                            onClick={() => handleRemoveFeatureItem(idx)}
                            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleFeatureItemChange(idx, 'name', e.target.value)}
                          className={`${inputClass} mb-2`}
                          placeholder="Feature name"
                        />
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) =>
                            handleFeatureItemChange(idx, 'description', e.target.value)
                          }
                          className={inputClass}
                          placeholder="Feature description"
                        />
                      </div>
                    ))}
                  </div>
                  {(draft.content.items || []).length < 6 && (
                    <button
                      onClick={handleAddFeatureItem}
                      className="mt-2 flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Add Feature
                    </button>
                  )}
                </div>
              </>
            )}

            {draft.type === 'testimonials' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Section Title
                  </label>
                  <input
                    type="text"
                    value={draft.content.sectionTitle || ''}
                    onChange={(e) => handleDraftContentChange('sectionTitle', e.target.value)}
                    className={inputClass}
                    placeholder="What Our Customers Say"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Testimonials ({(draft.content.entries || []).length}/4)
                  </label>
                  <div className="space-y-3">
                    {(draft.content.entries || []).map((entry, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            Testimonial {idx + 1}
                          </span>
                          <button
                            onClick={() => handleRemoveTestimonial(idx)}
                            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={entry.name}
                          onChange={(e) => handleTestimonialChange(idx, 'name', e.target.value)}
                          className={`${inputClass} mb-2`}
                          placeholder="Name"
                        />
                        <input
                          type="text"
                          value={entry.role}
                          onChange={(e) => handleTestimonialChange(idx, 'role', e.target.value)}
                          className={`${inputClass} mb-2`}
                          placeholder="Role / Company"
                        />
                        <textarea
                          value={entry.quote}
                          onChange={(e) => handleTestimonialChange(idx, 'quote', e.target.value)}
                          className={`${inputClass} resize-none`}
                          rows={2}
                          placeholder="Testimonial quote"
                        />
                      </div>
                    ))}
                  </div>
                  {(draft.content.entries || []).length < 4 && (
                    <button
                      onClick={handleAddTestimonial}
                      className="mt-2 flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Add Testimonial
                    </button>
                  )}
                </div>
              </>
            )}

            {draft.type === 'pricing' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Section Title
                  </label>
                  <input
                    type="text"
                    value={draft.content.sectionTitle || ''}
                    onChange={(e) => handleDraftContentChange('sectionTitle', e.target.value)}
                    className={inputClass}
                    placeholder="Pricing Plans"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Number of Tiers
                  </label>
                  <select
                    value={draft.content.tierCount || '3'}
                    onChange={(e) => handleTierCountChange(e.target.value)}
                    className={inputClass}
                  >
                    <option value="2">2 Tiers</option>
                    <option value="3">3 Tiers</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Pricing Tiers
                  </label>
                  <div className="space-y-3">
                    {(draft.content.tiers || []).map((tier, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600"
                      >
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 block">
                          Tier {idx + 1}
                        </span>
                        <div className="flex gap-3">
                          <input
                            type="text"
                            value={tier.name}
                            onChange={(e) => handleTierChange(idx, 'name', e.target.value)}
                            className={`${inputClass} flex-1`}
                            placeholder="Tier name"
                          />
                          <input
                            type="text"
                            value={tier.price}
                            onChange={(e) => handleTierChange(idx, 'price', e.target.value)}
                            className={`${inputClass} w-32`}
                            placeholder="$0/mo"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {draft.type === 'cta' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Headline
                  </label>
                  <input
                    type="text"
                    value={draft.content.headline || ''}
                    onChange={(e) => handleDraftContentChange('headline', e.target.value)}
                    className={inputClass}
                    placeholder="Ready to get started?"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Button Text
                  </label>
                  <input
                    type="text"
                    value={draft.content.buttonText || ''}
                    onChange={(e) => handleDraftContentChange('buttonText', e.target.value)}
                    className={inputClass}
                    placeholder="Sign Up Now"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Button Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={draft.content.buttonColor || ''}
                      onChange={(e) => handleDraftContentChange('buttonColor', e.target.value)}
                      className={inputClass}
                      placeholder="#6366f1"
                    />
                    <div
                      className="w-10 h-10 rounded-lg border border-slate-300 dark:border-slate-600 shrink-0"
                      style={{ backgroundColor: draft.content.buttonColor || '#6366f1' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Background Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={draft.content.backgroundColor || ''}
                      onChange={(e) =>
                        handleDraftContentChange('backgroundColor', e.target.value)
                      }
                      className={inputClass}
                      placeholder="#1e293b"
                    />
                    <div
                      className="w-10 h-10 rounded-lg border border-slate-300 dark:border-slate-600 shrink-0"
                      style={{ backgroundColor: draft.content.backgroundColor || '#1e293b' }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Generic fallback for other types */}
            {!['hero', 'features', 'testimonials', 'pricing', 'cta'].includes(draft.type) && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={draft.content.name || ''}
                    onChange={(e) => handleDraftContentChange('name', e.target.value)}
                    className={inputClass}
                    placeholder="Section content name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Content
                  </label>
                  <textarea
                    value={draft.content.content || ''}
                    onChange={(e) => handleDraftContentChange('content', e.target.value)}
                    className={`${inputClass} resize-none`}
                    rows={6}
                    placeholder="Enter section content..."
                  />
                </div>
              </>
            )}

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
    );
  }

  if (showTemplates) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Choose a Page Template</h1>
          <p className="text-sm text-slate-500">Start with a pre-built landing page or create from scratch</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pageTemplates.map(tpl => (
            <button key={tpl.id} onClick={() => handleSelectTemplate(tpl)} className="text-left bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:shadow-md transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: tpl.color + '20' }}>
                  <Monitor className="w-5 h-5" style={{ color: tpl.color }} />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{tpl.name}</h3>
              </div>
              <p className="text-sm text-slate-500 mb-3">{tpl.description}</p>
              <span className="text-xs text-slate-400">{tpl.sections.length} sections</span>
            </button>
          ))}
          <button onClick={() => setShowTemplates(false)} className="text-left bg-white dark:bg-slate-800 rounded-xl p-5 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-400 transition-all flex flex-col items-center justify-center">
            <Plus className="w-8 h-8 text-slate-400 mb-2" />
            <h3 className="font-semibold text-slate-900 dark:text-white">Blank Page</h3>
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
          <Monitor className="w-5 h-5 text-indigo-600 shrink-0" />
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
                {pageName}
              </h1>
              <Edit3 className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
          <span className="text-sm text-slate-500 dark:text-slate-400 ml-2">
            {sections.length} section{sections.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            onClick={handlePreview}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>
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
        {/* Left Panel - Section List */}
        <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col shrink-0 max-h-[40vh] md:max-h-none">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
              Page Sections
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {/* Insert button before first section */}
            <div className="flex justify-center py-1">
              <button
                onClick={() => handleInsertSection(0)}
                className="flex items-center justify-center w-7 h-7 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                title="Insert section here"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                {sections.map((section, index) => {
                  const Icon = getSectionIcon(section.type);
                  return (
                    <SortableItem key={section.id} id={section.id}>
                      {({ ref, style, attributes, listeners }) => (
                        <div ref={ref} style={style} {...attributes}>
                          {/* Section Card */}
                          <div
                            onClick={() => selectSection(section.id)}
                            className={`relative flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-all ${
                              selectedSectionId === section.id
                                ? 'border-2 border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                : 'border-2 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700/50'
                            }`}
                          >
                            {/* Drag Handle */}
                            <button {...listeners} className="cursor-grab active:cursor-grabbing shrink-0" title="Drag to reorder">
                              <GripVertical className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                            </button>

                            {/* Icon */}
                            <Icon className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0" />

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                {section.name}
                              </div>
                              <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                                {section.type}
                              </span>
                            </div>

                            {/* Visibility Toggle */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleVisibility(section.id);
                              }}
                              className={`p-1 rounded transition-colors ${
                                section.visible
                                  ? 'text-slate-400 hover:text-indigo-500'
                                  : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'
                              }`}
                              title={section.visible ? 'Hide section' : 'Show section'}
                            >
                              {section.visible ? (
                                <Eye className="w-4 h-4" />
                              ) : (
                                <EyeOff className="w-4 h-4" />
                              )}
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSection(section.id);
                              }}
                              className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              title="Delete section"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Insert button after each section */}
                          <div className="flex justify-center py-1">
                            <button
                              onClick={() => handleInsertSection(index + 1)}
                              className="flex items-center justify-center w-7 h-7 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                              title="Insert section here"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </SortableItem>
                  );
                })}
              </SortableContext>
            </DndContext>
          </div>
        </div>

        {/* Right Panel - Section Configuration */}
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
          {renderRightPanel()}
        </div>
      </div>

      {/* Bottom Flow Visualization Strip */}
      <div className="px-4 sm:px-6 py-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shrink-0 overflow-x-auto">
        <div className="flex items-center justify-center gap-0 min-w-max">
          {sections.map((section, index) => {
            const Icon = getSectionIcon(section.type);
            return (
              <div key={section.id} className="flex items-center shrink-0">
                <button
                  onClick={() => selectSection(section.id)}
                  className="flex flex-col items-center group"
                  title={section.name}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                      selectedSectionId === section.id
                        ? 'bg-indigo-600 text-white ring-4 ring-indigo-300 dark:ring-indigo-700 scale-110'
                        : section.visible
                          ? 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 hover:scale-105'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 opacity-50 hover:scale-105'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span
                    className={`mt-1 text-xs max-w-[80px] truncate ${
                      selectedSectionId === section.id
                        ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {section.name}
                  </span>
                </button>

                {index < sections.length - 1 && (
                  <div className="flex items-center mx-2 mb-5">
                    <div className="w-8 h-0.5 bg-slate-300 dark:bg-slate-600" />
                    <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 -ml-1" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
