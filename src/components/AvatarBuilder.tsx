import { useState } from 'react';
import type { AvatarConfig } from '../types';
import { Avatar } from './Avatar';
import { DEFAULT_AVATAR } from '../stores/userStore';

interface AvatarBuilderProps {
  onComplete: (config: AvatarConfig, name: string) => void;
}

// Human skin tones
const HUMAN_SKIN_COLORS = ['#f5d0c5', '#e8beac', '#d4a373', '#c68642', '#8d5524', '#5c3d2e'];
// Fantasy skin colors
const FANTASY_SKIN_COLORS = ['#7dd87d', '#87ceeb', '#dda0dd', '#ff6b6b', '#ffd700', '#40e0d0', '#ff69b4', '#9370db'];

// Natural + fantasy hair colors
const HAIR_COLORS = [
  '#2c1810', '#4a3728', '#8b4513', '#d4a574', '#e8e8e8', // Natural
  '#ff1493', '#00ff00', '#00bfff', '#ff4500', '#9400d3', '#ffd700', '#ff69b4', '#00ffff' // Fantasy
];

// Natural + fantasy eye colors
const EYE_COLORS = [
  '#4a3728', '#1e90ff', '#228b22', '#808080', '#8b4513', // Natural
  '#ff0000', '#ff00ff', '#ffff00', '#00ffff', '#ff1493' // Fantasy
];

export function AvatarBuilder({ onComplete }: AvatarBuilderProps) {
  const [config, setConfig] = useState<AvatarConfig>(DEFAULT_AVATAR);
  const [name, setName] = useState('');
  const [step, setStep] = useState(0);

  const updateConfig = <K extends keyof AvatarConfig>(key: K, value: AvatarConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const steps = [
    {
      title: 'Face Shape',
      content: (
        <div className="grid grid-cols-2 gap-3">
          {(['round', 'square', 'oval', 'heart'] as const).map((shape) => (
            <button
              key={shape}
              onClick={() => updateConfig('face_shape', shape)}
              className={`p-4 rounded-xl border-2 transition-all capitalize ${
                config.face_shape === shape
                  ? 'border-[var(--accent)] bg-[var(--accent)]/20'
                  : 'border-[var(--border)] hover:border-[var(--accent)]/50'
              }`}
            >
              {shape}
            </button>
          ))}
        </div>
      ),
    },
    {
      title: 'Skin Color',
      content: (
        <div className="space-y-3">
          <p className="text-xs text-[var(--text-secondary)] text-center">Human tones</p>
          <div className="flex flex-wrap gap-3 justify-center">
            {HUMAN_SKIN_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => updateConfig('skin_color', color)}
                className={`w-11 h-11 rounded-full border-4 transition-all ${
                  config.skin_color === color ? 'border-[var(--accent)] scale-110' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <p className="text-xs text-[var(--text-secondary)] text-center pt-2">Fantasy</p>
          <div className="flex flex-wrap gap-3 justify-center">
            {FANTASY_SKIN_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => updateConfig('skin_color', color)}
                className={`w-11 h-11 rounded-full border-4 transition-all ${
                  config.skin_color === color ? 'border-[var(--accent)] scale-110' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      ),
    },
    {
      title: 'Hair Style',
      content: (
        <div className="grid grid-cols-3 gap-2">
          {(['short', 'long', 'curly', 'bald', 'mohawk', 'ponytail'] as const).map((style) => (
            <button
              key={style}
              onClick={() => updateConfig('hair_style', style)}
              className={`p-3 rounded-xl border-2 transition-all capitalize text-sm ${
                config.hair_style === style
                  ? 'border-[var(--accent)] bg-[var(--accent)]/20'
                  : 'border-[var(--border)] hover:border-[var(--accent)]/50'
              }`}
            >
              {style}
            </button>
          ))}
        </div>
      ),
    },
    {
      title: 'Hair Color',
      content: (
        <div className="flex flex-wrap gap-3 justify-center">
          {HAIR_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => updateConfig('hair_color', color)}
              className={`w-10 h-10 rounded-full border-4 transition-all ${
                config.hair_color === color ? 'border-[var(--accent)] scale-110' : 'border-transparent hover:scale-105'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      ),
    },
    {
      title: 'Eyes',
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(['round', 'almond', 'wide', 'narrow'] as const).map((style) => (
              <button
                key={style}
                onClick={() => updateConfig('eye_style', style)}
                className={`p-3 rounded-xl border-2 transition-all capitalize ${
                  config.eye_style === style
                    ? 'border-[var(--accent)] bg-[var(--accent)]/20'
                    : 'border-[var(--border)] hover:border-[var(--accent)]/50'
                }`}
              >
                {style}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            {EYE_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => updateConfig('eye_color', color)}
                className={`w-8 h-8 rounded-full border-4 transition-all ${
                  config.eye_color === color ? 'border-[var(--accent)] scale-110' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      ),
    },
    {
      title: 'Mouth',
      content: (
        <div className="grid grid-cols-2 gap-3">
          {(['smile', 'neutral', 'grin', 'small'] as const).map((style) => (
            <button
              key={style}
              onClick={() => updateConfig('mouth_style', style)}
              className={`p-4 rounded-xl border-2 transition-all capitalize ${
                config.mouth_style === style
                  ? 'border-[var(--accent)] bg-[var(--accent)]/20'
                  : 'border-[var(--border)] hover:border-[var(--accent)]/50'
              }`}
            >
              {style}
            </button>
          ))}
        </div>
      ),
    },
    {
      title: 'Accessory',
      content: (
        <div className="grid grid-cols-2 gap-2">
          {(['none', 'glasses', 'sunglasses', 'earring', 'hat'] as const).map((acc) => (
            <button
              key={acc}
              onClick={() => updateConfig('accessory', acc)}
              className={`p-3 rounded-xl border-2 transition-all capitalize ${
                config.accessory === acc
                  ? 'border-[var(--accent)] bg-[var(--accent)]/20'
                  : 'border-[var(--border)] hover:border-[var(--accent)]/50'
              }`}
            >
              {acc}
            </button>
          ))}
        </div>
      ),
    },
    {
      title: 'Your Name',
      content: (
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter display name..."
          maxLength={20}
          className="w-full p-4 rounded-xl bg-[var(--bg-tertiary)] border-2 border-[var(--border)] focus:border-[var(--accent)] outline-none text-center text-lg"
        />
      ),
    },
  ];

  const isLastStep = step === steps.length - 1;
  const canProceed = !isLastStep || name.trim().length > 0;

  return (
    <div className="min-h-screen flex flex-col p-4 safe-top safe-bottom">
      <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
        <div className="mb-6">
          <Avatar config={config} size={120} />
        </div>

        <div className="w-full mb-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">{steps[step].title}</h2>
            <span className="text-[var(--text-secondary)] text-sm">
              {step + 1} / {steps.length}
            </span>
          </div>

          <div className="bg-[var(--bg-secondary)] rounded-2xl p-4">
            {steps[step].content}
          </div>
        </div>

        <div className="flex gap-3 w-full mt-6">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 py-3 rounded-xl border-2 border-[var(--border)] hover:border-[var(--accent)] transition-colors"
            >
              Back
            </button>
          )}
          <button
            onClick={() => {
              if (isLastStep && canProceed) {
                onComplete(config, name.trim());
              } else if (canProceed) {
                setStep(step + 1);
              }
            }}
            disabled={!canProceed}
            className={`flex-1 py-3 rounded-xl transition-colors ${
              canProceed
                ? 'bg-[var(--accent)] hover:bg-[var(--accent-hover)]'
                : 'bg-[var(--border)] cursor-not-allowed'
            }`}
          >
            {isLastStep ? 'Start' : 'Next'}
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex gap-2 mt-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
