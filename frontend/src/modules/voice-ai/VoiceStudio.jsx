/**
 * Voice Studio - Train and customize dialect-aware AI voices
 */

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import {
  Mic, Play, Settings, Upload, Volume2, Sliders, Sparkles,
  Languages, Brain, AudioWaveform, Music, User, UserCircle,
  CheckCircle, UploadCloud, FileAudio, RotateCcw, Save,
  ChevronDown, ToggleLeft, ToggleRight, Palette
} from 'lucide-react';
import CollapsibleSection from './components/CollapsibleSection';
import DialectBadge from './components/DialectBadge';
import EmotionIndicator from './components/EmotionIndicator';
import GenZBadge from './components/GenZBadge';

const VOICE_MODELS = [
  { id: 'kongu-m', name: 'Kongu Tamil Male', dialect: 'Kongu', language: 'Tamil', accent: 'Western Tamil', gender: 'male', borderColor: 'border-orange-500', bgHover: 'hover:bg-orange-50 dark:hover:bg-orange-900/10', activeBg: 'bg-orange-50 dark:bg-orange-900/20' },
  { id: 'kongu-f', name: 'Kongu Tamil Female', dialect: 'Kongu', language: 'Tamil', accent: 'Western Tamil', gender: 'female', borderColor: 'border-orange-500', bgHover: 'hover:bg-orange-50 dark:hover:bg-orange-900/10', activeBg: 'bg-orange-50 dark:bg-orange-900/20' },
  { id: 'chennai-m', name: 'Chennai Tamil Male', dialect: 'Chennai', language: 'Tamil', accent: 'Central Tamil', gender: 'male', borderColor: 'border-blue-500', bgHover: 'hover:bg-blue-50 dark:hover:bg-blue-900/10', activeBg: 'bg-blue-50 dark:bg-blue-900/20' },
  { id: 'chennai-f', name: 'Chennai Tamil Female', dialect: 'Chennai', language: 'Tamil', accent: 'Central Tamil', gender: 'female', borderColor: 'border-blue-500', bgHover: 'hover:bg-blue-50 dark:hover:bg-blue-900/10', activeBg: 'bg-blue-50 dark:bg-blue-900/20' },
  { id: 'madurai-m', name: 'Madurai Tamil Male', dialect: 'Madurai', language: 'Tamil', accent: 'Southern Tamil', gender: 'male', borderColor: 'border-purple-500', bgHover: 'hover:bg-purple-50 dark:hover:bg-purple-900/10', activeBg: 'bg-purple-50 dark:bg-purple-900/20' },
  { id: 'madurai-f', name: 'Madurai Tamil Female', dialect: 'Madurai', language: 'Tamil', accent: 'Southern Tamil', gender: 'female', borderColor: 'border-purple-500', bgHover: 'hover:bg-purple-50 dark:hover:bg-purple-900/10', activeBg: 'bg-purple-50 dark:bg-purple-900/20' },
  { id: 'tirunelveli-m', name: 'Tirunelveli Tamil Male', dialect: 'Tirunelveli', language: 'Tamil', accent: 'Deep South Tamil', gender: 'male', borderColor: 'border-teal-500', bgHover: 'hover:bg-teal-50 dark:hover:bg-teal-900/10', activeBg: 'bg-teal-50 dark:bg-teal-900/20' },
  { id: 'tirunelveli-f', name: 'Tirunelveli Tamil Female', dialect: 'Tirunelveli', language: 'Tamil', accent: 'Deep South Tamil', gender: 'female', borderColor: 'border-teal-500', bgHover: 'hover:bg-teal-50 dark:hover:bg-teal-900/10', activeBg: 'bg-teal-50 dark:bg-teal-900/20' },
];

const EMOTIONS = [
  { key: 'happy', label: 'Happy', color: 'bg-emerald-500', trackColor: 'accent-emerald-500' },
  { key: 'sad', label: 'Sad', color: 'bg-blue-500', trackColor: 'accent-blue-500' },
  { key: 'angry', label: 'Angry', color: 'bg-red-500', trackColor: 'accent-red-500' },
  { key: 'neutral', label: 'Neutral', color: 'bg-slate-400', trackColor: 'accent-slate-500' },
  { key: 'excited', label: 'Excited', color: 'bg-amber-500', trackColor: 'accent-amber-500' },
  { key: 'confused', label: 'Confused', color: 'bg-purple-500', trackColor: 'accent-purple-500' },
];

const DIALECTS = ['Kongu', 'Chennai', 'Madurai', 'Tirunelveli'];
const LANGUAGES = ['Tamil', 'Hindi', 'English', 'Tamil-English Mix', 'Hindi-English Mix'];

export default function VoiceStudioPage() {
  const [selectedModel, setSelectedModel] = useState('kongu-m');
  const [speakingSpeed, setSpeakingSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [emotionIntensity, setEmotionIntensity] = useState({
    happy: 50, sad: 20, angry: 10, neutral: 70, excited: 40, confused: 15,
  });
  const [genZMode, setGenZMode] = useState(false);
  const [codeMixRatio, setCodeMixRatio] = useState(35);

  // Generate Speech state
  const [speechText, setSpeechText] = useState('');
  const [speechDialect, setSpeechDialect] = useState('Kongu');
  const [speechEmotion, setSpeechEmotion] = useState('neutral');
  const [speechGenZ, setSpeechGenZ] = useState(false);

  // Training state
  const [trainingDialect, setTrainingDialect] = useState('Kongu');
  const [trainingLanguage, setTrainingLanguage] = useState('Tamil');
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const handleEmotionChange = (key, value) => {
    setEmotionIntensity((prev) => ({ ...prev, [key]: Number(value) }));
  };

  const handleSaveSettings = () => {
    toast.success('Voice settings saved successfully');
  };

  const handlePreviewVoice = (model) => {
    toast('Playing preview for ' + model.name + '...', { icon: '\u{1F50A}' });
  };

  const handleGenerateSpeech = () => {
    if (!speechText.trim()) {
      toast.error('Please enter text to generate speech');
      return;
    }
    toast.success('Generating speech with ' + speechDialect + ' dialect (' + speechEmotion + ')...');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    const audioFiles = files.filter((f) => f.type.startsWith('audio/') || f.name.endsWith('.wav') || f.name.endsWith('.mp3'));
    if (audioFiles.length === 0) {
      toast.error('Please upload audio files (.wav, .mp3)');
      return;
    }
    setUploadedFiles((prev) => [...prev, ...audioFiles.map((f) => f.name)]);
    toast.success(audioFiles.length + ' file(s) uploaded successfully');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setUploadedFiles((prev) => [...prev, ...files.map((f) => f.name)]);
      toast.success(files.length + ' file(s) uploaded successfully');
    }
  };

  const handleStartTraining = () => {
    if (uploadedFiles.length === 0) {
      toast.error('Please upload training audio files first');
      return;
    }
    toast.success('Training started for ' + trainingDialect + ' ' + trainingLanguage + ' voice model. This may take 15-30 minutes.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Voice Studio</h1>
          <p className="text-sm text-slate-500 mt-1">Train and customize dialect-aware AI voices</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toast('Resetting all settings to defaults...', { icon: '\u{1F504}' })}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
          <button
            onClick={handleSaveSettings}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Save className="w-4 h-4" /> Save All
          </button>
        </div>
      </div>

      {/* Voice Models + Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Voice Models - 2 col span */}
        <div className="lg:col-span-2">
          <CollapsibleSection title="Dialect-Specific Voice Models" badge={VOICE_MODELS.length + ' models'}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {VOICE_MODELS.map((model) => {
                const isActive = selectedModel === model.id;
                return (
                  <div
                    key={model.id}
                    onClick={() => setSelectedModel(model.id)}
                    className={`relative cursor-pointer rounded-xl border-2 p-4 transition-all ${
                      isActive
                        ? model.borderColor + ' ' + model.activeBg + ' shadow-md'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 ' + model.bgHover
                    }`}
                  >
                    {isActive && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        model.gender === 'male'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          : 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400'
                      }`}>
                        {model.gender === 'male' ? <User className="w-5 h-5" /> : <UserCircle className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-slate-900 dark:text-white truncate">{model.name}</h4>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <DialectBadge dialect={model.dialect} />
                          <span className="text-xs text-slate-500">{model.language}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{model.accent}</p>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreviewVoice(model);
                      }}
                      className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" /> Preview
                    </button>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>
        </div>

        {/* Voice Settings Panel - Right Column */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-5">
              <Sliders className="w-4 h-4 text-indigo-500" /> Voice Settings
            </h3>

            {/* Speaking Speed */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Speaking Speed</label>
                <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">{speakingSpeed.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={speakingSpeed}
                onChange={(e) => setSpeakingSpeed(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>0.5x</span>
                <span>2.0x</span>
              </div>
            </div>

            {/* Pitch */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Pitch</label>
                <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">{pitch > 0 ? '+' : ''}{pitch}</span>
              </div>
              <input
                type="range"
                min="-20"
                max="20"
                step="1"
                value={pitch}
                onChange={(e) => setPitch(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>-20</span>
                <span>+20</span>
              </div>
            </div>

            {/* Emotion Intensity Sliders */}
            <div className="mb-5">
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Emotion Intensity</h4>
              <div className="space-y-3">
                {EMOTIONS.map((emo) => (
                  <div key={emo.key}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${emo.color}`} />
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{emo.label}</span>
                      </div>
                      <span className="text-xs font-mono text-slate-400">{emotionIntensity[emo.key]}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={emotionIntensity[emo.key]}
                      onChange={(e) => handleEmotionChange(emo.key, e.target.value)}
                      className={`w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer ${emo.trackColor}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* GenZ Mode Toggle */}
            <div className="mb-5 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-pink-500" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">GenZ Mode</span>
                  {genZMode && <GenZBadge score={0.8} terms={['slay', 'no cap']} />}
                </div>
                <button
                  onClick={() => {
                    setGenZMode(!genZMode);
                    toast(genZMode ? 'GenZ mode disabled' : 'GenZ mode enabled', { icon: '\u2728' });
                  }}
                  className="text-slate-500 hover:text-indigo-600 transition-colors"
                >
                  {genZMode ? (
                    <ToggleRight className="w-8 h-8 text-pink-500" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-slate-400" />
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1.5">Enable GenZ slang understanding and natural responses</p>
            </div>

            {/* Code-Mixing Ratio */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Languages className="w-4 h-4 text-teal-500" />
                  Code-Mixing Ratio
                </label>
                <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">{codeMixRatio}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={codeMixRatio}
                onChange={(e) => setCodeMixRatio(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-teal-500"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>0% (Pure)</span>
                <span>100% (Heavy Mix)</span>
              </div>
              <p className="text-xs text-slate-400 mt-1.5">Tamil-English mixing level</p>
            </div>

            {/* Save Settings Button */}
            <button
              onClick={handleSaveSettings}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <Save className="w-4 h-4" /> Save Settings
            </button>
          </div>
        </div>
      </div>

      {/* Generate Speech Section */}
      <CollapsibleSection title="Generate Speech" badge="TTS">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Text Input</label>
            <textarea
              value={speechText}
              onChange={(e) => setSpeechText(e.target.value)}
              placeholder="Enter the text you want to convert to speech... Supports Tamil, English, and mixed text."
              rows={6}
              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
            <p className="text-xs text-slate-400 mt-1">{speechText.length} characters</p>
          </div>

          <div className="space-y-4">
            {/* Dialect Selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Dialect</label>
              <select
                value={speechDialect}
                onChange={(e) => setSpeechDialect(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              >
                {DIALECTS.map((d) => (
                  <option key={d} value={d}>{d} Tamil</option>
                ))}
              </select>
            </div>

            {/* Emotion Preset */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Emotion Preset</label>
              <select
                value={speechEmotion}
                onChange={(e) => setSpeechEmotion(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              >
                {EMOTIONS.map((emo) => (
                  <option key={emo.key} value={emo.key}>{emo.label}</option>
                ))}
              </select>
            </div>

            {/* GenZ Mode Checkbox */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <input
                type="checkbox"
                id="speech-genz"
                checked={speechGenZ}
                onChange={(e) => setSpeechGenZ(e.target.checked)}
                className="w-4 h-4 text-pink-600 border-slate-300 rounded focus:ring-pink-500"
              />
              <label htmlFor="speech-genz" className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-2">
                Enable GenZ mode
                {speechGenZ && <GenZBadge score={0.6} />}
              </label>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerateSpeech}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/25"
            >
              <Volume2 className="w-5 h-5" /> Generate Speech
            </button>
          </div>
        </div>
      </CollapsibleSection>

      {/* Train Custom Voice Section */}
      <CollapsibleSection title="Train Custom Voice" badge="Advanced">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upload Area */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Upload Training Audio</label>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                isDragOver
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <input
                type="file"
                accept="audio/*,.wav,.mp3"
                multiple
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <UploadCloud className={`w-10 h-10 mx-auto mb-3 ${isDragOver ? 'text-indigo-500' : 'text-slate-400'}`} />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {isDragOver ? 'Drop audio files here' : 'Drag & drop audio files here'}
              </p>
              <p className="text-xs text-slate-400 mt-1">or click to browse. Supports .wav, .mp3</p>
            </div>

            {/* Uploaded Files List */}
            {uploadedFiles.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {uploadedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <FileAudio className="w-4 h-4 text-indigo-500" />
                    <span className="text-sm text-slate-700 dark:text-slate-300 truncate flex-1">{file}</span>
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Training Settings */}
          <div className="space-y-4">
            {/* Dialect Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Dialect for Training Data</label>
              <select
                value={trainingDialect}
                onChange={(e) => setTrainingDialect(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              >
                {DIALECTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">Select the dialect that matches your training audio</p>
            </div>

            {/* Language Selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Language</label>
              <select
                value={trainingLanguage}
                onChange={(e) => setTrainingLanguage(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            {/* Training Info */}
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <h4 className="text-sm font-medium text-amber-800 dark:text-amber-400 mb-1">Training Requirements</h4>
              <ul className="text-xs text-amber-700 dark:text-amber-500 space-y-1">
                <li>- Minimum 30 minutes of clear audio</li>
                <li>- Single speaker per training set</li>
                <li>- Low background noise recommended</li>
                <li>- Training takes approximately 15-30 minutes</li>
              </ul>
            </div>

            {/* Start Training Button */}
            <button
              onClick={handleStartTraining}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-semibold hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/25"
            >
              <Brain className="w-5 h-5" /> Start Training
            </button>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
