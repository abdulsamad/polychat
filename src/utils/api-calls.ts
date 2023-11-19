import axios from 'axios';

import { getConfig } from './config';

const axiosInstance = axios.create({
	baseURL: `${process.env.NEXT_PUBLIC_SERVER_ENDPOINT}/api`,
});

export const getApiAccessToken = async () => {
	const res = await axios.get('/api/token');
	return res.data.token.access_token;
};

interface IgetGeneratedText {
	prompt: string;
	language?: string;
}

export const getGeneratedText = async ({
	prompt,
	language,
}: IgetGeneratedText) => {
	const token = await getApiAccessToken();

	const res = await axiosInstance.post(
		'/text',
		{
			prompt,
			language,
			type: getConfig('variation'),
			model: getConfig('model'),
		},
		{ headers: { Authorization: `Bearer ${token}` } },
	);

	return res.data;
};

interface IgetGeneratedImage {
	prompt: string;
	size?: string;
	n?: number;
}

export const getGeneratedImage = async ({
	prompt,
	size = '512x512',
	n = 1,
}: IgetGeneratedImage) => {
	const token = await getApiAccessToken();

	const res = await axiosInstance.post(
		'/image',
		{ prompt, size, n, model: getConfig('model') },
		{ headers: { Authorization: `Bearer ${token}` } },
	);

	return res.data;
};
