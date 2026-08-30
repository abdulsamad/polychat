import { motion, useReducedMotion } from 'motion/react';
import clsx from 'clsx';

import { IMessageCommons, ITextMessage, IImageMessage } from '@/store';
import { UserInfo } from '@/components/Thread';

import Image from './Image';
import Text from './Text';

interface ExtraProps extends IMessageCommons {
  message?: ITextMessage;
  image_url?: IImageMessage['image_url'];
}

type MessageProps = ExtraProps & UserInfo['user' | 'assistant'] & (ITextMessage | IImageMessage);

const Message = ({
  name,
  messageClassNames,
  avatarImageSrc,
  type,
  content,
  image_url: image,
  role,
  metadata: { model },
}: MessageProps) => {
  const shouldReduceMotion = useReducedMotion();
  const isImage = type === 'image_url';
  const isUser = role === 'user';
  const chatOrigin = isUser ? 'origin-right' : 'origin-left';

  return (
    <motion.article
      initial={shouldReduceMotion ? false : { opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: 'easeOut' }}
      className={clsx('chat relative my-5 flex w-full min-w-0 scroll-mb-10', chatOrigin)}
      data-type={type}>
      <div
        className={clsx(
          'min-w-0',
          isUser ? 'ml-auto max-w-[min(92%,46rem)]' : 'w-full max-w-[52rem]'
        )}>
        <div
          className={clsx('flex min-w-0 items-start gap-2 sm:gap-3', isUser && 'flex-row-reverse')}>
          {/* Name and User or Variation Image */}
          {!isImage && (
            <div className="flex w-9 shrink-0 flex-col items-center justify-center gap-1 sm:w-14">
              <div className="size-8 overflow-hidden rounded-full border border-border bg-muted sm:size-10">
                <img
                  className="size-full object-cover"
                  src={avatarImageSrc}
                  alt={name || (isUser ? 'You' : 'Assistant')}
                  height={40}
                  width={40}
                />
              </div>
              <span className="hidden w-14 truncate text-center text-xs text-muted-foreground capitalize sm:block">
                {name}
              </span>
            </div>
          )}
          {/* Image or Message */}
          {isImage && image && image.size ? (
            <Image key={image.url} image={image} />
          ) : (
            <Text isUser={isUser} messageClassNames={messageClassNames} message={content} />
          )}
        </div>
        {/* Time */}
        <div
          className={clsx(
            'flex items-center gap-x-1 pt-1.5 text-xs text-muted-foreground',
            isUser ? 'justify-end' : 'justify-start',
            !isImage && (isUser ? 'pr-11 sm:pr-[4.25rem]' : 'pl-11 sm:pl-[4.25rem]')
          )}>
          {model}
        </div>
      </div>
    </motion.article>
  );
};

export default Message;
