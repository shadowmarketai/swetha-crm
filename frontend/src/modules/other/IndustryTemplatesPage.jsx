/**
 * Industry Templates Page
 * Grid of industry-specific CRM templates with activation flow
 */

import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  Building2, Heart, GraduationCap, ShoppingCart, UtensilsCrossed,
  Dumbbell, Scale, Car, Plane, Shield, Search, CheckCircle, X,
  AlertTriangle, Sparkles
} from 'lucide-react';

const templates = [
  {
    id: 1,
    name: 'Real Estate',
    icon: Building2,
    color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    description: 'Property listings, agent management, and buyer tracking for real estate businesses.',
    features: ['Property listing pipeline with stages', 'Agent performance tracking dashboard', 'Automated follow-ups for property inquiries'],
  },
  {
    id: 2,
    name: 'Healthcare',
    icon: Heart,
    color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    description: 'Patient scheduling, medical records management, and appointment reminders.',
    features: ['Patient appointment scheduling system', 'Medical records and history tracking', 'Automated appointment reminders via SMS'],
  },
  {
    id: 3,
    name: 'Education',
    icon: GraduationCap,
    color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
    description: 'Student enrollment, course management, and academic progress tracking.',
    features: ['Student enrollment and admission pipeline', 'Course and batch management system', 'Fee tracking and payment reminders'],
  },
  {
    id: 4,
    name: 'E-commerce',
    icon: ShoppingCart,
    color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    description: 'Product catalog, order tracking, and customer relationship management.',
    features: ['Product catalog with inventory sync', 'Order tracking and fulfillment pipeline', 'Customer segmentation and re-engagement'],
  },
  {
    id: 5,
    name: 'Restaurant',
    icon: UtensilsCrossed,
    color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    description: 'Table booking, menu management, and customer loyalty programs.',
    features: ['Table reservation management system', 'Digital menu and ordering integration', 'Customer loyalty and feedback tracking'],
  },
  {
    id: 6,
    name: 'Fitness',
    icon: Dumbbell,
    color: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
    description: 'Member management, class scheduling, and membership renewals.',
    features: ['Member registration and profile management', 'Class scheduling with trainer assignment', 'Membership renewal and payment automation'],
  },
  {
    id: 7,
    name: 'Legal',
    icon: Scale,
    color: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
    description: 'Case management, document tracking, and client communication.',
    features: ['Case pipeline with status tracking', 'Document management and version control', 'Client communication log and billing'],
  },
  {
    id: 8,
    name: 'Automotive',
    icon: Car,
    color: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
    description: 'Vehicle inventory, service appointments, and customer follow-ups.',
    features: ['Vehicle inventory and listing management', 'Service appointment scheduling system', 'Test drive booking and lead follow-ups'],
  },
  {
    id: 9,
    name: 'Travel',
    icon: Plane,
    color: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
    description: 'Trip booking, itinerary management, and traveler communication.',
    features: ['Trip booking and package management', 'Itinerary builder with day-wise planning', 'Traveler communication and feedback system'],
  },
  {
    id: 10,
    name: 'Insurance',
    icon: Shield,
    color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    description: 'Policy management, claims processing, and agent tracking.',
    features: ['Policy lifecycle management pipeline', 'Claims processing and status tracking', 'Agent commission and performance reports'],
  },
];

export default function IndustryTemplatesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTemplateId, setActiveTemplateId] = useState(1); // Real Estate is active by default
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [activateOptions, setActivateOptions] = useState({
    importSampleData: true,
    applyPipeline: true,
    setupAutomation: false,
  });

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenActivate = (template) => {
    setSelectedTemplate(template);
    setActivateOptions({ importSampleData: true, applyPipeline: true, setupAutomation: false });
    setShowActivateModal(true);
  };

  const handleActivate = () => {
    if (!selectedTemplate) return;
    setActiveTemplateId(selectedTemplate.id);
    toast.success(`${selectedTemplate.name} template activated!`);
    setShowActivateModal(false);
    setSelectedTemplate(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Industry Templates</h1>
        <p className="text-sm text-slate-500">Pre-configured CRM templates for your industry</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search templates..."
          className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
        />
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTemplates.map(template => {
          const Icon = template.icon;
          const isActive = activeTemplateId === template.id;

          return (
            <div
              key={template.id}
              className={`bg-white dark:bg-slate-800 rounded-xl border ${
                isActive
                  ? 'border-emerald-400 dark:border-emerald-500 ring-1 ring-emerald-400/30'
                  : 'border-slate-200 dark:border-slate-700'
              } p-5 flex flex-col relative`}
            >
              {/* Active Badge */}
              {isActive && (
                <div className="absolute top-3 right-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <CheckCircle className="w-3 h-3" /> Active
                  </span>
                </div>
              )}

              {/* Icon & Name */}
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${template.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">{template.name}</h3>
              </div>

              {/* Description */}
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{template.description}</p>

              {/* Features */}
              <ul className="space-y-2 mb-5 flex-1">
                {template.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Activate Button */}
              <button
                onClick={() => handleOpenActivate(template)}
                disabled={isActive}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 cursor-default'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {isActive ? (
                  <>
                    <CheckCircle className="w-4 h-4" /> Currently Active
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Activate
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* No Results */}
      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <Search className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">No templates match your search.</p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Clear search
          </button>
        </div>
      )}

      {/* Activation Modal */}
      {showActivateModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowActivateModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Activate {selectedTemplate.name}
              </h2>
              <button onClick={() => setShowActivateModal(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg mb-5">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                This will configure your CRM with <strong>{selectedTemplate.name}</strong>-specific pipelines, fields, and workflows. Your existing data will not be deleted.
              </p>
            </div>

            {/* Template Info */}
            <div className="flex items-center gap-3 mb-5">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedTemplate.color}`}>
                <selectedTemplate.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-white">{selectedTemplate.name} Template</p>
                <p className="text-xs text-slate-500">{selectedTemplate.description}</p>
              </div>
            </div>

            {/* Customize Options */}
            <div className="space-y-3 mb-6">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Customize activation:</p>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activateOptions.importSampleData}
                  onChange={e => setActivateOptions({ ...activateOptions, importSampleData: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">Import sample data</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activateOptions.applyPipeline}
                  onChange={e => setActivateOptions({ ...activateOptions, applyPipeline: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">Apply industry pipeline</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activateOptions.setupAutomation}
                  onChange={e => setActivateOptions({ ...activateOptions, setupAutomation: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">Set up automation rules</span>
              </label>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowActivateModal(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleActivate}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                <Sparkles className="w-4 h-4" /> Activate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}