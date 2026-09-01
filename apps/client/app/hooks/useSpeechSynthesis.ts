import { useCallback, useEffect, useRef } from 'react';
import { useSetAtom } from 'jotai';

import { speechPlaybackAtom } from '@/store';

const MAX_UTTERANCE_LENGTH = 220;

let activeRunId = 0;

export const getSpeechText = (content: string) =>
  content
    .replace(/```[\s\S]*?(?:```|$)/g, ' ')
    .replace(/~~~[\s\S]*?(?:~~~|$)/g, ' ')
    .replace(/^(?: {4}|\t).+$/gm, ' ')
    .replace(/^\s*\|.*\|\s*$/gm, ' ')
    .replace(/^\s*[-|: ]{3,}$/gm, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$\n]+\$/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\bwww\.\S+/gi, ' ')
    .replace(/<https?:\/\/[^>]+>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/[>*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const splitIntoUtterances = (content: string) => {
  const text = getSpeechText(content);
  if (text.length <= MAX_UTTERANCE_LENGTH) return text ? [text] : [];

  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [text];
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const next = `${current} ${sentence}`.trim();
    if (current && next.length > MAX_UTTERANCE_LENGTH) {
      chunks.push(current);
      current = sentence.trim();
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks;
};

const selectVoice = (voices: SpeechSynthesisVoice[], language: string) => {
  const normalizedLanguage = language.toLowerCase();
  const languagePrefix = normalizedLanguage.split('-')[0];
  const languageVoices = voices.filter((voice) => {
    const voiceLanguage = voice.lang.toLowerCase();
    return voiceLanguage === normalizedLanguage || voiceLanguage.startsWith(`${languagePrefix}-`);
  });

  const candidates = languageVoices.length ? languageVoices : voices;
  return [...candidates].sort((a, b) => {
    const score = (voice: SpeechSynthesisVoice) => {
      const name = voice.name.toLowerCase();
      return (
        (name.includes('natural') ? 4 : 0) +
        (name.includes('enhanced') || name.includes('premium') ? 3 : 0) +
        (name.includes('google') || name.includes('microsoft') ? 2 : 0) +
        (voice.localService ? 1 : 0) -
        (name.includes('compact') ? 2 : 0)
      );
    };

    return score(b) - score(a);
  })[0];
};

const normalizeLanguage = (language: string) => (language === 'en-UK' ? 'en-GB' : language);

const useSpeechSynthesis = () => {
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const setIsSpeaking = useSetAtom(speechPlaybackAtom);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    const synthesis = window.speechSynthesis;
    const updateVoices = () => {
      voicesRef.current = synthesis.getVoices();
    };

    updateVoices();
    synthesis.addEventListener('voiceschanged', updateVoices);
    return () => synthesis.removeEventListener('voiceschanged', updateVoices);
  }, []);

  const cancel = useCallback(() => {
    if (!('speechSynthesis' in window)) return;
    activeRunId += 1;
    setIsSpeaking(false);
    window.speechSynthesis.cancel();
  }, [setIsSpeaking]);

  const speak = useCallback(
    (content: string, language: string) => {
      if (!('speechSynthesis' in window)) return;

      const speechLanguage = normalizeLanguage(language);
      const chunks = splitIntoUtterances(content);
      if (!chunks.length) {
        setIsSpeaking(false);
        return;
      }

      const synthesis = window.speechSynthesis;
      // Some browsers populate the voice list lazily without firing
      // `voiceschanged` before the first speech request.
      voicesRef.current = synthesis.getVoices();
      const runId = activeRunId + 1;
      activeRunId = runId;
      setIsSpeaking(true);
      synthesis.cancel();
      synthesis.resume();

      const voice = selectVoice(voicesRef.current, speechLanguage);
      let index = 0;
      const speakNext = () => {
        if (runId !== activeRunId) return;
        if (index >= chunks.length) {
          setIsSpeaking(false);
          return;
        }

        const utterance = new SpeechSynthesisUtterance(chunks[index]);
        utterance.lang = speechLanguage;
        utterance.rate = 0.96;
        utterance.pitch = 1;
        utterance.volume = 1;
        if (voice) utterance.voice = voice;
        index += 1;
        utterance.onend = speakNext;
        utterance.onerror = (event) => {
          if (event.error !== 'canceled' && event.error !== 'interrupted') speakNext();
          else if (runId === activeRunId) setIsSpeaking(false);
        };
        try {
          synthesis.speak(utterance);
        } catch (error) {
          console.warn('Speech synthesis is unavailable:', error);
          if (runId === activeRunId) setIsSpeaking(false);
        }
      };

      speakNext();
    },
    [setIsSpeaking]
  );

  useEffect(() => cancel, [cancel]);

  return { speak, cancel };
};

export default useSpeechSynthesis;
