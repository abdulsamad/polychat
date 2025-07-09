import { motion } from 'motion/react';
import clsx from 'clsx';

import { IMessageCommons, ITextMessage, IImageMessage } from '@/store';
import { UserInfo } from '@/components/Thread';

import Image from './Image';
import Text from './Text';

interface ExtraProps extends IMessageCommons {
  message?: ITextMessage;
  image?: IImageMessage['image_url'];
}

type MessageProps = ExtraProps & UserInfo['user' | 'assistant'] & (ITextMessage | IImageMessage);

const Message = ({
  name,
  messageClassNames,
  avatarImageSrc,
  type,
  content,
  image,
  role,
  metadata: { model },
}: MessageProps) => {
  const isImage = type === 'image_url';
  const isUser = role === 'user';

  // Contional classes
  const modelNameMargin = isUser ? 'mr-[85px]' : 'ml-[75px]';
  const chatOrigin = isUser ? 'origin-right' : 'origin-left';

  return (
    <motion.div
      // initial={isUser ? { translateY: '10px', scaleX: 0.5 } : { translateY: '-10px', scaleX: 0.5 }}
      animate={{ translateY: 0, scaleX: 1 }}
      className={clsx('chat relative flex my-4 scroll-mb-10', chatOrigin)}
      data-type={type}
      // layout
    >
      <div className={`${isUser ? 'ml-auto' : ''}`}>
        <div
          className={clsx('flex justify-start items-center gap-x-3', isUser && 'flex-row-reverse')}>
          {/* Name and User or Variation Image */}
          {!isImage && (
            <div className="flex flex-col items-center justify-center gap-1">
              <div className="min-w-[40px] rounded-[999px] overflow-hidden">
                <img src={avatarImageSrc} alt={name!} height={40} width={40} />
              </div>
              {!isImage && (
                <span className="text-xs w-[70px] capitalize truncate text-center overflow-hidden">
                  {name}
                </span>
              )}
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
            'flex items-center gap-x-1 pt-2 pl-2 text-sm',
            isUser ? 'justify-end' : 'justify-start',
            isImage ? 'mb-1' : modelNameMargin
          )}>
          {model as string}
        </div>
      </div>
    </motion.div>
  );
};

export default Message;
