import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SideSheetProps {
  open: boolean
  onClose: () => void
  title: string
  /** Width on desktop (sm+), e.g. "80%" or "40%". Mobile is always 100%. */
  desktopWidth?: string
  /** If true the panel covers the entire viewport (no border-l, no maxWidth cap). */
  fullscreen?: boolean
  children: ReactNode
  footer?: ReactNode
}

export function SideSheet({
  open,
  onClose,
  title,
  desktopWidth = '80%',
  fullscreen = false,
  children,
  footer,
}: SideSheetProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={`fixed right-0 inset-y-0 z-50 flex w-full flex-col bg-background shadow-2xl${fullscreen ? '' : ' border-l'}`}
            style={fullscreen ? undefined : { maxWidth: `min(100vw, ${desktopWidth})` }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold leading-none">{title}</h2>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Schließen">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="shrink-0 border-t bg-background px-6 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
