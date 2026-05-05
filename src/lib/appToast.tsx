/**
 * Application-wide toast notifications (react-hot-toast).
 * API mirrors the previous sonner usage: success/error/info/message + optional description & duration.
 */
import toastHot, { Toaster as HotToaster } from 'react-hot-toast';

export type AppToastOptions = {
  description?: string;
  duration?: number;
};

function renderContent(title: string, opts?: AppToastOptions) {
  if (!opts?.description) return title;
  return (
    <div className="text-left text-sm max-w-[min(100vw-2rem,22rem)]" role="status">
      <p className="font-semibold text-foreground leading-snug">{title}</p>
      <p className="mt-1.5 text-muted-foreground text-[13px] leading-snug">{opts.description}</p>
    </div>
  );
}

export const toast = {
  success(message: string, opts?: AppToastOptions): string {
    return toastHot.success(renderContent(message, opts), {
      duration: opts?.duration ?? 5000,
    });
  },

  error(message: string, opts?: AppToastOptions): string {
    return toastHot.error(renderContent(message, opts), {
      duration: opts?.duration ?? 8000,
    });
  },

  /** Neutral / informational (no green/red semantic). */
  message(msg: string, opts?: AppToastOptions): string {
    return toastHot(renderContent(msg, opts), {
      duration: opts?.duration ?? 5000,
      icon: 'ℹ️',
    });
  },

  info(message: string, opts?: AppToastOptions): string {
    return toastHot(renderContent(message, opts), {
      duration: opts?.duration ?? 5500,
      icon: 'ℹ️',
    });
  },

  warning(message: string, opts?: AppToastOptions): string {
    return toastHot(renderContent(message, opts), {
      duration: opts?.duration ?? 6500,
      icon: '⚠️',
    });
  },

  loading(message: string): string {
    return toastHot.loading(message);
  },

  dismiss(id?: string): void {
    toastHot.dismiss(id);
  },

  promise<T>(
    promise: Promise<T>,
    msgs: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: unknown) => string);
    },
    opts?: { success?: AppToastOptions; error?: AppToastOptions }
  ): Promise<T> {
    return toastHot.promise(promise, {
      loading: msgs.loading,
      success: (d) => {
        const text = typeof msgs.success === 'function' ? msgs.success(d) : msgs.success;
        return renderContent(text, opts?.success);
      },
      error: (e) => {
        const text = typeof msgs.error === 'function' ? msgs.error(e) : msgs.error;
        return renderContent(text, opts?.error);
      },
    });
  },
};

export function Toaster() {
  return (
    <HotToaster
      position="top-center"
      gutter={10}
      containerStyle={{ top: 12 }}
      toastOptions={{
        duration: 5000,
        className:
          '!bg-background !text-foreground !border !border-border !shadow-md !rounded-lg !px-4 !py-3',
        style: { maxWidth: 'min(100vw - 1.5rem, 22rem)' },
        success: {
          duration: 5000,
          className:
            '!bg-background !text-foreground !border !border-emerald-500/35 !shadow-md !rounded-lg !px-4 !py-3',
          iconTheme: { primary: '#15803d', secondary: '#fff' },
        },
        error: {
          duration: 8000,
          className:
            '!bg-background !text-foreground !border !border-red-500/40 !shadow-md !rounded-lg !px-4 !py-3',
          iconTheme: { primary: '#b91c1c', secondary: '#fff' },
        },
        loading: {
          className: '!bg-background !text-foreground !border !border-border !shadow-md !rounded-lg !px-4 !py-3',
        },
      }}
    />
  );
}
