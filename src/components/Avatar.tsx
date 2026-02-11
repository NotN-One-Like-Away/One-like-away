import type { AvatarConfig } from '../types';

interface AvatarProps {
  config: AvatarConfig;
  size?: number;
  outlineColor?: string;
}

export function Avatar({ config, size = 48, outlineColor }: AvatarProps) {
  const eyeDims = {
    round:  { rx: 5.5, ry: 6,   ir: 4,   pr: 2,   hl: 1.2 },
    almond: { rx: 7,   ry: 4.5, ir: 3.5, pr: 1.8, hl: 1.0 },
    wide:   { rx: 7,   ry: 7,   ir: 5,   pr: 2.2, hl: 1.3 },
    narrow: { rx: 6,   ry: 3,   ir: 2.5, pr: 1.5, hl: 0.8 },
  };

  const e = eyeDims[config.eye_style];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{
        borderRadius: '50%',
        border: outlineColor ? `3px solid ${outlineColor}` : undefined,
      }}
    >
      {/* Background */}
      <circle cx="50" cy="50" r="50" fill="#2d3748" />

      {/* Long hair back layer */}
      {config.hair_style === 'long' && (
        <path
          d="M16,48 C16,14 35,4 50,4 C65,4 84,14 84,48 L86,82 C84,86 80,78 78,72 L78,48 C78,32 66,24 50,24 C34,24 22,32 22,48 L22,72 C20,78 16,86 14,82 Z"
          fill={config.hair_color}
        />
      )}

      {/* Curly hair back puffs */}
      {config.hair_style === 'curly' && (
        <g fill={config.hair_color}>
          <circle cx="18" cy="46" r="12" />
          <circle cx="82" cy="46" r="12" />
        </g>
      )}

      {/* Ears */}
      <circle cx="18" cy="52" r="5" fill={config.skin_color} />
      <circle cx="82" cy="52" r="5" fill={config.skin_color} />

      {/* Face */}
      {config.face_shape === 'round' && (
        <circle cx="50" cy="52" r="32" fill={config.skin_color} />
      )}
      {config.face_shape === 'oval' && (
        <ellipse cx="50" cy="52" rx="27" ry="35" fill={config.skin_color} />
      )}
      {config.face_shape === 'square' && (
        <rect x="19" y="20" width="62" height="64" rx="14" fill={config.skin_color} />
      )}
      {config.face_shape === 'heart' && (
        <path
          d="M50,86 C32,84 18,66 18,48 C18,28 30,18 50,18 C70,18 82,28 82,48 C82,66 68,84 50,86"
          fill={config.skin_color}
        />
      )}

      {/* Blush */}
      <ellipse cx="30" cy="59" rx="6" ry="3" fill="#ff8888" opacity="0.2" />
      <ellipse cx="70" cy="59" rx="6" ry="3" fill="#ff8888" opacity="0.2" />

      {/* Nose */}
      <ellipse cx="50" cy="57" rx="2.5" ry="1.8" fill="#000" opacity="0.06" />

      {/* Left eye */}
      <ellipse cx="38" cy="47" rx={e.rx} ry={e.ry} fill="white" />
      <circle cx="38" cy="47.5" r={e.ir} fill={config.eye_color} />
      <circle cx="38" cy="47.5" r={e.pr} fill="#1a1a1a" />
      <circle cx="39.5" cy="46" r={e.hl} fill="white" />

      {/* Right eye */}
      <ellipse cx="62" cy="47" rx={e.rx} ry={e.ry} fill="white" />
      <circle cx="62" cy="47.5" r={e.ir} fill={config.eye_color} />
      <circle cx="62" cy="47.5" r={e.pr} fill="#1a1a1a" />
      <circle cx="63.5" cy="46" r={e.hl} fill="white" />

      {/* Eyebrows */}
      <path d="M30,39 Q38,35 44,39" stroke={config.hair_color} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M56,39 Q62,35 70,39" stroke={config.hair_color} strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* Mouth */}
      {config.mouth_style === 'smile' && (
        <path d="M40,64 Q50,72 60,64" stroke="#d4827a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      )}
      {config.mouth_style === 'neutral' && (
        <path d="M40,66 L60,66" stroke="#d4827a" strokeWidth="2" fill="none" strokeLinecap="round" />
      )}
      {config.mouth_style === 'grin' && (
        <>
          <path d="M36,63 Q50,76 64,63" stroke="#d4827a" strokeWidth="2" fill="white" strokeLinecap="round" />
          <line x1="38" y1="64.5" x2="62" y2="64.5" stroke="#d4827a" strokeWidth="0.8" />
        </>
      )}
      {config.mouth_style === 'small' && (
        <path d="M44,65 Q50,69 56,65" stroke="#d4827a" strokeWidth="2" fill="none" strokeLinecap="round" />
      )}

      {/* Hair front layer */}
      {(config.hair_style === 'short' || config.hair_style === 'long') && (
        <path
          d="M20,48 C20,22 35,10 50,10 C65,10 80,22 80,48 C78,40 65,34 50,34 C35,34 22,40 20,48"
          fill={config.hair_color}
        />
      )}
      {config.hair_style === 'curly' && (
        <g fill={config.hair_color}>
          <circle cx="28" cy="24" r="14" />
          <circle cx="50" cy="16" r="16" />
          <circle cx="72" cy="24" r="14" />
          <circle cx="20" cy="38" r="11" />
          <circle cx="80" cy="38" r="11" />
          <circle cx="40" cy="14" r="11" />
          <circle cx="60" cy="14" r="11" />
        </g>
      )}
      {config.hair_style === 'mohawk' && (
        <path
          d="M42,32 C42,10 46,2 50,2 C54,2 58,10 58,32 C56,28 44,28 42,32"
          fill={config.hair_color}
        />
      )}
      {config.hair_style === 'ponytail' && (
        <>
          <path
            d="M20,48 C20,22 35,10 50,10 C65,10 80,22 80,48 C78,40 65,34 50,34 C35,34 22,40 20,48"
            fill={config.hair_color}
          />
          <path d="M76,36 C90,40 92,58 82,68 C78,62 82,46 76,40 Z" fill={config.hair_color} />
          <circle cx="78" cy="38" r="3" fill="#ff6b8a" />
        </>
      )}

      {/* Accessories */}
      {config.accessory === 'glasses' && (
        <g stroke="#555" strokeWidth="2" fill="none">
          <circle cx="38" cy="47" r="10" />
          <circle cx="62" cy="47" r="10" />
          <line x1="48" y1="47" x2="52" y2="47" />
          <line x1="28" y1="47" x2="20" y2="44" />
          <line x1="72" y1="47" x2="80" y2="44" />
        </g>
      )}
      {config.accessory === 'sunglasses' && (
        <g>
          <rect x="26" y="41" width="20" height="13" rx="3" fill="#1a1a1a" opacity="0.85" />
          <rect x="54" y="41" width="20" height="13" rx="3" fill="#1a1a1a" opacity="0.85" />
          <line x1="46" y1="47" x2="54" y2="47" stroke="#444" strokeWidth="2" />
          <line x1="26" y1="47" x2="18" y2="44" stroke="#444" strokeWidth="2" />
          <line x1="74" y1="47" x2="82" y2="44" stroke="#444" strokeWidth="2" />
        </g>
      )}
      {config.accessory === 'earring' && (
        <circle cx="16" cy="58" r="3.5" fill="#ffd700" />
      )}
      {config.accessory === 'hat' && (
        <g>
          <ellipse cx="50" cy="20" rx="38" ry="8" fill="#444" />
          <rect x="28" y="4" width="44" height="18" rx="8" fill="#444" />
        </g>
      )}
    </svg>
  );
}
