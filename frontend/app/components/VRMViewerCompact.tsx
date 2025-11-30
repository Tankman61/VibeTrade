"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { retargetAnimation } from 'vrm-mixamo-retarget';
import { useWawa } from '../../hooks/useWawa';

// ==================== CENTRALIZED CAMERA CONFIGURATION ====================
// This is the SINGLE SOURCE OF TRUTH for all camera positions
//
// HOW TO ADD NEW MODELS:
// 1. Add detection logic in getModelType() function
// 2. Add camera configs for both 'landing_modelname' and 'dashboard_modelname'
// 3. That's it! The system will automatically use your config
//
// CAMERA Y VALUES GUIDE:
// - Y = 0.5: Lower height, good for taller characters (horse girl)
// - Y = 1.0: Standard height, good for most characters
// - Y = 1.5: Higher height, good for shorter characters
//
// CAMERA Z VALUES GUIDE:
// - Landing page: Z = 0.4 (close-up for hero section)
// - Dashboard: Z = 1.3 (pulled back for sidebar view)
//
// ⚠️ CRITICAL RULE: Camera position.y and target.y MUST BE THE SAME!
// If they differ, the camera will tilt up/down instead of looking straight.
// Example: position.y = 0.8, target.y = 0.8 ✓ (looks straight)
//          position.y = 0.8, target.y = 0.5 ✗ (looks down)
// =========================================================================

interface CameraConfig {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  modelOffsetY?: number; // Optional Y offset for the model itself
}

// Model detection - ADD NEW MODEL TYPES HERE
function getModelType(modelPath: string): string {
  const path = modelPath.toLowerCase();

  // Add new model detections here
  if (path.includes('horse_girl')) return 'horse_girl';
  if (path.includes('twinkie')) return 'twinkie';
  if (path.includes('chaewon')) return 'chaewon';
  if (path.includes('rumi')) return 'rumi';
  if (path.includes('obama')) return 'obama';

  return 'default';
}

// Camera configurations for each unique combination of model + view mode
// ADD NEW MODEL CONFIGS HERE
const CAMERA_CONFIGS: Record<string, CameraConfig> = {
  // ===== HORSE GIRL =====
  'landing_horse_girl': {
    position: { x: 0.0, y: 1.1, z: 0.4 },  // Higher camera for landing page
    target: { x: 0, y: 1.1, z: 0 },        // Target MUST match camera Y to look straight
    modelOffsetY: -0.5                     // Offset model down so head is at camera level
  },
  'dashboard_horse_girl': {
    position: { x: 0.0, y: 0.5, z: 1.3 },  // Camera at head height
    target: { x: 0, y: 0.5, z: 0 },        // Target MUST match camera Y to look straight
    modelOffsetY: -0.5                     // Offset model down so head is at camera level
  },

  // ===== TWINKIE =====
  'landing_twinkie': {
    position: { x: 0.0, y: 0.5, z: 0.4 },  // Same camera height
    target: { x: 0, y: 0.5, z: 0 },        // Target MUST match camera Y to look straight
    modelOffsetY: -1.2                      // MUCH more offset for very tall twinkie
  },
  'dashboard_twinkie': {
    position: { x: 0.0, y: 0.3, z: 1.3 },  // Higher camera
    target: { x: 0, y: 0.3, z: 0 },        // Target MUST match camera Y to look straight
    modelOffsetY: -0.7                      // More offset with raised camera
  },

  // ===== CHAEWON =====
  'landing_chaewon': {
    position: { x: 0.0, y: 0.5, z: 0.4 },  // Same camera height as others
    target: { x: 0, y: 0.5, z: 0 },        // Target MUST match camera Y to look straight
    modelOffsetY: -0.3                      // Less offset for shorter chaewon
  },
  'dashboard_chaewon': {
    position: { x: 0.0, y: 0.3, z: 1.3 },  // Higher camera
    target: { x: 0, y: 0.3, z: 0 },        // Target MUST match camera Y to look straight
    modelOffsetY: -0.7                      // More offset with raised camera
    },

  // ===== DEFAULT (fallback for any model) =====
  'landing_default': {
    position: { x: 0.0, y: 1.0, z: 0.4 },  // Standard height
    target: { x: 0, y: 1.0, z: 0 }
  },
  'dashboard_default': {
    position: { x: 0.0, y: 1.0, z: 1.3 },  // Standard height
    target: { x: 0, y: 1.0, z: 0 }
  }

  // ===== ADD NEW MODELS HERE =====
  // Example for Rumi:
  // 'landing_rumi': {
  //   position: { x: 0.0, y: 1.2, z: 0.4 },
  //   target: { x: 0, y: 1.2, z: 0 }
  // },
  // 'dashboard_rumi': {
  //   position: { x: 0.0, y: 1.2, z: 1.3 },
  //   target: { x: 0, y: 1.2, z: 0 }
  // }
};

// Helper function to get camera config based on model and view mode
function getCameraConfig(
  modelPath: string,
  viewMode: 'landing' | 'dashboard',
  cameraOffset?: { x?: number; y?: number; z?: number },
  targetOffset?: { x?: number; y?: number; z?: number }
): CameraConfig {
  // Detect model type
  const modelType = getModelType(modelPath);

  // Build config key
  const configKey = `${viewMode}_${modelType}`;

  // Get base config (fallback to default if specific config doesn't exist)
  const baseConfig = CAMERA_CONFIGS[configKey] || CAMERA_CONFIGS[`${viewMode}_default`];

  // CRITICAL: Landing page NEVER uses offsets - they cause inconsistency
  // Dashboard can use offsets for per-character adjustments
  const shouldApplyOffsets = viewMode === 'dashboard';

  // VALIDATION: Warn if landing page receives offsets (should never happen)
  if (viewMode === 'landing' && (cameraOffset || targetOffset)) {
    console.error(`🚨 LANDING PAGE RECEIVED OFFSETS! This should NEVER happen!`, {
      cameraOffset,
      targetOffset,
      modelPath,
      configKey
    });
  }

  // Apply offsets if provided AND if we're in dashboard mode
  const config: CameraConfig = {
    position: {
      x: baseConfig.position.x + (shouldApplyOffsets && cameraOffset?.x ? cameraOffset.x : 0),
      y: baseConfig.position.y + (shouldApplyOffsets && cameraOffset?.y ? cameraOffset.y : 0),
      z: baseConfig.position.z + (shouldApplyOffsets && cameraOffset?.z ? cameraOffset.z : 0)
    },
    target: {
      x: baseConfig.target.x + (shouldApplyOffsets && targetOffset?.x ? targetOffset.x : 0),
      y: baseConfig.target.y + (shouldApplyOffsets && targetOffset?.y ? targetOffset.y : 0),
      z: baseConfig.target.z + (shouldApplyOffsets && targetOffset?.z ? targetOffset.z : 0)
    }
  };

  console.log(`📷 Camera Config [${configKey}]:`, {
    position: config.position,
    target: config.target,
    modelOffsetY: config.modelOffsetY ?? 0,
    baseConfig: baseConfig.position,
    offsets: shouldApplyOffsets ? { camera: cameraOffset, target: targetOffset } : 'IGNORED (landing page)',
    modelPath: modelPath.split('/').pop(),
    viewMode
  });

  return config;
}

// ==================== END CAMERA CONFIGURATION ====================

interface VRMViewerCompactProps {
  onSceneClick?: () => void;
  modelPath?: string;
  viewMode?: 'dashboard' | 'landing';
  cameraOffset?: { x?: number; y?: number; z?: number };
  targetOffset?: { x?: number; y?: number; z?: number };
  isGltf?: boolean;
  voiceAgentAudio?: HTMLAudioElement | null;
}

export default function VRMViewerCompact({ onSceneClick, modelPath = "/horse_girl.vrm", viewMode = 'dashboard', cameraOffset, targetOffset, isGltf = false, voiceAgentAudio }: VRMViewerCompactProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const vrmRef = useRef<any>(null);
  const mixerRef = useRef<THREE.AnimationMixer>();
  const cubeRef = useRef<THREE.Mesh>();
  const clockRef = useRef<THREE.Clock>();

  // Animation state management
  const animationChainTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentChainIndexRef = useRef<number>(0);
  const currentChainRef = useRef<Array<{ name: string; path: string; emoji: string }>>([]);
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const initializedRef = useRef<boolean>(false);
  const [currentCategory, setCurrentCategory] = useState<string | null>(null);
  const [testMode, setTestMode] = useState<'animation' | 'elevenlabs'>('elevenlabs'); // Default to ElevenLabs test mode
  const [ttsText, setTtsText] = useState<string>('Hello! This is a test of ElevenLabs text-to-speech with lip sync.');
  const [isPlayingTts, setIsPlayingTts] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [vrmLoaded, setVrmLoaded] = useState<any>(null); // State to trigger useWawa when VRM loads
  const [audioElem, setAudioElem] = useState<HTMLAudioElement | null>(null); // State to trigger useWawa when audio loads
  const [isFullyLoaded, setIsFullyLoaded] = useState<boolean>(false); // Hide until fully initialized

  // Blinking animation state
  const blinkStartTimeRef = useRef<number>(0);
  const isBlinkingRef = useRef<boolean>(false);

  // Animation monitoring for all characters
  const animationMonitorRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize lip sync hook with state-based VRM and audio to trigger discovery
  const lipSyncHook = useWawa({
    vrm: vrmLoaded,
    audioElem: audioElem,
  });

  // Sync voice agent audio with audioElem state for lip sync
  useEffect(() => {
    console.log('🔍 Voice agent audio effect triggered:', {
      hasAudio: !!voiceAgentAudio,
      paused: voiceAgentAudio?.paused,
      currentTime: voiceAgentAudio?.currentTime,
      duration: voiceAgentAudio?.duration
    });

    if (voiceAgentAudio) {
      console.log('🎤 Voice agent audio detected, updating audioElem for lip sync');
      setAudioElem(voiceAgentAudio);

      // Auto-start lip sync when audio starts playing (without visemes - will use amplitude-based)
      const handlePlay = () => {
        console.log('🎤 Voice agent audio started playing - starting lip sync');
        console.log('VRM loaded:', !!vrmLoaded);
        console.log('Audio element:', !!audioElem);
        lipSyncHook.startLipSync();
      };

      const handleEnded = () => {
        console.log('🎤 Voice agent audio ended');
        lipSyncHook.stopLipSync();
      };

      voiceAgentAudio.addEventListener('play', handlePlay);
      voiceAgentAudio.addEventListener('ended', handleEnded);

      // If audio is already playing, start immediately
      if (!voiceAgentAudio.paused) {
        console.log('🎤 Audio already playing, starting lip sync now');
        handlePlay();
      }

      return () => {
        voiceAgentAudio.removeEventListener('play', handlePlay);
        voiceAgentAudio.removeEventListener('ended', handleEnded);
      };
    }
  }, [voiceAgentAudio, lipSyncHook, vrmLoaded, audioElem]);

  // Simplified mixer protection - only fix timeScale issues
  useEffect(() => {
    const protectMixer = () => {
      if (mixerRef.current) {
        // Only protect timeScale
        if (mixerRef.current.timeScale === 0 || mixerRef.current.timeScale < 0) {
          mixerRef.current.timeScale = 1.0;
        } else if (mixerRef.current.timeScale > 1.5) {
          mixerRef.current.timeScale = 1.0;
        }
      }
      requestAnimationFrame(protectMixer);
    };

    protectMixer();
  }, []);

  // Create a simple idle animation - GUARANTEED to work even without humanoid
  const createIdleAnimation = useCallback(() => {
    if (!mixerRef.current || !vrmRef.current) {
      return null;
    }

    try {
      // Try humanoid-based animation first
      if (vrmRef.current.humanoid) {
        const humanoid = vrmRef.current.humanoid;
        const spine = humanoid.getNormalizedBoneNode('spine');
        const hips = humanoid.getNormalizedBoneNode('hips');

        if (spine && hips) {
          // Simple breathing motion using spine rotation
          const spineTrack = new THREE.QuaternionKeyframeTrack(
            `${spine.name}.quaternion`,
            [0, 1, 2],
            [
              0, 0, 0, 1,              // Frame 0: neutral
              -0.02, 0, 0, 0.9998,     // Frame 1: slight forward bend
              0, 0, 0, 1               // Frame 2: back to neutral
            ]
          );

          const hipsTrack = new THREE.VectorKeyframeTrack(
            `${hips.name}.position`,
            [0, 1, 2],
            [
              0, 0, 0,       // Frame 0
              0, 0.01, 0,    // Frame 1: slight up
              0, 0, 0        // Frame 2: back
            ]
          );

          const idleClip = new THREE.AnimationClip('idle', 2, [spineTrack, hipsTrack]);
          const action = mixerRef.current.clipAction(idleClip);

          action.setLoop(THREE.LoopRepeat, Infinity);
          action.enabled = true;
          action.paused = false;
          action.setEffectiveTimeScale(1.0);
          action.setEffectiveWeight(1.0);

          return action;
        }
      }

      // FALLBACK: Create a simple animation that moves the entire model slightly
      // This ensures SOMETHING is animating to prevent T-pose
      const scene = vrmRef.current.scene;

      // Create an animation that rotates the root slightly
      const fallbackClip = new THREE.AnimationClip('fallback_idle', 4, [
        new THREE.VectorKeyframeTrack(
          `${scene.name}.position`,
          [0, 2, 4],
          [
            0, 0, 0,       // Frame 0
            0, 0.01, 0,    // Frame 2: slight up
            0, 0, 0        // Frame 4: back
          ]
        ),
        new THREE.QuaternionKeyframeTrack(
          `${scene.name}.quaternion`,
          [0, 2, 4],
          [
            0, 0, 0, 1,    // Frame 0: neutral
            0, 0, 0, 1,    // Frame 2: neutral (keep rotation stable)
            0, 0, 0, 1     // Frame 4: neutral
          ]
        )
      ]);

      const action = mixerRef.current.clipAction(fallbackClip, scene);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.enabled = true;
      action.paused = false;
      action.setEffectiveTimeScale(1.0);
      action.setEffectiveWeight(1.0);

      console.log('✅ Using fallback idle animation (no humanoid)');
      return action;
    } catch (error) {
      console.error('Failed to create idle animation:', error);
      return null;
    }
  }, []);

  // FORCE ANIMATION ALWAYS - EXTREME MODE
  const breathingActionRef = useRef<THREE.AnimationAction | null>(null);

  // Start idle animation immediately when VRM and mixer are ready
  // BUT SKIP THIS FOR LANDING PAGE (it has its own hip hop animation)
  useEffect(() => {
    // CRITICAL: Skip idle animation auto-start for landing page
    if (viewMode === 'landing') {
      console.log('🚫 LANDING PAGE: Skipping auto-idle animation');
      return;
    }

    const tryStartIdle = () => {
      if (mixerRef.current && vrmRef.current && !breathingActionRef.current) {
        const idleAction = createIdleAnimation();
        if (idleAction) {
          breathingActionRef.current = idleAction;
          idleAction.reset();
          idleAction.play();
          currentActionRef.current = idleAction;
          console.log('✅ Auto-started idle animation (dashboard)');
        }
      }
    };

    tryStartIdle();
    const intervalId = setInterval(tryStartIdle, 100);
    return () => clearInterval(intervalId);
  }, [createIdleAnimation, viewMode]);

  // Load landing animation (hip hop dance) - NO IDLE FALLBACK
  const loadLandingAnimation = useCallback((vrm: any, mixer: THREE.AnimationMixer) => {
    console.log('🎬 LANDING: loadLandingAnimation called - loading hip_hop_dancing.fbx');
    try {
      const fbxLoader = new FBXLoader();

      fbxLoader.load(
        '/animations/landing/hip_hop_dancing.fbx',
        (fbx: any) => {
          console.log('✅ LANDING: hip_hop_dancing.fbx loaded successfully');
          try {
            // Suppress console warnings from retargeting library about missing bones
            const originalWarn = console.warn;
            console.warn = (...args: any[]) => {
              // Filter out retargeting warnings about missing bones (they're harmless)
              const message = args[0]?.toString() || '';
              if (!message.includes('VRM bone') && !message.includes('Mixamo bone') && !message.includes('humanoid')) {
                originalWarn.apply(console, args);
              }
            };

            const retargetedClip = retargetAnimation(fbx, vrm);

            // Restore console.warn
            console.warn = originalWarn;

            if (retargetedClip) {
              console.log('✅ LANDING: Hip hop animation retargeted successfully');

              // CRITICAL: Stop ALL existing animations (especially any idle animations)
              mixer.stopAllAction();
              if (currentActionRef.current) {
                currentActionRef.current.stop();
                currentActionRef.current = null;
              }
              if (breathingActionRef.current) {
                breathingActionRef.current.stop();
                breathingActionRef.current = null;
              }

              console.log('🛑 LANDING: All previous animations stopped');

              // Create and play ONLY hip hop animation
              const action = mixer.clipAction(retargetedClip);
              action.setLoop(THREE.LoopRepeat, Infinity);
              action.reset();
              action.play();
              action.setEffectiveWeight(1.0);
              action.enabled = true;
              currentActionRef.current = action;

              // Force mixer to apply animation immediately
              mixer.update(0.016);

              console.log(`✅ LANDING: Hip hop animation is now playing (${retargetedClip.name})`);

              // CRITICAL: Mark as fully loaded NOW that animation is playing
              setTimeout(() => {
                setIsFullyLoaded(true);
                console.log('✅ LANDING: Model with animation now visible');
              }, 100);
            } else {
              console.error('❌ LANDING: Failed to retarget hip hop animation - NO IDLE FALLBACK, model will stay still');
              setIsFullyLoaded(true);  // Show anyway even if animation failed
            }
          } catch (error) {
            console.error('❌ LANDING: Error processing hip hop animation - NO IDLE FALLBACK:', error);
            setIsFullyLoaded(true);  // Show anyway even if animation failed
          }
        },
        (progress: any) => {
          // Silently track progress
        },
        (error: any) => {
          console.error('❌ LANDING: Error loading hip_hop_dancing.fbx - NO IDLE FALLBACK:', error);
          setIsFullyLoaded(true);  // Show anyway even if FBX loading failed
        }
      );
    } catch (error) {
      console.error('❌ LANDING: Error in loadLandingAnimation - NO IDLE FALLBACK:', error);
      setIsFullyLoaded(true);  // Show anyway even if exception
    }
  }, []);

  // Disabled - this was interfering with animations

  // CHARACTER RESET SYSTEM - COMPLETE RELOAD ON T-POSE DETECTION
  const resetCharacter = useCallback(() => {

    // CLEAR EVERYTHING
    if (mixerRef.current) {
      mixerRef.current.stopAllAction();
      mixerRef.current._actions = [];
    }
    currentActionRef.current = null;
    breathingActionRef.current = null;

    // CLEAR SCENE
    if (sceneRef.current && vrmRef.current) {
      sceneRef.current.remove(vrmRef.current.scene);
    }
    vrmRef.current = null;

    // FORCE GARBAGE COLLECTION
    if (typeof window !== 'undefined' && window.gc) {
      window.gc();
    }

    // RELOAD CHARACTER AFTER SHORT DELAY
    setTimeout(() => {

      // Re-trigger VRM loading by changing the key (this will cause re-mount)
      const container = containerRef.current;
      if (container) {
        // Clear container completely
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }

        // Force re-initialization by setting a new key
        setForceReload(prev => prev + 1);
      }
    }, 100);
  }, []);

  // Disabled - this was interfering with animations

  // FORCE STATE TO TRIGGER RELOAD
  const [forceReload, setForceReload] = useState(0);

  // Blinking function using sine wave
  const updateBlinking = useCallback(() => {
    if (!vrmRef.current || viewMode !== 'landing') return;

    const now = Date.now();
    const timeSinceBlinkStart = now - blinkStartTimeRef.current;

    // Blink every 2-4 seconds randomly
    if (!isBlinkingRef.current && Math.random() < 0.008) {
      isBlinkingRef.current = true;
      blinkStartTimeRef.current = now;
    }

    if (isBlinkingRef.current) {
      // Blink duration: 200ms
      const blinkDuration = 200;
      const progress = Math.min(timeSinceBlinkStart / blinkDuration, 1);

      // Sine wave for smooth blink
      const blinkValue = Math.sin(Math.PI * progress);

      // Apply blink to eye morph targets (common VRM blend shapes)
      const blinkTargets = ['Blink', 'Blink_L', 'Blink_R', 'EyeBlink', 'eyeBlink'];

      let foundTarget = false;
      blinkTargets.forEach(targetName => {
        if (vrmRef.current?.expressionManager) {
          try {
            // Check if the blend shape exists
            const preset = vrmRef.current.expressionManager.getPreset(targetName as any);
            if (preset) {
              vrmRef.current.expressionManager.setValue(targetName, blinkValue * 1.5);
              foundTarget = true;
            }
          } catch (e) {
            // Blend shape doesn't exist, skip
          }
        }
      });

      // End blink
      if (progress >= 1) {
        isBlinkingRef.current = false;
        // Reset to open eyes
        blinkTargets.forEach(targetName => {
          if (vrmRef.current?.expressionManager) {
            try {
              vrmRef.current.expressionManager.setValue(targetName, 0);
            } catch (e) {
              // Blend shape doesn't exist, skip
            }
          }
        });
      }
    }
  }, [viewMode]);

  // Animation categories
  const animationCategories = {
    idle: [
      { name: "Happy Idle", path: "/animations/idle/Happy Idle.fbx", emoji: "😊" },
      { name: "Old Man Idle", path: "/animations/idle/Old Man Idle.fbx", emoji: "👴" },
      { name: "Nervously Look Around", path: "/animations/idle/Nervously Look Around.fbx", emoji: "👀" },
      { name: "Warrior Idle", path: "/animations/idle/Warrior Idle.fbx", emoji: "⚔️" },
    ],
    regularIdleAdult: [
      { name: "Idle", path: "/animations/regular idle adult/Idle.fbx", emoji: "🧍" },
      { name: "Zombie Idle", path: "/animations/regular idle adult/Zombie Idle.fbx", emoji: "🧟" },
    ],
    happy: [
      { name: "Joyful Jump", path: "/animations/excited/Joyful Jump.fbx", emoji: "🦘" },
      { name: "Standing Clap", path: "/animations/excited/Standing Clap.fbx", emoji: "👏" },
      { name: "Victory Idle", path: "/animations/excited/Victory Idle.fbx", emoji: "✌️" },
    ],
    excited: [
      { name: "Joyful Jump", path: "/animations/excited/Joyful Jump.fbx", emoji: "🦘" },
    ],
    dance: [
      { name: "Hip Hop Dancing", path: "/animations/dance/Hip Hop Dancing.fbx", emoji: "💃" },
    ],
    angry: [
      { name: "Angry", path: "/animations/angry/Angry.fbx", emoji: "😠" },
    ],
    sad: [
      { name: "Sad Idle", path: "/animations/sad/Sad Idle.fbx", emoji: "😢" },
    ]
  };

  // Helper function to get appropriate idle animations based on model
  const getIdleAnimations = () => {
    // GLTF models don't support retargeted animations
    if (isGltf) {
      return [];
    }

    const isHorseGirl = modelPath.includes('horse_girl');
    if (isHorseGirl) {
      // Horse girl uses original idle animation chain, but add fallback
      const horseAnimations = animationCategories.idle;
      const fallbackAnimations = animationCategories.regularIdleAdult;

      // Try horse animations first, then fallback to regular if they fail
      return [...horseAnimations, ...fallbackAnimations];
    } else {
      // All other VRM models use regular idle adult animations, with extra fallbacks
      const regularAnimations = animationCategories.regularIdleAdult;
      // Add some variety by including a couple more animation types as backup
      const backupAnimations = [
        animationCategories.happy[0], // Joyful Jump
        animationCategories.excited[0] // Victory Idle
      ].filter(Boolean);

      return [...regularAnimations, ...backupAnimations];
    }
  };

  // Callable animation state functions - exposed via ref
  const animationStateRef = useRef<{
    playIdle: () => void;
    playHappy: () => void;
    playAngry: () => void;
    playExcited: () => void;
    playDance: () => void;
    playSad: () => void;
  } | null>(null);

  // Set up callable functions - these can be called from outside the component
  useEffect(() => {
    animationStateRef.current = {
      playIdle: () => {
        setCurrentCategory(null); // Reset to default idle cycling
      },
      playHappy: () => {
        setCurrentCategory('happy');
      },
      playAngry: () => {
        setCurrentCategory('angry');
      },
      playExcited: () => {
        setCurrentCategory('excited');
      },
      playDance: () => {
        setCurrentCategory('dance');
      },
      playSad: () => {
        setCurrentCategory('sad');
      },
    };
  }, []);

  // Expose animation state functions globally for external calls
  useEffect(() => {
    if (typeof window !== 'undefined' && animationStateRef.current) {
      (window as any).vrmAnimationState = animationStateRef.current;
    }
  }, []);

  // Animation chaining system - plays animations in sequence with smooth crossfades
  const playAnimationChain = (animations: Array<{ name: string; path: string; emoji: string }>) => {
    if (!vrmRef.current || !mixerRef.current || animations.length === 0) {

      return;
    }

    // Clear any existing chain
    if (animationChainTimeoutRef.current) {
      clearTimeout(animationChainTimeoutRef.current);
      animationChainTimeoutRef.current = null;
    }

    // Stop any current actions
    if (mixerRef.current) {
      mixerRef.current.stopAllAction();
    }
    currentActionRef.current = null;

    currentChainRef.current = animations;
    currentChainIndexRef.current = 0;

    const playNextInChain = () => {
      if (!vrmRef.current || !mixerRef.current || currentChainRef.current.length === 0) return;

      const animation = currentChainRef.current[currentChainIndexRef.current % currentChainRef.current.length];
      currentChainIndexRef.current++;

      const loader = new FBXLoader();
      loader.load(
        animation.path,
        (fbx: any) => {
          const vrm = vrmRef.current;
          const mixer = mixerRef.current;
          if (!vrm || !mixer) {
            return;
          }

          let clipToPlay: THREE.AnimationClip | null = null;

          try {
            // Suppress console warnings from retargeting library about missing bones
            const originalWarn = console.warn;
            console.warn = (...args: any[]) => {
              // Filter out retargeting warnings about missing bones (they're harmless)
              const message = args[0]?.toString() || '';
              if (!message.includes('VRM bone') && !message.includes('Mixamo bone') && !message.includes('humanoid')) {
                originalWarn.apply(console, args);
              }
            };

            const retargetedClip = retargetAnimation(fbx, vrm);

            // Restore console.warn
            console.warn = originalWarn;

            if (retargetedClip) {
              clipToPlay = retargetedClip;
            }
          } catch (error) {
            // Restore console.warn in case of error
            console.warn = console.warn || (() => {});
            // Fallback to original
          }

          if (!clipToPlay && fbx.animations && fbx.animations.length > 0) {
            clipToPlay = fbx.animations[0];
          }

            if (clipToPlay) {
              // Create action on the VRM scene explicitly
              const newAction = mixer.clipAction(clipToPlay, vrm.scene);

            // Smooth crossfade: fade out old, fade in new
            if (currentActionRef.current) {
              // Fade out current action over 1 second
              currentActionRef.current.fadeOut(1.0);
            }

            // Set up new action - ensure it plays immediately
            newAction.reset();
            newAction.setLoop(THREE.LoopRepeat, Infinity);
            newAction.enabled = true;
            newAction.setEffectiveTimeScale(1.0);
            newAction.setEffectiveWeight(1.0);

            // FORCE PLAYBACK - multiple attempts
            newAction.play();
            newAction.setEffectiveWeight(1.0);

            // Force mixer update multiple times to ensure action is activated
            mixer.update(0);
            mixer.update(0.016);
            mixer.update(0.016);

            // Update current action reference
            currentActionRef.current = newAction;

            // Schedule next animation in chain
            // Wait for fade-in to complete (1s) + play duration + fade-out start (1s before end)
            const animationDuration = clipToPlay.duration || 3;
            const playDuration = Math.max(animationDuration * 2, 6); // Play for 2x duration or at least 6 seconds
            const chainDelay = (playDuration - 1.0) * 1000; // Start fade-out 1 second before switching

            animationChainTimeoutRef.current = setTimeout(() => {
              playNextInChain(); // Chain to next animation
            }, chainDelay);
          }
        },
        undefined,
        (error: any) => {
          console.error('❌ Animation load failed:', animation.name, error);

          if (!currentChainRef.current) return;

          // Check if we've tried all animations in the current chain
          const currentIndex = currentChainIndexRef.current % currentChainRef.current.length;
          const attemptedAnimations = Math.floor(currentChainIndexRef.current / currentChainRef.current.length) + 1;

          // If we've tried all animations at least once, switch to idle immediately
          if (attemptedAnimations >= 1 && currentIndex === currentChainRef.current.length - 1) {
            const idleAction = createIdleAnimation();
            if (idleAction) {
              mixerRef.current?.stopAllAction();
              idleAction.reset();
              idleAction.play();
              currentActionRef.current = idleAction;
              return; // Stop the chain
            }
          }

          // Try next animation immediately
          animationChainTimeoutRef.current = setTimeout(() => {
            playNextInChain();
          }, 10); // Ultra-fast fallback
        }
      );
    };

    // Start the chain
    playNextInChain();
  };

  useEffect(() => {
    // Create unique instance ID to prevent cross-contamination
    const instanceId = `vrm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`🔄 VRMViewerCompact effect triggered [${instanceId}] - viewMode:`, viewMode, 'modelPath:', modelPath);

    // CRITICAL: Validate props - landing should NEVER have offsets
    if (viewMode === 'landing') {
      if (cameraOffset || targetOffset) {
        console.error(`🚨🚨🚨 CRITICAL ERROR: Landing page has offsets!`, {
          cameraOffset,
          targetOffset
        });
        throw new Error('Landing page should never receive camera/target offsets');
      }
    }

    // COMPLETE RESET on mount or viewMode change
    initializedRef.current = false;

    // Dispose of camera from previous view
    if (cameraRef.current) {
      console.log('🗑️ Clearing previous camera');
      cameraRef.current = null as any;
    }
    if (rendererRef.current) {
      console.log('🗑️ Disposing previous renderer');
      rendererRef.current.dispose();
      rendererRef.current = null as any;
    }
    if (sceneRef.current) {
      console.log('🗑️ Clearing previous scene');
      sceneRef.current = null as any;
    }

    // Clear all animation state
    if (animationChainTimeoutRef.current) {
      clearTimeout(animationChainTimeoutRef.current);
      animationChainTimeoutRef.current = null;
    }
    if (mixerRef.current) {
      mixerRef.current.stopAllAction();
    }
    currentActionRef.current = null;
    breathingActionRef.current = null;
    currentChainRef.current = [];
    currentChainIndexRef.current = 0;
    setCurrentCategory(null);

    // Clear VRM reference to force reload
    vrmRef.current = null;
    setVrmLoaded(null);
    setIsFullyLoaded(false); // Reset loading state

    // Clear any existing DOM content
    if (containerRef.current) {
      while (containerRef.current.firstChild) {
        containerRef.current.removeChild(containerRef.current.firstChild);
      }
    }

    console.log('✨ Complete cleanup done, ready for fresh initialization');

    // Prevent duplicate initialization within this component instance
    // BUT allow re-initialization after proper cleanup (when initializedRef is reset to false)
    if (initializedRef.current) {
      console.warn('⚠️ Already initialized, skipping');
      return;
    }

    console.log('✅ Starting initialization');


    let mounted = true;
    let renderer: THREE.WebGLRenderer;
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let rafId: number | null = null;
    const clock = new THREE.Clock();

    async function init() {
      const container = containerRef.current;
      if (!container) return;

      // Clear any existing content from container before initializing
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }

      initializedRef.current = true;

    // Track the model that was loaded
    if (containerRef.current) {
      (containerRef.current as any).dataset.lastModel = modelPath;
    }

    // Add a fallback animation starter that triggers after VRM loads
    // BUT SKIP FOR LANDING PAGE
    const fallbackAnimationStarter = () => {
      // CRITICAL: Don't start idle animations on landing page
      if (viewMode === 'landing') {
        console.log('🚫 LANDING: Skipping fallback idle animations');
        return;
      }

      if (vrmRef.current && mixerRef.current && currentChainRef.current.length === 0) {
        console.log('🎬 DASHBOARD: Fallback - starting idle animations as backup');
        playAnimationChain(getIdleAnimations());
      }
    };

    // Set up the fallback to trigger after a delay (only for dashboard)
    if (viewMode !== 'landing') {
      fallbackTimeoutRef.current = setTimeout(fallbackAnimationStarter, 1000);
    }

      scene = new THREE.Scene();
      scene.background = null; // Transparent background
      sceneRef.current = scene; // Store in ref

      // Get camera configuration from centralized config
      // CRITICAL: Landing page NEVER uses offsets from dashboard
      const actualCameraOffset = viewMode === 'landing' ? undefined : cameraOffset;
      const actualTargetOffset = viewMode === 'landing' ? undefined : targetOffset;
      const cameraConfig = getCameraConfig(modelPath, viewMode, actualCameraOffset, actualTargetOffset);

      console.log(`🎯 Initializing VRMViewerCompact:`, {
        viewMode,
        modelPath: modelPath.split('/').pop(),
        hasOffsets: !!(actualCameraOffset || actualTargetOffset),
        cameraConfig
      });

      // Different setup based on view mode
      if (viewMode === 'landing') {
        // CRITICAL: Reset scroll progress IMMEDIATELY for THIS instance
        if (typeof window !== 'undefined') {
          (window as any)[`landingCameraProgress_${instanceId}`] = 0;
          (window as any).landingCameraProgress = 0; // Also reset global for compatibility
          (window as any)._currentLandingInstance = instanceId; // Track current instance
          console.log(`🔄 VRMViewerCompact [${instanceId}] - RESET landingCameraProgress to 0`);
        }

        // Get container dimensions for proper sizing
        const containerWidth = container.clientWidth || window.innerWidth;
        const containerHeight = container.clientHeight || window.innerHeight;

        camera = new THREE.PerspectiveCamera(
          45,
          containerWidth / containerHeight,
          0.1,
          1000
        );
        cameraRef.current = camera; // Store in ref

        // Apply centralized camera position - SINGLE SOURCE OF TRUTH
        camera.position.set(
          cameraConfig.position.x,
          cameraConfig.position.y,
          cameraConfig.position.z
        );

        // CRITICAL: Set camera rotation to look straight ahead (0, 0, -1 direction)
        // Do NOT use lookAt() - just set rotation to zero (looking down -Z axis)
        camera.rotation.set(0, 0, 0);

        console.log(`📷 LANDING CAMERA INITIALIZED:`, {
          position: { x: cameraConfig.position.x, y: cameraConfig.position.y, z: cameraConfig.position.z },
          rotation: { x: 0, y: 0, z: 0 },
          scrollProgress: (window as any).landingCameraProgress
        });

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        rendererRef.current = renderer; // Store in ref
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(containerWidth, containerHeight);
        renderer.domElement.style.background = 'transparent';
        renderer.domElement.style.border = 'none';
        renderer.domElement.style.margin = '0';
        renderer.domElement.style.padding = '0';
        container.appendChild(renderer.domElement);

        // Use horse girl as default for landing page if no specific model provided
        if (viewMode === 'landing' && !modelPath) {
            modelPath = "/horse_girl.vrm";
        }
      } else {
        // Dashboard setup - now expanded to fill available space
        if (container.clientWidth === 0 || container.clientHeight === 0) {
          container.style.width = '100%';
          container.style.height = '100%';
        }

        camera = new THREE.PerspectiveCamera(
          45,
          container.clientWidth / container.clientHeight || 1,
          0.1,
          1000
        );
        cameraRef.current = camera; // Store in ref

        // Apply centralized camera position - SINGLE SOURCE OF TRUTH
        camera.position.set(
          cameraConfig.position.x,
          cameraConfig.position.y,
          cameraConfig.position.z
        );

        // CRITICAL: Set camera rotation to look straight ahead (0, 0, -1 direction)
        // Do NOT use lookAt() - just set rotation to zero (looking down -Z axis)
        camera.rotation.set(0, 0, 0);

        console.log(`📷 DASHBOARD CAMERA INITIALIZED:`, {
          position: { x: cameraConfig.position.x, y: cameraConfig.position.y, z: cameraConfig.position.z },
          rotation: { x: 0, y: 0, z: 0 }
        });

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        rendererRef.current = renderer; // Store in ref
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        renderer.domElement.style.background = 'transparent';
        renderer.domElement.style.border = 'none';
        renderer.domElement.style.margin = '0';
        renderer.domElement.style.padding = '0';
        container.appendChild(renderer.domElement);
      }

      // Enhanced lighting for better visibility
      const ambient = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambient);

      // Main directional light (brighter)
      const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
      mainLight.position.set(1, 2, 2);
      mainLight.castShadow = true;
      scene.add(mainLight);

      // Fill light (brighter)
      const fillLight = new THREE.DirectionalLight(0xaaccff, 0.4);
      fillLight.position.set(-1, 0.5, 1);
      scene.add(fillLight);

      // Additional rim light for better visibility
      const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
      rimLight.position.set(0, 1, -2);
      scene.add(rimLight);

      try {
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader");

        // NO ORBIT CONTROLS - Using fixed camera with manual zoom
        console.log('📷 Using fixed camera - no orbit controls');
        console.log('✅ Camera position:', { x: camera.position.x, y: camera.position.y, z: camera.position.z });

        // Add manual zoom control via mouse wheel
        const minDistance = viewMode === 'landing' ? 0.3 : 0.5;
        const maxDistance = viewMode === 'landing' ? 3 : 5;

        const handleWheel = (event: WheelEvent) => {
          event.preventDefault();
          const zoomSpeed = 0.001;
          const delta = event.deltaY * zoomSpeed;

          // Move camera along Z axis (zoom in/out)
          const newZ = camera.position.z + delta;

          // Clamp to min/max distance
          if (newZ >= minDistance && newZ <= maxDistance) {
            camera.position.z = newZ;
          }
        };

        renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });

        const loader = new GLTFLoader();

        // Only register VRM plugin if this is a VRM file
        if (!isGltf) {
          const { VRMLoaderPlugin } = await import("@pixiv/three-vrm");
          loader.register((parser: any) => {
            return new VRMLoaderPlugin(parser);
          });
        }

        const url = modelPath; // Use the modelPath prop
        loader.load(
          url,
          async (gltf) => {

            let modelScene;
            let vrmData = null;

            if (isGltf) {
              // Handle plain GLTF files
              modelScene = gltf.scene;

              // Create a fake VRM structure for compatibility
              vrmData = {
                scene: modelScene,
                humanoid: null,
                expressionManager: null,
              };
            } else {
              // Handle VRM files
              const { VRMUtils } = await import("@pixiv/three-vrm");
              const vrmModel = gltf.userData.vrm;
              if (!vrmModel) {
                console.error("VRM data not found in loaded model");
                return;
              }

              vrmData = vrmModel;
              modelScene = vrmModel.scene;
            }

            // CRITICAL: Remove any cameras embedded in the model
            // Models can have cameras that interfere with our scene camera
            let removedCameras = 0;
            modelScene.traverse((child: any) => {
              if (child.isCamera) {
                console.warn(`🎥 Found embedded camera in model, removing:`, child.name);
                child.parent?.remove(child);
                removedCameras++;
              }
            });
            if (removedCameras > 0) {
              console.log(`✅ Removed ${removedCameras} embedded camera(s) from model`);
            }

            // Calculate model bounding box to see where its center actually is
            const bbox = new THREE.Box3().setFromObject(modelScene);
            const center = new THREE.Vector3();
            bbox.getCenter(center);
            const size = new THREE.Vector3();
            bbox.getSize(size);

            console.log('📦 Model Bounding Box:', {
              center: { x: center.x.toFixed(3), y: center.y.toFixed(3), z: center.z.toFixed(3) },
              size: { x: size.x.toFixed(3), y: size.y.toFixed(3), z: size.z.toFixed(3) },
              min: { x: bbox.min.x.toFixed(3), y: bbox.min.y.toFixed(3), z: bbox.min.z.toFixed(3) },
              max: { x: bbox.max.x.toFixed(3), y: bbox.max.y.toFixed(3), z: bbox.max.z.toFixed(3) }
            });

            // CRITICAL FIX: Offset model based on camera config
            // Each model has different proportions, so offset is configured per model
            const detectedModelType = getModelType(modelPath);
            const expectedConfigKey = `${viewMode}_${detectedModelType}`;
            const modelOffsetY = cameraConfig.modelOffsetY ?? 0;

            console.log(`📍 SETTING Model Position:`, {
              modelPath: modelPath.split('/').pop(),
              viewMode,
              detectedModelType,
              expectedConfigKey,
              modelOffsetY,
              fullCameraConfig: cameraConfig,
              beforePosition: {
                x: modelScene.position.x.toFixed(3),
                y: modelScene.position.y.toFixed(3),
                z: modelScene.position.z.toFixed(3)
              }
            });

            modelScene.position.set(0, modelOffsetY, 0);

            console.log(`✅ Model position SET to Y=${modelOffsetY}`, {
              afterPosition: {
                x: modelScene.position.x.toFixed(3),
                y: modelScene.position.y.toFixed(3),
                z: modelScene.position.z.toFixed(3)
              }
            });

            // Rotate model 180 degrees to face camera
            modelScene.rotation.y = Math.PI;

            // Make model visible
            modelScene.traverse((child: any) => {
              if (child.isMesh) {
                child.frustumCulled = false;
              }
            });

            scene.add(modelScene);

            // Store VRM reference (or fake VRM for GLTF)
            vrmRef.current = vrmData;

            // Update state to trigger lip sync hook
            setVrmLoaded(vrmData);

            // Create animation mixer
            const mixer = new THREE.AnimationMixer(modelScene);
            mixerRef.current = mixer;

            // CRITICAL: Force update mixer immediately to ensure it's ready
            mixer.update(0);

            // DIFFERENT ANIMATION LOGIC FOR LANDING VS DASHBOARD
            if (viewMode === 'landing') {
              // LANDING PAGE: Skip idle, go straight to hip hop dance
              console.log('🎬 LANDING PAGE: Loading hip hop animation (NO IDLE)...');

              if (!isGltf && vrmData.humanoid) {
                // Load animation - it will call setIsFullyLoaded when ready
                loadLandingAnimation(vrmData, mixer);
              } else {
                console.warn('⚠️ LANDING: No humanoid, cannot load hip hop animation');
                setIsFullyLoaded(true);
              }
            } else {
              // DASHBOARD: Use idle animation
              console.log('🎬 DASHBOARD: Creating and starting idle animation...');
              const immediateIdle = createIdleAnimation();
              if (immediateIdle) {
                immediateIdle.reset();
                immediateIdle.play();
                immediateIdle.setLoop(THREE.LoopRepeat, Infinity);
                immediateIdle.setEffectiveWeight(1.0);
                immediateIdle.enabled = true;
                immediateIdle.paused = false;
                currentActionRef.current = immediateIdle;
                breathingActionRef.current = immediateIdle;

                // Force mixer to apply the animation immediately MULTIPLE TIMES
                // to ensure bones are positioned before model becomes visible
                mixer.update(0.016);
                mixer.update(0.016);
                mixer.update(0.016);
                console.log('✅ DASHBOARD: Idle animation playing:', immediateIdle.isRunning());

                // Mark as fully loaded after animation is applied
                setTimeout(() => {
                  setIsFullyLoaded(true);
                  console.log('✅ DASHBOARD: Model fully loaded and animated - now visible');
                }, 150);  // Slightly longer delay to ensure animation is applied
              } else {
                console.error('❌ DASHBOARD: Failed to create idle animation!');
                setIsFullyLoaded(true);
              }
            }
          },
          undefined,
          (error) => {
            console.error("Failed to load VRM model:", url, error);
          }
        );
      } catch (error) {
        console.error("Error loading VRM:", error);
      }

      function onResize() {
        if (!mounted) return;
        if (!container) return;

        // Use container dimensions for both modes since landing page is now scrollable
        const width = container.clientWidth;
        const height = container.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }

      window.addEventListener("resize", onResize);

      // Store the intended camera position and rotation to prevent ANY drift
      const intendedCameraY = cameraConfig.position.y;
      const intendedTargetY = cameraConfig.target.y;
      const intendedModelY = cameraConfig.modelOffsetY ?? 0; // CRITICAL: Store model Y offset
      const intendedCameraRotation = camera.rotation.clone(); // Save initial rotation
      console.log('🔒 Locking camera Y to:', intendedCameraY, 'target Y to:', intendedTargetY);
      console.log('🔒 Locking model Y to:', intendedModelY);
      console.log('🔒 Locking camera rotation to:', { x: intendedCameraRotation.x, y: intendedCameraRotation.y, z: intendedCameraRotation.z });

      // No unlock needed - using instance-specific tracking instead

      function animate() {
        if (!mounted) return;

        const dt = clock.getDelta();

        // Camera position is set during initialization - not reset every frame
        // This allows manual camera adjustments in dev tools without being overridden

        // Scroll-based camera control for landing page (only if this is current instance)
        if (viewMode === 'landing' && typeof window !== 'undefined') {
          const currentInstance = (window as any)._currentLandingInstance;

          // Only apply scroll if this is the active instance
          if (currentInstance === instanceId) {
            const scrollProgress = (window as any).landingCameraProgress || 0;

            // ALWAYS apply scroll-based Z position (even when scrollProgress = 0)
            // This ensures camera returns to base position when scroll is reset
            const baseZ = cameraConfig.position.z; // Use config as base
            const maxZ = 2.0; // Maximum Z position when scrolled
            const targetZ = baseZ + (scrollProgress * (maxZ - baseZ));

            // Log if there's significant movement
            const zDiff = Math.abs(targetZ - camera.position.z);
            if (zDiff > 0.01) {
              console.warn(`📹 Camera Z moving! scrollProgress=${scrollProgress.toFixed(3)}, current=${camera.position.z.toFixed(3)}, target=${targetZ.toFixed(3)}, diff=${zDiff.toFixed(3)}`);
            }

            // Smoothly interpolate camera position
            camera.position.z += (targetZ - camera.position.z) * 0.1;
          }
        }

        // DO NOT call controls.update() - it forces camera to look at target
        // OrbitControls is only used for user interaction events (zoom)
        // The zoom is handled by the control's event listeners, not by update()

        // CRITICAL: Lock camera Y position AND rotation to prevent ANY camera movement
        const cameraDrift = Math.abs(camera.position.y - intendedCameraY);

        if (cameraDrift > 0.001) {
          console.warn(`⚠️ Camera Y drifted by ${cameraDrift.toFixed(4)} - correcting from ${camera.position.y.toFixed(4)} to ${intendedCameraY}`);
          camera.position.y = intendedCameraY;
        }

        // CRITICAL: FORCE model position EVERY FRAME for landing page
        // This ensures 100% consistency regardless of any other code
        if (vrmRef.current?.scene) {
          const modelY = vrmRef.current.scene.position.y;

          if (viewMode === 'landing') {
            // LANDING PAGE: FORCE position EVERY SINGLE FRAME
            if (Math.abs(modelY - intendedModelY) > 0.0001) {
              console.error(`🚨 LANDING: Model Y was ${modelY.toFixed(4)}, FORCING to ${intendedModelY}`);
              vrmRef.current.scene.position.set(0, intendedModelY, 0);
            }
          } else {
            // Dashboard: only correct if drifted
            if (Math.abs(modelY - intendedModelY) > 0.001) {
              console.error(`🚨 DASHBOARD: Model Y drifted to ${modelY.toFixed(4)}, correcting to ${intendedModelY}`);
              vrmRef.current.scene.position.set(0, intendedModelY, 0);
            }
          }
        }

        // CRITICAL: Force camera rotation to stay locked (prevent tilting)
        const rotationDrift = Math.abs(camera.rotation.x - intendedCameraRotation.x) +
                             Math.abs(camera.rotation.y - intendedCameraRotation.y);

        if (rotationDrift > 0.001) {
          console.warn(`⚠️ Camera rotation drifted - forcing back to intended rotation`);
          camera.rotation.copy(intendedCameraRotation);
        }

        // Update animation mixer FIRST (applies bone rotations)
        if (mixerRef.current) {
          // ANTI-TPOSE: Check if any animation is playing
          // BUT SKIP THIS FOR LANDING PAGE (it has its own hip hop animation)
          const hasActiveAnimation = mixerRef.current._actions?.some((action: any) =>
            action && action.isRunning() && action.getEffectiveWeight() > 0
          );

          // If no animation is playing, force start idle ONLY FOR DASHBOARD
          if (!hasActiveAnimation && vrmRef.current && viewMode !== 'landing') {
            console.warn('⚠️ DASHBOARD: No animation detected, forcing idle animation NOW');

            // Stop all actions first
            mixerRef.current.stopAllAction();

            // Create new idle animation
            const newIdle = createIdleAnimation();
            if (newIdle) {
              breathingActionRef.current = newIdle;
              newIdle.reset();
              newIdle.play();
              newIdle.setEffectiveWeight(1.0);
              newIdle.enabled = true;
              currentActionRef.current = newIdle;
              console.log('✅ DASHBOARD: Idle animation forced');
            }
          }

          mixerRef.current.update(dt);
        }

        // Update blinking animation (landing page only)
        updateBlinking();

        // Update VRM (physics for hair/clothes and bone updates)
        // This runs AFTER animation to ensure our rotations aren't overridden
        // Only update if this is a real VRM model (not GLTF)
        if (vrmRef.current && typeof vrmRef.current.update === 'function') {
          vrmRef.current.update(dt);
        }

        // DEBUG: Log camera and model state every 60 frames (1 second at 60fps)
        if (viewMode === 'landing' && rafId && rafId % 60 === 0) {
          console.log(`🎬 Frame ${rafId} state:`, {
            camera: {
              x: camera.position.x.toFixed(3),
              y: camera.position.y.toFixed(3),
              z: camera.position.z.toFixed(3),
              rotX: camera.rotation.x.toFixed(3),
              rotY: camera.rotation.y.toFixed(3),
              rotZ: camera.rotation.z.toFixed(3)
            },
            model: vrmRef.current?.scene ? {
              x: vrmRef.current.scene.position.x.toFixed(3),
              y: vrmRef.current.scene.position.y.toFixed(3),
              z: vrmRef.current.scene.position.z.toFixed(3)
            } : 'NO MODEL'
          });
        }

        renderer.render(scene, camera);
        rafId = requestAnimationFrame(animate);
      }
      animate();

      // cleanup
      return () => {
        mounted = false;
        window.removeEventListener("resize", onResize);

        // Clear animation chain
        if (animationChainTimeoutRef.current) {
          clearTimeout(animationChainTimeoutRef.current);
          animationChainTimeoutRef.current = null;
        }

        // Stop all animations
        if (mixerRef.current) {
          mixerRef.current.stopAllAction();
        }

        // Clear refs
        vrmRef.current = null;
        mixerRef.current = null;
        currentActionRef.current = null;
        currentChainRef.current = [];

        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        if (renderer) {
          renderer.dispose();
        }
        if (container) {
          while (container.firstChild) container.removeChild(container.firstChild);
        }
      };
    }

    let asyncCleanup: (() => void) | null = null;
    init().then((maybeCleanup: any) => {
      if (typeof maybeCleanup === "function") asyncCleanup = maybeCleanup;
    });

    return () => {
      // Clear animation chain
      if (animationChainTimeoutRef.current) {
        clearTimeout(animationChainTimeoutRef.current);
        animationChainTimeoutRef.current = null;
      }
      // Clear fallback timeout
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
        fallbackTimeoutRef.current = null;
      }

      // Stop all animations
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
      }

      // Clear refs
      vrmRef.current = null;
      mixerRef.current = null;
      currentActionRef.current = null;
      currentChainRef.current = [];
      initializedRef.current = false;

      if (asyncCleanup) {
        try {
          asyncCleanup();
        } catch (e) {
          // noop
        }
      } else {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }
        const container = containerRef.current;
        if (container) {
          while (container.firstChild) container.removeChild(container.firstChild);
        }
      }
    };
  }, [modelPath, viewMode, forceReload]); // Added viewMode to dependencies

  // Start idle chain when VRM loads or category is cleared (only for dashboard mode)
  useEffect(() => {
    if (viewMode === 'landing') return; // Don't start idle animations for landing page

    let mounted = true;

    const handleVRMLoaded = () => {
      if (!mounted) return;
      if (vrmRef.current && mixerRef.current && !currentCategory && currentChainRef.current.length === 0) {
        console.log('🎬 Starting idle animation chain from vrm-loaded event');
        playAnimationChain(getIdleAnimations());
      }
    };

    window.addEventListener('vrm-loaded', handleVRMLoaded);

    // Also check if VRM is already loaded (with a small delay to avoid race conditions)
    const checkTimer = setTimeout(() => {
      if (!mounted) return;
      if (vrmRef.current && mixerRef.current && !currentCategory && currentChainRef.current.length === 0) {
        console.log('🎬 Starting idle animation chain from initial check');
        playAnimationChain(getIdleAnimations());
      }
    }, 1000);

    return () => {
      mounted = false;
      clearTimeout(checkTimer);
      window.removeEventListener('vrm-loaded', handleVRMLoaded);
    };
  }, [currentCategory, viewMode]);

  // Load animation chain when category changes (button click or programmatic call) - only for dashboard
  useEffect(() => {
    if (viewMode === 'landing') return; // Don't handle category changes for landing page

    // Wait a bit to ensure VRM and mixer are ready
    const checkAndPlay = () => {
      if (currentCategory === null && vrmRef.current && mixerRef.current) {
        // Default to idle cycling when category is null
        console.log('🔄 Default idle cycle');
        playAnimationChain(getIdleAnimations());
      } else if (currentCategory && vrmRef.current && mixerRef.current) {
        const categoryAnimations = animationCategories[currentCategory as keyof typeof animationCategories];
        if (categoryAnimations) {
          console.log('🎯 Category changed, starting animation chain for:', currentCategory);
          console.log('🔍 VRM:', !!vrmRef.current, 'Mixer:', !!mixerRef.current);
          playAnimationChain(categoryAnimations);
        }
      } else if (currentCategory) {
        // Retry if VRM/mixer not ready yet
        console.log('⏳ Waiting for VRM/mixer to be ready...');
        setTimeout(checkAndPlay, 200);
      }
    };

    checkAndPlay();
  }, [currentCategory, viewMode]);

  // Convert ElevenLabs alignment data to viseme data
  const convertAlignmentToVisemes = (alignment: any, text: string) => {
    // ElevenLabs alignment has character-level timing
    // We'll create simple visemes based on vowels and consonants
    const visemes: Array<{ phoneme: string; start_time: number; end_time: number }> = [];

    if (!alignment || !alignment.characters) {
      console.warn('No alignment data, creating fallback visemes from text');
      // Fallback: create simple mouth movements based on text length
      const duration = text.length * 0.08; // ~80ms per character
      const words = text.split(/\s+/);
      let currentTime = 0;

      words.forEach(word => {
        const wordDuration = word.length * 0.08;
        // Open mouth for each word
        visemes.push({
          phoneme: 'AA', // Open mouth
          start_time: currentTime,
          end_time: currentTime + wordDuration,
        });
        currentTime += wordDuration + 0.1; // Add pause between words
      });

      return visemes;
    }

    // ElevenLabs format: separate arrays for characters and timing
    // {
    //   characters: ["H", "e", "l", "l", "o"],
    //   character_start_times_seconds: [0.0, 0.05, 0.1, 0.15, 0.2],
    //   character_end_times_seconds: [0.05, 0.1, 0.15, 0.2, 0.25]
    // }
    const characters = alignment.characters as string[];
    const startTimes = alignment.character_start_times_seconds as number[];
    const endTimes = alignment.character_end_times_seconds as number[];

    if (!Array.isArray(characters) || !Array.isArray(startTimes) || !Array.isArray(endTimes)) {
      console.warn('Invalid alignment data format');
      return visemes;
    }

    if (characters.length !== startTimes.length || characters.length !== endTimes.length) {
      console.warn('Alignment data length mismatch:', {
        characters: characters.length,
        startTimes: startTimes.length,
        endTimes: endTimes.length
      });
    }

    // Process each character with its timing
    const length = Math.min(characters.length, startTimes.length, endTimes.length);

    for (let i = 0; i < length; i++) {
      const char = characters[i];
      const startTime = startTimes[i];
      const endTime = endTimes[i];

      // Safety check
      if (typeof char !== 'string' || typeof startTime !== 'number' || typeof endTime !== 'number') {
        console.warn(`Invalid data at index ${i}:`, { char, startTime, endTime });
        continue;
      }

      const c = char.toUpperCase();
      let phoneme = 'SIL'; // Default to silence

      // Map characters to approximate phonemes
      if ('AEIOU'.includes(c)) {
        if (c === 'A') phoneme = 'AA';
        else if (c === 'E') phoneme = 'EH';
        else if (c === 'I') phoneme = 'IH';
        else if (c === 'O') phoneme = 'OW';
        else if (c === 'U') phoneme = 'UW';
      } else if ('BCDFGHJKLMNPQRSTVWXYZ'.includes(c)) {
        // Consonants
        if ('BP'.includes(c)) phoneme = 'B'; // Lips together
        else if ('MN'.includes(c)) phoneme = 'M'; // Lips together
        else if ('FV'.includes(c)) phoneme = 'F'; // F/V sound
        else if ('TD'.includes(c)) phoneme = 'DH'; // Tongue
        else if ('SZ'.includes(c)) phoneme = 'S'; // S sound
        else if ('LR'.includes(c)) phoneme = 'L'; // L/R sound
        else if (c === 'W') phoneme = 'W'; // W sound
        else phoneme = 'AA'; // Default open mouth for other consonants
      }

      visemes.push({
        phoneme,
        start_time: startTime,
        end_time: endTime,
      });
    }

    console.log(`📝 Converted ${visemes.length} characters to visemes`);
    console.log('Sample visemes:', visemes.slice(0, 5));
    return visemes;
  };

  // Handle TTS playback
  const handleTtsTest = async () => {
    if (!ttsText.trim() || isPlayingTts) return;

    setIsPlayingTts(true);

    try {
      // Don't stop animations - we want body animation to continue during speech
      // Only lip sync will be controlled by the viseme system

      // Call TTS API
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ttsText }),
      });

      if (!response.ok) {
        throw new Error(`TTS API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.audio) {
        throw new Error('No audio data received');
      }

      console.log('📦 TTS Response:', {
        hasAudio: !!data.audio,
        hasAlignment: !!data.alignment,
        alignmentKeys: data.alignment ? Object.keys(data.alignment) : [],
        alignmentSample: data.alignment ? JSON.stringify(data.alignment).substring(0, 200) : 'none'
      });

      // Log the full alignment structure for debugging
      if (data.alignment) {
        console.log('🔍 Full alignment data:', data.alignment);
        if (data.alignment.characters) {
          console.log('🔍 First 3 characters:', data.alignment.characters.slice(0, 3));
        }
      }

      // Convert alignment data to visemes
      const visemes = convertAlignmentToVisemes(data.alignment, ttsText);
      console.log(`🎤 Generated ${visemes.length} visemes for lip sync`);

      // Create audio element and play
      // ElevenLabs returns base64 encoded audio (usually MP3)
      const audioBlob = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0));
      const blob = new Blob([audioBlob], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);

      // Set up event handlers before assigning to ref
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setIsPlayingTts(false);
        audioRef.current = null;
        setAudioElem(null);
        lipSyncHook.stopLipSync();
      };

      audio.onerror = (error) => {
        URL.revokeObjectURL(audioUrl);
        console.error('Audio playback error:', error);
        setIsPlayingTts(false);
        audioRef.current = null;
        setAudioElem(null);
        lipSyncHook.stopLipSync();
      };

      // Assign to ref and state so lip sync hook can access it
      audioRef.current = audio;
      setAudioElem(audio);

      // Play audio
      console.log('🔊 Playing audio...');
      await audio.play();

      // Start lip sync with visemes
      if (vrmRef.current) {
        console.log('🎬 Starting lip sync animation');
        console.log('VRM available:', !!vrmRef.current);
        console.log('Audio available:', !!audio);
        console.log('Visemes:', visemes.length);

        // The useWawa hook will pick up vrmRef.current and audioRef.current
        lipSyncHook.startLipSync(visemes);
      }

    } catch (error) {
      console.error('TTS test error:', error);
      setIsPlayingTts(false);
      alert(`TTS Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };


  return (
    <div style={{
      width: "100%",
      height: "100%",
      position: "relative",
      background: "rgba(0,0,0,0)",
      border: "none",
      margin: 0,
      padding: 0,
      outline: "none"
    }}>
      <div
        ref={containerRef}
        onClick={onSceneClick}
        style={{
          width: "100%",
          height: "100%",
          minHeight: "100%",
          overflow: "hidden",
          background: "rgba(0,0,0,0)",
          border: "none",
          margin: 0,
          padding: 0,
          display: "block",
          position: "relative",
          cursor: onSceneClick ? "pointer" : "default",
          outline: "none",
          opacity: isFullyLoaded ? 1 : 0,
          transition: "opacity 0.3s ease-in-out"
        }}
      />

      {/* ElevenLabs Test Panel */}
      {testMode === 'elevenlabs' && (
        <div style={{
          position: "absolute",
          bottom: "1rem",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          width: "90%",
          maxWidth: "500px",
          padding: "1rem",
          borderRadius: "0.5rem",
          background: "rgba(0,0,0,0.8)",
          border: "1px solid rgba(255,255,255,0.3)",
          backdropFilter: "blur(8px)"
        }}>
          <label style={{ color: "white", fontSize: "0.875rem", fontWeight: "bold" }}>
            Test Text-to-Speech:
          </label>
          <textarea
            value={ttsText}
            onChange={(e) => setTtsText(e.target.value)}
            placeholder="Enter text to convert to speech..."
            style={{
              padding: "0.75rem",
              borderRadius: "0.5rem",
              border: "1px solid rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.1)",
              color: "white",
              fontSize: "0.875rem",
              minHeight: "80px",
              resize: "vertical",
              fontFamily: "inherit"
            }}
          />
          <button
            onClick={handleTtsTest}
            disabled={isPlayingTts || !ttsText.trim()}
            style={{
              padding: "0.75rem 1.5rem",
              borderRadius: "0.5rem",
              border: "none",
              background: isPlayingTts ? "rgba(100,100,100,0.5)" : "#4ade80",
              color: "white",
              fontSize: "0.875rem",
              fontWeight: "bold",
              cursor: isPlayingTts || !ttsText.trim() ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              opacity: isPlayingTts || !ttsText.trim() ? 0.6 : 1
            }}
          >
            {isPlayingTts ? "🎤 Playing..." : "▶️ Play TTS"}
          </button>
        </div>
      )}
    </div>
  );
}
