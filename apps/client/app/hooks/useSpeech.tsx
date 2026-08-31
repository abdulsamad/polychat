import { useState, useEffect, useRef, useCallback } from 'react';
import { useAtom, useAtomValue } from 'jotai';

import { configAtom, editorAtom } from '@/store';
import { speechLog, speechGrammer, IS_SPEECH_RECOGNITION_SUPPORTED } from '@/utils';

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>'"]|`/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
        '`': '&#96;',
      })[character] || character
  );

const useSpeech = () => {
  const { language } = useAtomValue(configAtom);
  const [, setEditorState] = useAtom(editorAtom);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const recognition = useRef<SpeechRecognition | null>(null);
  const transcript = useRef('');
  const finalizedResults = useRef(new Map<number, string>());
  const isFinalizing = useRef(false);

  const insertTranscript = useCallback(
    (text: string) => {
      const paragraph = `<p>${escapeHtml(text)}</p>`;

      setEditorState((current) => (current.trim() ? `${current}${paragraph}` : paragraph));
      setIsTranscribing(false);
    },
    [setEditorState]
  );

  const finalizeTranscript = useCallback(() => {
    if (isFinalizing.current) return;

    const text = transcript.current.trim();
    transcript.current = '';
    setIsListening(false);

    if (!text) {
      setIsTranscribing(false);
      return;
    }

    isFinalizing.current = true;
    insertTranscript(text);
    isFinalizing.current = false;
  }, [insertTranscript]);

  const startRecognition = useCallback(async () => {
    if (!recognition.current || isListening || isTranscribing) return null;

    try {
      transcript.current = '';
      finalizedResults.current.clear();
      setIsTranscribing(false);
      recognition.current.start();
      setIsListening(true);
    } catch (err) {
      setIsListening(false);
      console.error(err);
    }
  }, [isListening, isTranscribing]);

  const stopRecognition = useCallback(async () => {
    if (!recognition.current || !isListening) return null;

    setIsListening(false);
    setIsTranscribing(true);
    recognition.current.stop();
    speechLog('Stopped');
  }, [isListening]);

  const onSpeechResult = useCallback((ev: SpeechRecognitionEvent) => {
    for (let index = ev.resultIndex; index < ev.results.length; index += 1) {
      const result = ev.results[index];

      if (result.isFinal) {
        // Results are indexed and may be reported again. Replacing the index is
        // idempotent and avoids appending the same finalized phrase repeatedly.
        finalizedResults.current.set(index, result[0]?.transcript ?? '');
      }
    }

    transcript.current = [...finalizedResults.current.entries()]
      .sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
      .map(([, segment]) => segment.trim())
      .filter(Boolean)
      .join(' ');
  }, []);

  useEffect(() => {
    if (!IS_SPEECH_RECOGNITION_SUPPORTED()) return;

    const SpeechRecognitionConstructor =
      window.webkitSpeechRecognition || window.SpeechRecognition;

    if (!SpeechRecognitionConstructor) return;

    const speechRecognition = new SpeechRecognitionConstructor();

    recognition.current = speechRecognition;

    // Add speech grammar
    const SpeechGrammarListConstructor =
      window.webkitSpeechGrammarList || window.SpeechGrammarList;

    if (SpeechGrammarListConstructor) {
      const speechRecognitionList = new SpeechGrammarListConstructor();

      speechRecognitionList.addFromString(speechGrammer, 1);
      recognition.current.grammars = speechRecognitionList;
    }

    recognition.current.continuous = true;
    recognition.current.lang = language;
    recognition.current.interimResults = true;
    recognition.current.maxAlternatives = 1;
    recognition.current.onaudiostart = () => speechLog('Audio Started');
    recognition.current.onaudioend = () => speechLog('Audio Ended');
    recognition.current.onspeechstart = () => speechLog('Speech Started');
    recognition.current.onresult = onSpeechResult;
    recognition.current.onnomatch = () => speechLog('No Match');
    recognition.current.onstart = () => speechLog('Start');
    recognition.current.onerror = () => speechLog('Error');
    recognition.current.onend = () => {
      speechLog('End');
      finalizeTranscript();
    };

    return () => {
      recognition.current?.abort();
      recognition.current = null;
      transcript.current = '';
      finalizedResults.current.clear();
      setIsListening(false);
      setIsTranscribing(false);
    };
  }, [finalizeTranscript, language, onSpeechResult]);

  return {
    startRecognition,
    stopRecognition,
    recognition,
    isListening,
    isTranscribing,
  };
};

export default useSpeech;
