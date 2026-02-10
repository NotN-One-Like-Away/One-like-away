import type { AvatarConfig } from '../types';

interface AvatarProps {
  config: AvatarConfig;
  size?: number;
  outlineColor?: string;
}

export function Avatar({ config, size = 48, outlineColor }: AvatarProps) {
  const faceShapes = {
    round: 'M50,10 C75,10 90,30 90,50 C90,75 75,90 50,90 C25,90 10,75 10,50 C10,30 25,10 50,10',
    square: 'M15,15 L85,15 L85,85 L15,85 Z',
    oval: 'M50,5 C80,5 90,35 90,50 C90,70 80,95 50,95 C20,95 10,70 10,50 C10,35 20,5 50,5',
    heart: 'M50,85 C20,60 10,40 25,25 C35,15 50,20 50,35 C50,20 65,15 75,25 C90,40 80,60 50,85',
  };

  const hairPaths = {
    short: 'M25,35 Q25,15 50,15 Q75,15 75,35 Q75,25 50,25 Q25,25 25,35',
    long: 'M20,35 Q20,10 50,10 Q80,10 80,35 L85,70 Q85,80 75,75 L75,40 Q75,30 50,30 Q25,30 25,40 L25,75 Q15,80 15,70 Z',
    curly: 'M20,40 Q15,20 35,15 Q30,10 50,10 Q70,10 65,15 Q85,20 80,40 Q90,35 85,50 Q80,35 75,40 Q85,30 70,25 Q80,20 50,20 Q20,20 30,25 Q15,30 25,40 Q20,35 10,50 Q15,35 20,40',
    bald: '',
    mohawk: 'M45,5 L55,5 L55,35 Q50,30 45,35 Z',
    ponytail: 'M25,35 Q25,15 50,15 Q75,15 75,35 Q75,25 50,25 Q25,25 25,35 M70,25 Q85,30 80,55 Q75,65 70,60 Q75,50 70,35',
  };

  const eyeShapes = {
    round: { rx: 5, ry: 5 },
    almond: { rx: 6, ry: 4 },
    wide: { rx: 7, ry: 5 },
    narrow: { rx: 5, ry: 3 },
  };

  const mouthPaths = {
    smile: 'M35,65 Q50,75 65,65',
    neutral: 'M35,65 L65,65',
    grin: 'M30,62 Q50,80 70,62 Q50,70 30,62',
    small: 'M42,65 Q50,70 58,65',
  };

  const accessoryElements = {
    none: null,
    glasses: (
      <g stroke="#333" strokeWidth="2" fill="none">
        <circle cx="35" cy="48" r="10" />
        <circle cx="65" cy="48" r="10" />
        <line x1="45" y1="48" x2="55" y2="48" />
        <line x1="25" y1="48" x2="20" y2="45" />
        <line x1="75" y1="48" x2="80" y2="45" />
      </g>
    ),
    sunglasses: (
      <g>
        <rect x="25" y="42" width="20" height="14" rx="2" fill="#1a1a1a" />
        <rect x="55" y="42" width="20" height="14" rx="2" fill="#1a1a1a" />
        <line x1="45" y1="48" x2="55" y2="48" stroke="#333" strokeWidth="2" />
        <line x1="25" y1="48" x2="18" y2="45" stroke="#333" strokeWidth="2" />
        <line x1="75" y1="48" x2="82" y2="45" stroke="#333" strokeWidth="2" />
      </g>
    ),
    earring: (
      <circle cx="15" cy="55" r="4" fill="#ffd700" />
    ),
    hat: (
      <g>
        <ellipse cx="50" cy="18" rx="35" ry="8" fill="#333" />
        <rect x="30" y="5" width="40" height="15" rx="5" fill="#333" />
      </g>
    ),
  };

  const { rx, ry } = eyeShapes[config.eye_style];

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
      <rect width="100" height="100" fill="#2a2a2a" rx="50" />

      {/* Hair behind face */}
      {config.hair_style === 'long' && (
        <path d={hairPaths.long} fill={config.hair_color} />
      )}

      {/* Face */}
      <path d={faceShapes[config.face_shape]} fill={config.skin_color} />

      {/* Hair */}
      {config.hair_style !== 'long' && (
        <path d={hairPaths[config.hair_style]} fill={config.hair_color} />
      )}

      {/* Eyes */}
      <ellipse cx="35" cy="48" rx={rx} ry={ry} fill="white" />
      <ellipse cx="65" cy="48" rx={rx} ry={ry} fill="white" />
      <circle cx="35" cy="48" r="3" fill={config.eye_color} />
      <circle cx="65" cy="48" r="3" fill={config.eye_color} />
      <circle cx="36" cy="47" r="1" fill="white" />
      <circle cx="66" cy="47" r="1" fill="white" />

      {/* Mouth */}
      <path
        d={mouthPaths[config.mouth_style]}
        stroke="#c0846d"
        strokeWidth="2"
        fill={config.mouth_style === 'grin' ? '#fff' : 'none'}
        strokeLinecap="round"
      />

      {/* Accessory */}
      {accessoryElements[config.accessory]}
    </svg>
  );
}
