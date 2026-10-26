import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react';

/** Drag distance (px) or release speed (px/s) that dismisses the sheet. */
const DISMISS_OFFSET = 120;
const DISMISS_VELOCITY = 500;

interface SuiteReportPanelProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A sheet that covers the compare page below the navbar. It rises from the bottom and leaves the
 * same way; a critically damped spring keeps a swipe's velocity, so dragging the handle down and
 * letting go carries straight into the exit. The page underneath is made inert by the caller.
 */
const SuiteReportPanel = ({ open, onClose, children }: SuiteReportPanelProps) => {
  const shouldReduceMotion = useReducedMotion();
  const dragControls = useDragControls();
  const panelRef = useRef<HTMLElement>(null);

  // Focus moves into the sheet and returns to whatever opened it.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus({ preventScroll: true });
    return () => previous?.focus({ preventScroll: true });
  }, [open]);

  const transition = shouldReduceMotion
    ? { duration: 0.2, ease: [0.23, 1, 0.32, 1] as const }
    : { type: 'spring' as const, bounce: 0, duration: 0.4 };

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          key="suite-report"
          ref={panelRef}
          role="dialog"
          aria-label="Suite results"
          tabIndex={-1}
          className="absolute inset-0 z-30 flex min-h-0 min-w-0 flex-col bg-background outline-none"
          initial={shouldReduceMotion ? { opacity: 0 } : { y: '100%' }}
          animate={shouldReduceMotion ? { opacity: 1 } : { y: 0 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { y: '100%' }}
          transition={transition}
          drag={shouldReduceMotion ? false : 'y'}
          dragListener={false}
          dragControls={dragControls}
          dragConstraints={{ top: 0, bottom: 0 }}
          // Pulling up meets firm resistance; pulling down follows the finger.
          dragElastic={{ top: 0.05, bottom: 0.9 }}
          onDragEnd={(_, { offset, velocity }) => {
            if (offset.y > DISMISS_OFFSET || velocity.y > DISMISS_VELOCITY) onClose();
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            event.stopPropagation();
            onClose();
          }}>
          {/* The grab handle is the only drag surface, so the report itself scrolls normally. */}
          <div
            aria-hidden="true"
            onPointerDown={(event) => dragControls.start(event)}
            // A full-width, 36px-tall strip: easy to catch with a thumb, small on screen.
            className="flex h-9 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing">
            <span className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
          </div>
          {children}
        </motion.section>
      )}
    </AnimatePresence>
  );
};

export default SuiteReportPanel;
