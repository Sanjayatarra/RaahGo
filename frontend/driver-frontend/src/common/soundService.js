// Realistic Polyphonic Audio Ringtone & Alert System for Driver App using Web Audio API

let audioCtx = null;
let ringtoneInterval = null;
let isRinging = false;

const getAudioContext = () => {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  } catch (e) {}
  return audioCtx;
};

// Auto-unlock AudioContext on first user interaction
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    try {
      if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          audioCtx = new AudioContextClass();
        }
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
    } catch (e) {}
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };
  window.addEventListener('click', unlockAudio, { once: true, passive: true });
  window.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
}

/**
 * Play an energetic incoming ride alert chime
 */
const playChimeSequence = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Notes: G5 (784Hz) -> C6 (1046.5Hz) -> E6 (1318.5Hz) -> G6 (1568Hz)
  const notes = [
    { freq: 784, start: 0.00, dur: 0.12 },
    { freq: 1046.5, start: 0.12, dur: 0.14 },
    { freq: 1318.5, start: 0.26, dur: 0.14 },
    { freq: 1568.0, start: 0.40, dur: 0.35 }
  ];

  notes.forEach(({ freq, start, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle'; // Clean chime tone
    osc.frequency.setValueAtTime(freq, now + start);

    // Envelope
    gain.gain.setValueAtTime(0.001, now + start);
    gain.gain.exponentialRampToValueAtTime(0.4, now + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + start);
    osc.stop(now + start + dur + 0.05);
  });

  // Device vibration for mobile devices (only when user has interacted with page)
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      if (!navigator.userActivation || navigator.userActivation.hasBeenActive) {
        navigator.vibrate([300, 150, 300, 150, 400]);
      }
    } catch (e) {}
  }
};

/**
 * Start loop of incoming ride request ringtone
 */
export const startIncomingRideRingtone = () => {
  if (isRinging) return;
  isRinging = true;

  // Play immediately
  playChimeSequence();

  // Repeat every 1.5 seconds while incoming ride is active
  ringtoneInterval = setInterval(() => {
    if (!isRinging) {
      clearInterval(ringtoneInterval);
      return;
    }
    playChimeSequence();
  }, 1500);
};

/**
 * Stop ringtone loop immediately
 */
export const stopIncomingRideRingtone = () => {
  isRinging = false;
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      if (!navigator.userActivation || navigator.userActivation.hasBeenActive) {
        navigator.vibrate(0);
      }
    } catch (e) {}
  }
};

/**
 * Play pleasant confirmation chime when ride is accepted
 */
export const playRideAcceptedChime = () => {
  stopIncomingRideRingtone();
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [
    { freq: 523.25, start: 0.00, dur: 0.15 }, // C5
    { freq: 659.25, start: 0.15, dur: 0.15 }, // E5
    { freq: 783.99, start: 0.30, dur: 0.30 }  // G5
  ];

  notes.forEach(({ freq, start, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + start);

    gain.gain.setValueAtTime(0.001, now + start);
    gain.gain.exponentialRampToValueAtTime(0.35, now + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + start);
    osc.stop(now + start + dur + 0.05);
  });
};
