import { useState, useEffect, useRef, useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { getTime } from 'date-fns';
import { toast } from 'sonner';

import { threadLoadingAtom, threadAtom, configAtom, upsertMessageAtom } from '@/store';
import { speechLog, speechGrammer, IS_SPEECH_RECOGNITION_SUPPORTED } from '@/utils';

import useHandleChatResponse from './useHandleChatResponse';

const useSpeech = () => {
  const { language } = useAtomValue(configAtom);
  const thread = useAtomValue(threadAtom);
  const addChat = useSetAtom(upsertMessageAtom);
  const setIsChatResponseLoading = useSetAtom(threadLoadingAtom);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const recognition = useRef<SpeechRecognition | null>(null);
  const transcript = useRef('');
  const isFinalizing = useRef(false);

  const { handleChatResponse } = useHandleChatResponse();

  const speakText = useCallback((text: string, language: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance();

      utterance.text = text;
      utterance.lang = language;

      speechSynthesis.speak(utterance);
    } else {
      console.error('SpeechSynthesis API not supported');
    }
  }, []);

  const submitTranscript = useCallback(
    async (text: string) => {
      try {
        if (!thread) throw new Error('Thread not created');

        addChat({
          id: crypto.randomUUID(),
          role: 'user',
          content: text,
          metadata: {
            model: thread.settings.model,
            variation: null,
            timestamp: getTime(new Date()),
          },
          type: 'text',
        });

        setIsChatResponseLoading(true);

        await handleChatResponse({
          prompt: text,
          onTextMessageComplete: (content) => {
            if (thread.settings.isTextToSpeechEnabled)
              speakText(content, recognition.current?.lang || 'en-US');
          },
        });
      } catch (err) {
        toast.error('Something went Wrong!');
      } finally {
        setIsChatResponseLoading(false);
        setIsTranscribing(false);
      }
    },
    [addChat, handleChatResponse, setIsChatResponseLoading, speakText, thread]
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
    void submitTranscript(text).finally(() => {
      isFinalizing.current = false;
    });
  }, [submitTranscript]);

  const startRecognition = useCallback(async () => {
    if (!recognition.current || isListening || isTranscribing) return null;

    try {
      transcript.current = '';
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

      if (result.isFinal) transcript.current += `${result[0].transcript} `;
    }
  }, []);

  useEffect(() => {
    if (!IS_SPEECH_RECOGNITION_SUPPORTED()) return;

    const speechRecognition = new (webkitSpeechRecognition || SpeechRecognition)();

    recognition.current = speechRecognition;

    // Add speech grammar
    if (window.webkitSpeechGrammarList || window.SpeechGrammarList) {
      const speechRecognitionList = new (webkitSpeechGrammarList || SpeechGrammarList)();

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
