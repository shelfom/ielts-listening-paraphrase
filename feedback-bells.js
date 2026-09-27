// Feedback bell controller.
// WebAudio tones are the primary cue; fixed MP3 clips are the fallback.
// Every playback receives an epoch. A book jump invalidates the epoch so a
// suspended resume resolving/rejecting late, a running oscillator, or an
// active fallback clip can never be heard after navigation.

/**
 * @typedef {Object} FeedbackBellHandle
 * @property {(kind: string) => void} play
 * @property {(invalidate?: boolean) => void} cancel
 * @property {() => number} epoch
 * @property {() => { oscillators: number, outputs: number, fallbackAudios: number }} state
 */

/**
 * Create a feedback bell controller.
 *
 * @param {{
 *   createAudioContext: () => {
 *     state: string,
 *     currentTime: number,
 *     destination: AudioNode,
 *     resume: () => Promise<void>,
 *     createGain: () => AudioGainNode,
 *     createOscillator: () => OscillatorNode
 *   } | null,
 *   fallback: Record<string, { pause: () => void, play: () => Promise<void>, currentTime: number }>
 * }} options
 * @returns {FeedbackBellHandle}
 */
export function createFeedbackBells(options) {
  const { createAudioContext, fallback } = options;
  let context = null;
  let epoch = 0;
  const oscillators = new Set();
  const outputs = new Set();
  const fallbackAudios = new Set();

  function playFallback(kind, expectedEpoch) {
    const sound = fallback?.[kind];
    if (!sound) return;
    fallbackAudios.add(sound);
    try {
      sound.pause();
      sound.currentTime = 0;
    } catch {}
    Promise.resolve(sound.play())
      .catch(() => {})
      .finally(() => {
        if (epoch !== expectedEpoch) return;
        fallbackAudios.delete(sound);
      });
  }

  function ring(kind, expectedEpoch) {
    if (epoch !== expectedEpoch || !context) return;
    const start = context.currentTime + 0.008;
    const correct = kind === "correct";
    const tones = correct
      ? [
          { frequency: 783.99, delay: 0, duration: 0.18 },
          { frequency: 1174.66, delay: 0.12, duration: 0.34 }
        ]
      : [
          { frequency: 329.63, delay: 0, duration: 0.18 },
          { frequency: 246.94, delay: 0.13, duration: 0.34 }
        ];

    const master = context.createGain();
    outputs.add(master);
    master.gain.setValueAtTime(correct ? 0.48 : 0.42, start);
    master.gain.exponentialRampToValueAtTime(0.0001, start + 0.52);
    master.connect(context.destination);

    let remaining = tones.length;
    tones.forEach(({ frequency, delay, duration }) => {
      const oscillator = context.createOscillator();
      oscillators.add(oscillator);
      const envelope = context.createGain();
      const toneStart = start + delay;
      oscillator.type = correct ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(frequency, toneStart);
      envelope.gain.setValueAtTime(0.0001, toneStart);
      envelope.gain.exponentialRampToValueAtTime(1, toneStart + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.0001, toneStart + duration);
      oscillator.connect(envelope);
      envelope.connect(master);
      oscillator.start(toneStart);
      oscillator.stop(toneStart + duration + 0.02);
      oscillator.onended = () => {
        oscillators.delete(oscillator);
        remaining -= 1;
        if (remaining === 0) {
          outputs.delete(master);
          try {
            master.disconnect();
          } catch {}
        }
      };
    });
  }

  function play(kind) {
    epoch += 1;
    const expectedEpoch = epoch;
    const audioContextFactory = createAudioContext();
    if (!audioContextFactory) {
      playFallback(kind, expectedEpoch);
      return;
    }
    try {
      if (!context || context.state === "closed") {
        context = audioContextFactory;
      }
      if (context.state === "suspended") {
        context.resume().then(
          () => ring(kind, expectedEpoch),
          () => {
            if (epoch !== expectedEpoch) return;
            playFallback(kind, expectedEpoch);
          }
        );
      } else {
        ring(kind, expectedEpoch);
      }
    } catch {
      if (epoch !== expectedEpoch) return;
      playFallback(kind, expectedEpoch);
    }
  }

  function cancel(invalidate = false) {
    if (invalidate) epoch += 1;
    oscillators.forEach((oscillator) => {
      try {
        oscillator.onended = null;
        oscillator.stop();
        oscillator.disconnect();
      } catch {}
    });
    oscillators.clear();
    outputs.forEach((gain) => {
      try {
        gain.disconnect();
      } catch {}
    });
    outputs.clear();
    fallbackAudios.forEach((audio) => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    });
    fallbackAudios.clear();
  }

  return {
    play,
    cancel,
    epoch: () => epoch,
    state: () => ({
      oscillators: oscillators.size,
      outputs: outputs.size,
      fallbackAudios: fallbackAudios.size
    })
  };
}
