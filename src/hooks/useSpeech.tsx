import { useState, useEffect, useRef, useCallback } from 'react';
import { useSetAtom, useAtom } from 'jotai';

import { editorAtom } from '@/store';
import { speechLog, getCorrectedText, speechGrammer } from '@/utils';

const speechRecognition = new (webkitSpeechRecognition || SpeechRecognition)();
const speechRecognitionList = new webkitSpeechGrammarList();

const useSpeech = ({ editor }: { editor: any }) => {
	const [isListening, setIsListening] = useState(false);

	const recognition = useRef<SpeechRecognition | null>(null);

	const [state, setState] = useAtom(editorAtom);

	useEffect(() => {
		speechRecognitionList.addFromString(speechGrammer, 1);

		recognition.current = speechRecognition;
		recognition.current.grammars = speechRecognitionList;
		recognition.current.continuous = true;
		recognition.current.lang = 'en-IN';
		recognition.current.interimResults = false;
		recognition.current.maxAlternatives = 1;

		recognition.current.onresult = (event: any) => {
			const results = event.results;
			const len = Object.keys(results).length;

			// TODO: Clean log results
			console.log(results);

			const transcript = results[len - 1][0].transcript;
			setState(transcript);

			getCorrectedText(transcript, recognition.current?.lang).then(
				({ chatCompletion }) => {
					const { choices } = chatCompletion;
					setState(
						`\n<b>Corrected:</b> <em>${choices[0]?.message?.content}</em>`,
					);
					console.log({ chatCompletion });
				},
			);
		};

		recognition.current.onspeechend = stopRecognition;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [setState]);

	const startRecognition = useCallback(async () => {
		if (!recognition.current) return null;

		try {
			await navigator.mediaDevices.getUserMedia({ audio: true });

			recognition.current.start();
			speechLog('Started');
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

	return {
		startRecognition,
		stopRecognition,
		recognition,
		isListening,
	};
};

export default useSpeech;
