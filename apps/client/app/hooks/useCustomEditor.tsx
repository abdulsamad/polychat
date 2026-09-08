import { useCallback, useEffect, useState } from 'react';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import { useAtom } from 'jotai';
import { useUser } from '@clerk/react-router';
import { toast } from 'sonner';

import { editorAtom, threadAtom } from '@/store/index';
import type { ImageAttachment } from 'utils';
import { useAtomValue } from 'jotai';
import { getProviderKey } from '@/utils/byok-vault';
import { useByokModelAvailability } from './useByokModelAvailability';

import useSubmitMessage from './useSubmitMessage';

const extensions = [
  StarterKit.configure({
    undoRedo: false,
    heading: { levels: [1, 2, 3, 4, 5, 6], HTMLAttributes: { class: 'heading' } },
    paragraph: { HTMLAttributes: { class: 'paragraph' } },
  }),
  Placeholder.configure({ placeholder: 'Ask anything...' }),
];

export const MAX_IMAGE_ATTACHMENTS = 4;
// Keep this aligned with the serverless limit. Data URLs are base64 encoded,
// so the final JSON request is larger than the original files.
export const MAX_HOSTED_FILE_BYTES = 2 * 1024 * 1024;
const supportedDocumentTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
] as const;
const isSupportedDocument = (file: File) =>
  supportedDocumentTypes.includes(file.type as (typeof supportedDocumentTypes)[number]);

const readImageAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Image could not be read.'));
    reader.readAsDataURL(file);
  });

const getClipboardImageFiles = (clipboardData: DataTransfer | null) => {
  if (!clipboardData) return [];

  const itemFiles = Array.from(clipboardData.items)
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));

  return itemFiles.length
    ? itemFiles
    : Array.from(clipboardData.files).filter((file) => file.type.startsWith('image/'));
};

const useCustomEditor = () => {
  const [editorState, setEditorState] = useAtom(editorAtom);
  const thread = useAtomValue(threadAtom);
  const { user } = useUser();
  const { findModel } = useByokModelAvailability();
  const [imageAttachments, setImageAttachments] = useState<ImageAttachment[]>([]);
  const { isChatLoading, isQueued, submitMessage, stopChat, cancelQueuedMessage } =
    useSubmitMessage();

  const selectedModel = thread ? findModel(thread.settings.model) : undefined;
  const canAttachImages = Boolean(selectedModel?.supportsVision);
  const canAttachFiles = Boolean(selectedModel?.supportsFiles);
  const isByok = Boolean(
    user?.id && selectedModel?.provider && getProviderKey(user.id, selectedModel.provider)
  );

  const addImageFiles = useCallback(
    async (files: File[] | FileList) => {
      if (!canAttachImages && !canAttachFiles) return;

      const selectedFiles = Array.from(files);
      const remainingSlots = isByok
        ? Number.POSITIVE_INFINITY
        : MAX_IMAGE_ATTACHMENTS - imageAttachments.length;
      if (!isByok && remainingSlots <= 0) {
        toast.error(`You can attach up to ${MAX_IMAGE_ATTACHMENTS} images.`);
        return;
      }

      const supportedFiles = selectedFiles.filter(
        (file) => file.type.startsWith('image/') || isSupportedDocument(file)
      );
      if (supportedFiles.length !== selectedFiles.length) toast.error('Unsupported file type.');
      const filesToUse = supportedFiles.filter((file) =>
        file.type.startsWith('image/') ? canAttachImages : canAttachFiles
      );
      if (filesToUse.length < supportedFiles.length) {
        toast.error('This model does not support one or more selected file types.');
      }

      const filesToAdd = isByok ? filesToUse : filesToUse.slice(0, remainingSlots);
      if (!isByok && filesToAdd.length < filesToUse.length) {
        toast.error(`You can attach up to ${MAX_IMAGE_ATTACHMENTS} files.`);
      }

      const currentBytes = imageAttachments.reduce(
        (total, attachment) => total + attachment.size,
        0
      );
      let acceptedBytes = currentBytes;
      const acceptedFiles = filesToAdd.filter((file) => {
        if (isByok) return true;
        if (acceptedBytes + file.size > MAX_HOSTED_FILE_BYTES) return false;
        acceptedBytes += file.size;
        return true;
      });

      if (!isByok && acceptedFiles.length < filesToAdd.length) {
        toast.error('Hosted file uploads are limited to 2 MB per request.');
      }

      const attachments = await Promise.all(
        acceptedFiles.map(async (file) => ({
          id: crypto.randomUUID(),
          name: file.name,
          mediaType: file.type,
          size: file.size,
          dataUrl: await readImageAsDataUrl(file),
        }))
      );
      setImageAttachments((current) => [...current, ...attachments]);
    },
    [canAttachFiles, canAttachImages, imageAttachments, isByok]
  );

  const removeImageAttachment = useCallback((id: string) => {
    setImageAttachments((current) => current.filter((attachment) => attachment.id !== id));
  }, []);

  const editor = useEditor({
    extensions,
    content: editorState,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        'aria-label': 'Message',
        'aria-describedby': 'composer-help',
        'aria-multiline': 'true',
        class: 'composer-editor',
        role: 'textbox',
      },
      handleDOMEvents: {
        paste: (_view, event) => {
          const clipboardEvent = event as ClipboardEvent;
          const imageFiles = getClipboardImageFiles(clipboardEvent.clipboardData);

          if (!imageFiles.length) return false;

          clipboardEvent.preventDefault();
          if (!canAttachImages) {
            toast.error('This model does not support image input.');
            return true;
          }

          void addImageFiles(imageFiles);
          return true;
        },
        keydown: (_view, event) => {
          const shouldSubmit =
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.ctrlKey &&
            !event.altKey &&
            !event.metaKey &&
            !event.isComposing;

          if (!shouldSubmit) return false;

          event.preventDefault();

          if (!isChatLoading) void handleSubmit();

          return true;
        },
      },
    },
    onUpdate({ editor }) {
      setEditorState(editor.getHTML());
    },
  });

  const handleSubmit = useCallback(async () => {
    if (!editor) return false;

    const prompt = editor.getText({ blockSeparator: '\n' }).trim();
    if (!prompt && imageAttachments.length === 0) return false;

    const didSubmit = submitMessage(prompt, imageAttachments);
    if (!didSubmit) return false;

    editor.commands.clearContent(true);
    setImageAttachments([]);
    setEditorState('');
    editor.commands.focus('end');

    return true;
  }, [editor, imageAttachments, setEditorState, submitMessage]);

  const cancelQueued = useCallback(() => {
    const prompt = cancelQueuedMessage();
    if (!prompt || !editor) return;

    const promptContent = prompt.split('\n').map((line) => ({
      type: 'paragraph',
      ...(line ? { content: [{ type: 'text', text: line }] } : {}),
    }));
    const draftContent = editor.isEmpty ? [] : editor.getJSON().content || [];

    editor.commands.setContent(
      {
        type: 'doc',
        content: [
          ...promptContent,
          ...(draftContent.length ? [{ type: 'paragraph' }, ...draftContent] : []),
        ],
      },
      { emitUpdate: false }
    );
    setEditorState(editor.getHTML());
    editor.commands.focus('end');
  }, [cancelQueuedMessage, editor, setEditorState]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    const currentContent = editor.isEmpty ? '' : editor.getHTML();
    if (currentContent === editorState) return;

    editor.commands.setContent(editorState, { emitUpdate: false });
    editor.commands.focus('end');
  }, [editor, editorState]);

  useEffect(() => {
    if (!canAttachImages && !canAttachFiles && imageAttachments.length) {
      setImageAttachments([]);
    }
  }, [canAttachFiles, canAttachImages, imageAttachments.length]);

  return {
    editor,
    handleSubmit,
    isChatLoading,
    isQueued,
    stopChat,
    cancelQueued,
    imageAttachments,
    canAttachImages,
    canAttachFiles,
    addImageFiles,
    removeImageAttachment,
  };
};

export default useCustomEditor;
