import { useState, useEffect, useRef, useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { getTime } from 'date-fns';
import { toast } from 'sonner';
import { useUser } from '@clerk/react-router';

import { threadLoadingAtom, threadAtom, configAtom, messagesAtom } from '@/store';
import { speechLog, speechGrammer, IS_SPEECH_RECOGNITION_SUPPORTED } from '@/utils';

import useHandleChatResponse from './useHandleChatResponse';

const useSpeech = () => {
  const { imageSize, language, quality, style } = useAtomValue(configAtom);
  const thread = useAtomValue(threadAtom);
  const addChat = useSetAtom(messagesAtom);
  const setIsChatResponseLoading = useSetAtom(threadLoadingAtom);
  const [isListening, setIsListening] = useState(false);

  const recognition = useRef<SpeechRecognition | null>(null);

  const { user } = useUser();
  const { handleChatResponse } = useHandleChatResponse();

  const startRecognition = useCallback(async () => {
    if (!recognition.current) return null;

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      recognition.current.start();
      setIsListening(true);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const stopRecognition = useCallback(async () => {
    if (!recognition.current) return null;

    recognition.current.stop();
    speechLog('Stopped');
    setIsListening(false);
  }, []);

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

  const onSpeechResult = useCallback(
    async (ev: SpeechRecognitionEvent) => {
      try {
        if (!thread) throw new Error('Thread not created');

        const results = ev.results;
        const last = --Object.keys(results).length;

        const transcript = results[last][0].transcript;

        if (!transcript.trim()) return null;

        addChat({
          id: crypto.randomUUID(),
          role: 'user',
          content: transcript,
          metadata: {
            model: thread.settings.model,
            variation: null,
            timestamp: getTime(new Date()),
          },
          type: 'text',
        });

        setIsChatResponseLoading(true);
        stopRecognition();

        await handleChatResponse({
          prompt: transcript,
          onTextMessageComplete: (content) => {
            if (thread.settings.isTextToSpeechEnabled)
              speakText(content, recognition.current?.lang || 'en-US');
          },
        });

        return true;
      } catch (err) {
        toast.error('Something went Wrong!');
      } finally {
        setIsChatResponseLoading(false);
      }
    },
    [
      addChat,
      setIsChatResponseLoading,
      stopRecognition,
      imageSize,
      user,
      quality,
      style,
      speakText,
      thread?.settings,
    ]
  );

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
    recognition.current.interimResults = false;
    recognition.current.maxAlternatives = 1;
    recognition.current.onaudiostart = () => speechLog('Audio Started');
    recognition.current.onaudioend = () => speechLog('Audio Ended');
    recognition.current.onspeechstart = () => speechLog('Speech Started');
    recognition.current.onspeechend = stopRecognition;
    recognition.current.onresult = onSpeechResult;
    recognition.current.onnomatch = () => speechLog('No Match');
    recognition.current.onstart = () => speechLog('Start');
    recognition.current.onerror = () => speechLog('Error');
    recognition.current.onend = () => speechLog('End');

    return () => {
      stopRecognition();
    };
  }, [language, onSpeechResult, stopRecognition]);

  return {
    startRecognition,
    stopRecognition,
    recognition,
    isListening,
  };
};

export default useSpeech;
