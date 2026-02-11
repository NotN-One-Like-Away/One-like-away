import { useState } from 'react';
import type { AvatarConfig } from '../types';
import { Avatar } from './Avatar';
import { DEFAULT_AVATAR } from '../stores/userStore';

interface AvatarBuilderProps {
  onComplete: (config: AvatarConfig, name: string) => void;
}

const SKIN_COLORS = [
  '#f5d0c5', '#e8beac', '#d4a373', '#c68642', '#8d5524', '#5c3d2e',
  '#7dd87d', '#87ceeb', '#dda0dd', '#ff6b6b', '#ffd700', '#40e0d0', '#ff69b4', '#9370db',
];

const HAIR_COLORS = [
  '#2c1810', '#4a3728', '#8b4513', '#d4a574', '#e8e8e8',
  '#ff1493', '#00ff00', '#00bfff', '#ff4500', '#9400d3', '#ffd700', '#ff69b4', '#00ffff',
];

const EYE_COLORS = [
  '#4a3728', '#1e90ff', '#228b22', '#808080', '#8b4513',
  '#ff0000', '#ff00ff', '#ffff00', '#00ffff', '#ff1493',
];

const FACE_SHAPES: AvatarConfig['face_shape'][] = ['round', 'square', 'oval', 'heart'];
const HAIR_STYLES: AvatarConfig['hair_style'][] = ['short', 'long', 'curly', 'bald', 'mohawk', 'ponytail'];
const EYE_STYLES: AvatarConfig['eye_style'][] = ['round', 'almond', 'wide', 'narrow'];
const MOUTH_STYLES: AvatarConfig['mouth_style'][] = ['smile', 'neutral', 'grin', 'small'];
const ACCESSORIES: AvatarConfig['accessory'][] = ['none', 'glasses', 'sunglasses', 'earring', 'hat'];

export function AvatarBuilder({ onComplete }: AvatarBuilderProps) {
  const [config, setConfig] = useState<AvatarConfig>(DEFAULT_AVATAR);
  const [name, setName] = useState('');
  const [step, setStep] = useState(0);

  const update = <K extends keyof AvatarConfig>(key: K, value: AvatarConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  const randomize = () => {
    setConfig({
      face_shape: pick(FACE_SHAPES),
      skin_color: pick(SKIN_COLORS),
      hair_style: pick(HAIR_STYLES),
      hair_color: pick(HAIR_COLORS),
      eye_style: pick(EYE_STYLES),
      eye_color: pick(EYE_COLORS),
      mouth_style: pick(MOUTH_STYLES),
      accessory: pick(ACCESSORIES),
    });
  };

  const steps = [
    {
      title: 'Shape & Skin',
      content: (
        <>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {FACE_SHAPES.map(shape => (
              <button
                key={shape}
                onClick={() => update('face_shape', shape)}
                className={`p-2 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${
                  config.face_shape === shape
                    ? 'border-[var(--accent)] bg-[var(--accent)]/20'
                    : 'border-[var(--border)] hover:border-[var(--accent)]/50'
                }`}
              >
                <Avatar config={{ ...config, face_shape: shape }} size={44} />
                <span className="text-[10px] capitalize text-[var(--text-secondary)]">{shape}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2.5 justify-center">
            {SKIN_COLORS.map(color => (
              <button
                key={color}
                onClick={() => update('skin_color', color)}
                className={`w-9 h-9 rounded-full border-[3px] transition-all ${
                  config.skin_color === color ? 'border-[var(--accent)] scale-110' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </>
      ),
    },
    {
      title: 'Hair',
      content: (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {HAIR_STYLES.map(style => (
              <button
                key={style}
                onClick={() => update('hair_style', style)}
                className={`p-2 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${
                  config.hair_style === style
                    ? 'border-[var(--accent)] bg-[var(--accent)]/20'
                    : 'border-[var(--border)] hover:border-[var(--accent)]/50'
                }`}
              >
                <Avatar config={{ ...config, hair_style: style }} size={40} />
                <span className="text-[10px] capitalize text-[var(--text-secondary)]">{style}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2.5 justify-center">
            {HAIR_COLORS.map(color => (
              <button
                key={color}
                onClick={() => update('hair_color', color)}
                className={`w-9 h-9 rounded-full border-[3px] transition-all ${
                  config.hair_color === color ? 'border-[var(--accent)] scale-110' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </>
      ),
    },
    {
      title: 'Face',
      content: (
        <>
          <p className="text-xs text-[var(--text-secondary)] mb-2">Eyes</p>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {EYE_STYLES.map(style => (
              <button
                key={style}
                onClick={() => update('eye_style', style)}
                className={`p-2 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${
                  config.eye_style === style
                    ? 'border-[var(--accent)] bg-[var(--accent)]/20'
                    : 'border-[var(--border)] hover:border-[var(--accent)]/50'
                }`}
              >
                <Avatar config={{ ...config, eye_style: style }} size={36} />
                <span className="text-[10px] capitalize text-[var(--text-secondary)]">{style}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2.5 justify-center mb-4">
            {EYE_COLORS.map(color => (
              <button
                key={color}
                onClick={() => update('eye_color', color)}
                className={`w-8 h-8 rounded-full border-[3px] transition-all ${
                  config.eye_color === color ? 'border-[var(--accent)] scale-110' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <p className="text-xs text-[var(--text-secondary)] mb-2">Mouth</p>
          <div className="grid grid-cols-4 gap-2">
            {MOUTH_STYLES.map(style => (
              <button
                key={style}
                onClick={() => update('mouth_style', style)}
                className={`p-2 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${
                  config.mouth_style === style
                    ? 'border-[var(--accent)] bg-[var(--accent)]/20'
                    : 'border-[var(--border)] hover:border-[var(--accent)]/50'
                }`}
              >
                <Avatar config={{ ...config, mouth_style: style }} size={36} />
                <span className="text-[10px] capitalize text-[var(--text-secondary)]">{style}</span>
              </button>
            ))}
          </div>
        </>
      ),
    },
    {
      title: 'Finish Up',
      content: (
        <>
          <p className="text-xs text-[var(--text-secondary)] mb-2">Accessory</p>
          <div className="grid grid-cols-5 gap-2 mb-5">
            {ACCESSORIES.map(acc => (
              <button
                key={acc}
                onClick={() => update('accessory', acc)}
                className={`p-1.5 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${
                  config.accessory === acc
                    ? 'border-[var(--accent)] bg-[var(--accent)]/20'
                    : 'border-[var(--border)] hover:border-[var(--accent)]/50'
                }`}
              >
                <Avatar config={{ ...config, accessory: acc }} size={34} />
                <span className="text-[9px] capitalize text-[var(--text-secondary)]">{acc}</span>
              </button>
            ))}
          </div>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your display name..."
            maxLength={20}
            autoFocus
            className="w-full p-3 rounded-xl bg-[var(--bg-tertiary)] border-2 border-[var(--border)] focus:border-[var(--accent)] outline-none text-center text-lg"
          />
        </>
      ),
    },
  ];

  const isLastStep = step === steps.length - 1;
  const canProceed = !isLastStep || name.trim().length > 0;

  return (
    <div className="min-h-screen flex flex-col p-4 safe-top safe-bottom">
      <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
        {/* Big live preview + randomize */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <Avatar config={config} size={140} />
          <button
            onClick={randomize}
            className="px-4 py-1.5 rounded-lg text-sm border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
          >
            Randomize
          </button>
        </div>

        <div className="w-full mb-2">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-semibold">{steps[step].title}</h2>
            <span className="text-[var(--text-secondary)] text-sm">
              {step + 1} / {steps.length}
            </span>
          </div>

          <div className="bg-[var(--bg-secondary)] rounded-2xl p-4">
            {steps[step].content}
          </div>
        </div>

        <div className="flex gap-3 w-full mt-5">
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
            className={`flex-1 py-3 rounded-xl font-semibold transition-colors ${
              canProceed
                ? 'bg-[var(--accent)] hover:bg-[var(--accent-hover)]'
                : 'bg-[var(--border)] cursor-not-allowed'
            }`}
          >
            {isLastStep ? 'Start' : 'Next'}
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex gap-2 mt-5">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                i === step ? 'bg-[var(--accent)]' : i < step ? 'bg-[var(--accent)]/50' : 'bg-[var(--border)]'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
