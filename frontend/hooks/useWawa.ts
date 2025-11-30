"use client";

import { useEffect, useRef, useCallback } from 'react';

// Viseme mapping from ElevenLabs phonemes to VRM blend shapes
// Based on standard viseme set (A, I, U, E, O, etc.)
const VISEME_MAP: Record<string, { mouth: string; weight: number }[]> = {
  // Vowels
  'AA': [{ mouth: 'aa', weight: 1.0 }],      // "father"
  'AE': [{ mouth: 'aa', weight: 0.7 }],      // "cat"
  'AH': [{ mouth: 'aa', weight: 0.5 }],      // "but"
  'AO': [{ mouth: 'oh', weight: 1.0 }],      // "dog"
  'AW': [{ mouth: 'oh', weight: 0.8 }],      // "how"
  'AY': [{ mouth: 'aa', weight: 0.6 }],      // "hi"
  'EH': [{ mouth: 'ee', weight: 0.6 }],      // "bed"
  'ER': [{ mouth: 'ee', weight: 0.4 }],      // "bird"
  'EY': [{ mouth: 'ee', weight: 0.8 }],      // "say"
  'IH': [{ mouth: 'ih', weight: 0.7 }],      // "sit"
  'IY': [{ mouth: 'ee', weight: 1.0 }],      // "see"
  'OW': [{ mouth: 'oh', weight: 1.0 }],      // "go"
  'OY': [{ mouth: 'oh', weight: 0.7 }],      // "boy"
  'UH': [{ mouth: 'ou', weight: 0.6 }],      // "book"
  'UW': [{ mouth: 'ou', weight: 1.0 }],      // "food"

  // Consonants with mouth shapes
  'B': [{ mouth: 'aa', weight: 0.2 }],       // lips together
  'P': [{ mouth: 'aa', weight: 0.2 }],       // lips together
  'M': [{ mouth: 'aa', weight: 0.2 }],       // lips together
  'F': [{ mouth: 'ff', weight: 0.8 }],       // "f" sound
  'V': [{ mouth: 'ff', weight: 0.7 }],       // "v" sound
  'TH': [{ mouth: 'th', weight: 0.8 }],      // "th" sound
  'DH': [{ mouth: 'th', weight: 0.7 }],      // "the"
  'S': [{ mouth: 'ss', weight: 0.6 }],       // "s" sound
  'Z': [{ mouth: 'ss', weight: 0.5 }],       // "z" sound
  'SH': [{ mouth: 'ch', weight: 0.7 }],      // "sh" sound
  'CH': [{ mouth: 'ch', weight: 0.8 }],      // "ch" sound
  'JH': [{ mouth: 'ch', weight: 0.7 }],      // "j" sound
  'L': [{ mouth: 'dd', weight: 0.5 }],       // "l" sound
  'R': [{ mouth: 'rr', weight: 0.6 }],       // "r" sound
  'W': [{ mouth: 'ou', weight: 0.6 }],       // "w" sound

  // Silent/neutral
  'SIL': [{ mouth: 'neutral', weight: 0.0 }],
};

// Fallback VRM blend shape names to try
const MOUTH_BLEND_SHAPES = [
  // Standard VRM blend shapes
  'aa', 'ih', 'ou', 'ee', 'oh',
  // Alternative naming conventions
  'a', 'i', 'u', 'e', 'o',
  'A', 'I', 'U', 'E', 'O',
  // Additional common shapes
  'mouth_open', 'mouthOpen',
  'ff', 'th', 'ss', 'ch', 'dd', 'rr',
  'neutral', 'sil',
];

interface VisemeData {
  phoneme: string;
  start_time: number;
  end_time: number;
}

interface UseWawaProps {
  vrm?: any;
  audioElem?: HTMLAudioElement | null;
  visemeData?: VisemeData[];
}

interface UseWawaReturn {
  startLipSync: (visemes?: VisemeData[]) => void;
  stopLipSync: () => void;
  isPlaying: boolean;
}

export function useWawa({ vrm, audioElem, visemeData }: UseWawaProps): UseWawaReturn {
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const currentVisemesRef = useRef<VisemeData[]>([]);
  const availableBlendShapesRef = useRef<Set<string>>(new Set());
  const currentBlendShapeValues = useRef<Map<string, number>>(new Map());

  // Store vrm and audioElem as refs so we always have the latest values
  const vrmRef = useRef<any>(vrm);
  const audioElemRef = useRef<HTMLAudioElement | null>(audioElem);

  // Update refs when props change
  useEffect(() => {
    vrmRef.current = vrm;
  }, [vrm]);

  useEffect(() => {
    audioElemRef.current = audioElem;
  }, [audioElem]);

  // Discover available blend shapes from VRM model
  const discoverBlendShapes = useCallback((vrmModel: any) => {
    const available = new Set<string>();

    if (!vrmModel?.expressionManager) {
      console.warn('⚠️ No expressionManager found on VRM model');
      return available;
    }

    console.log('🔍 Discovering blend shapes...');
    console.log('Expression manager type:', typeof vrmModel.expressionManager);
    console.log('Expression manager methods:', Object.keys(vrmModel.expressionManager));

    MOUTH_BLEND_SHAPES.forEach(shapeName => {
      try {
        const expr = vrmModel.expressionManager.getExpression(shapeName);
        if (expr) {
          available.add(shapeName);
          console.log(`✅ Found blend shape: ${shapeName}`);
        }
      } catch (e) {
        // Shape doesn't exist
      }
    });

    const presets = ['neutral', 'aa', 'ih', 'ou', 'ee', 'oh', 'a', 'i', 'u', 'e', 'o'];
    presets.forEach(preset => {
      try {
        const expr = vrmModel.expressionManager.getExpression(preset);
        if (expr) {
          available.add(preset);
          console.log(`✅ Found preset: ${preset}`);
        }
      } catch (e) {
        // Try as custom expression
        try {
          if (vrmModel.expressionManager.getValue(preset) !== undefined) {
            available.add(preset);
            console.log(`✅ Found custom expression: ${preset}`);
          }
        } catch (e2) {
          // Doesn't exist
        }
      }
    });

    console.log(`👄 Lip sync ready - ${available.size} mouth shapes available:`, Array.from(available));
    return available;
  }, []);

  // Initialize blend shapes when VRM loads
  useEffect(() => {
    if (vrmRef.current) {
      availableBlendShapesRef.current = discoverBlendShapes(vrmRef.current);
    }
  }, [vrm, discoverBlendShapes]);

  // Apply viseme to VRM with smooth interpolation
  const applyViseme = useCallback((phoneme: string, intensity: number = 1.0) => {
    if (!vrmRef.current?.expressionManager) {
      console.warn('⚠️ No expression manager available for lip sync');
      return;
    }

    const visemeConfig = VISEME_MAP[phoneme] || VISEME_MAP['SIL'];
    const smoothingFactor = 0.3; // How much to interpolate (0 = instant, 1 = very smooth)

    // Smoothly interpolate all mouth shapes towards 0
    availableBlendShapesRef.current.forEach(shapeName => {
      try {
        const currentValue = currentBlendShapeValues.current.get(shapeName) || 0;
        const newValue = currentValue * (1 - smoothingFactor);
        currentBlendShapeValues.current.set(shapeName, newValue);
        vrmRef.current.expressionManager.setValue(shapeName, newValue);
      } catch (e) {
        // Ignore
      }
    });

    // Apply the target viseme(s) with smooth interpolation
    let applied = false;
    visemeConfig.forEach(({ mouth, weight }) => {
      const targetWeight = weight * intensity;

      // Try to find and apply the blend shape
      const tryApply = (name: string) => {
        if (availableBlendShapesRef.current.has(name)) {
          try {
            // Smoothly interpolate towards target value
            const currentValue = currentBlendShapeValues.current.get(name) || 0;
            const newValue = currentValue + (targetWeight - currentValue) * smoothingFactor;
            currentBlendShapeValues.current.set(name, newValue);

            // VRM expressionManager uses setValue for custom expressions
            vrmRef.current.expressionManager.setValue(name, newValue);
            console.log(`👄 Set ${name} = ${newValue.toFixed(2)} (target: ${targetWeight.toFixed(2)})`);
            applied = true;
            return true;
          } catch (e) {
            console.warn(`Failed to set ${name}:`, e);
            return false;
          }
        }
        return false;
      };

      // Try exact match first
      if (!tryApply(mouth)) {
        tryApply(mouth.toLowerCase());
        tryApply(mouth.toUpperCase());
        tryApply(mouth.charAt(0).toUpperCase() + mouth.slice(1).toLowerCase());
      }
    });

    // FALLBACK: If the specific mouth shape doesn't exist, use a similar vowel shape
    if (!applied && phoneme !== 'SIL') {
      console.log(`🔄 Phoneme ${phoneme} not found, trying fallback...`);

      // Fallback mapping to available shapes (aa, ih, ou, ee, oh)
      const fallbackMap: Record<string, string> = {
        // Consonants that need mouth open
        'B': 'aa', 'P': 'aa', 'M': 'aa',
        // F/V sounds (slight opening)
        'F': 'ee', 'V': 'ee',
        // Th sounds
        'TH': 'ee', 'DH': 'ee',
        // S/Z sounds
        'S': 'ih', 'Z': 'ih',
        // Ch/Sh sounds
        'SH': 'ih', 'CH': 'ih', 'JH': 'ih',
        // L/R sounds
        'L': 'ee', 'R': 'ou',
        // D/T sounds
        'DD': 'aa', 'D': 'aa', 'T': 'aa',
        // W sound
        'W': 'ou',
      };

      const fallback = fallbackMap[phoneme];
      if (fallback && availableBlendShapesRef.current.has(fallback)) {
        try {
          const targetWeight = intensity * 0.5; // Reduced intensity for fallback
          const currentValue = currentBlendShapeValues.current.get(fallback) || 0;
          const newValue = currentValue + (targetWeight - currentValue) * smoothingFactor;
          currentBlendShapeValues.current.set(fallback, newValue);

          vrmRef.current.expressionManager.setValue(fallback, newValue);
          console.log(`👄 Fallback: Set ${fallback} = ${newValue.toFixed(2)} for ${phoneme}`);
          applied = true;
        } catch (e) {
          console.warn(`Failed to set fallback ${fallback}:`, e);
        }
      }
    }

    if (!applied && phoneme !== 'SIL') {
      console.warn(`❌ Could not apply phoneme: ${phoneme}. Available shapes:`, Array.from(availableBlendShapesRef.current));
    }

    // Note: VRM.update() in the main animation loop handles expressionManager.update()
    // We don't need to call it here manually
  }, []);

  // Animation loop for viseme-based lip sync
  const updateLipSync = useCallback(() => {
    if (!isPlayingRef.current || !audioElemRef.current || !vrmRef.current) {
      console.log('❌ updateLipSync stopped:', {
        playing: isPlayingRef.current,
        hasAudio: !!audioElemRef.current,
        hasVrm: !!vrmRef.current
      });
      return;
    }

    // Use audio's currentTime instead of performance.now() for better sync
    const currentTime = audioElemRef.current.currentTime;
    const totalVisemes = currentVisemesRef.current.length;

    // Find current viseme based on audio playback time
    const currentViseme = currentVisemesRef.current.find(
      v => currentTime >= v.start_time && currentTime < v.end_time
    );

    console.log(`🔍 Frame - Time: ${currentTime.toFixed(3)}s, Total visemes: ${totalVisemes}, Found viseme:`, currentViseme?.phoneme || 'NONE');

    if (currentViseme) {
      const visemeDuration = currentViseme.end_time - currentViseme.start_time;
      const positionInViseme = (currentTime - currentViseme.start_time) / visemeDuration;

      let intensity = 1.0;
      if (positionInViseme < 0.1) {
        intensity = positionInViseme / 0.1;
      } else if (positionInViseme > 0.8) {
        intensity = (1.0 - positionInViseme) / 0.2;
      }

      console.log(`🎵 Applying phoneme: ${currentViseme.phoneme}, Intensity: ${intensity.toFixed(2)}`);
      applyViseme(currentViseme.phoneme, intensity);
    } else {
      console.log('🔇 No viseme found, applying SIL');
      applyViseme('SIL', 0);
    }

    // Continue animation if still playing
    if (!audioElemRef.current.paused && !audioElemRef.current.ended) {
      animationFrameRef.current = requestAnimationFrame(updateLipSync);
    } else {
      isPlayingRef.current = false;
      applyViseme('SIL', 0);
    }
  }, [applyViseme]);

  // Simple amplitude-based lip sync (no visemes needed)
  const updateAmplitudeLipSync = useCallback(() => {
    if (!isPlayingRef.current || !audioElemRef.current || !vrmRef.current) {
      return;
    }

    // Simple mouth open/close based on whether audio is playing
    // This is a fallback when we don't have viseme data
    const isAudioPlaying = !audioElemRef.current.paused && !audioElemRef.current.ended;

    if (isAudioPlaying) {
      // Randomly vary between 'aa' and 'oh' shapes for natural-looking speech
      const random = Math.random();
      const phoneme = random > 0.5 ? 'AA' : 'OH';
      const intensity = 0.3 + (Math.random() * 0.4); // Random intensity between 0.3-0.7
      applyViseme(phoneme, intensity);
    } else {
      applyViseme('SIL', 0);
    }

    // Continue animation if still playing
    if (!audioElemRef.current.paused && !audioElemRef.current.ended) {
      animationFrameRef.current = requestAnimationFrame(updateAmplitudeLipSync);
    } else {
      isPlayingRef.current = false;
      applyViseme('SIL', 0);
    }
  }, [applyViseme]);

  // Start lip sync with optional viseme data
  const startLipSync = useCallback((visemes?: VisemeData[]) => {
    console.log('🎤 startLipSync called');
    console.log('VRM:', !!vrmRef.current);
    console.log('Audio:', !!audioElemRef.current);
    console.log('Visemes provided:', visemes?.length || 0);

    if (!vrmRef.current || !audioElemRef.current) {
      console.warn('⚠️ Cannot start lip sync - VRM or audio missing');
      return;
    }

    const visemesToUse = visemes || currentVisemesRef.current;

    if (!visemesToUse || visemesToUse.length === 0) {
      console.warn('⚠️ No visemes available - using amplitude-based lip sync');
      isPlayingRef.current = true;
      updateAmplitudeLipSync();
      return;
    }

    console.log(`🎤 Lip sync started with ${visemesToUse.length} visemes`);
    console.log('First 5 visemes:', visemesToUse.slice(0, 5));

    currentVisemesRef.current = visemesToUse;
    startTimeRef.current = performance.now();
    isPlayingRef.current = true;

    updateLipSync();
  }, [updateLipSync, updateAmplitudeLipSync]);

  // Stop lip sync
  const stopLipSync = useCallback(() => {
    isPlayingRef.current = false;

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Reset mouth to neutral
    if (vrmRef.current) {
      applyViseme('SIL', 0);
    }

    // Clear stored blend shape values for clean restart
    currentBlendShapeValues.current.clear();
  }, [applyViseme]);

  // Handle audio events
  useEffect(() => {
    if (!audioElemRef.current) return;

    const handleEnded = () => {
      stopLipSync();
    };

    const audio = audioElemRef.current;
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      stopLipSync();
    };
  }, [audioElem, stopLipSync]);

  // Store viseme data when provided
  useEffect(() => {
    if (visemeData && visemeData.length > 0) {
      currentVisemesRef.current = visemeData;
    }
  }, [visemeData]);

  return {
    startLipSync,
    stopLipSync,
    isPlaying: isPlayingRef.current,
  };
}
