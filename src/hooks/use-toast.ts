import { toast as sonnerToast } from "sonner";

export type ToastVariant = "default" | "destructive" | "success";

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  className?: string;
  duration?: number;
}

export function toast({ title, description, variant, className, duration }: ToastOptions) {
  const message = title ? (
    <div className="space-y-1">
      <div className="font-semibold">{title}</div>
      {description ? <div className="text-sm opacity-90">{description}</div> : null}
    </div>
  ) : (
    description
  );

  const baseClass =
    variant === "destructive"
      ? "bg-destructive text-destructive-foreground border-none"
      : variant === "success"
        ? "bg-success text-success-foreground border-none"
        : className;

  sonnerToast(message, {
    className: baseClass,
    duration,
  });
}

export function useToast() {
  return {
    toast,
    dismiss: sonnerToast.dismiss,
  };
}

export { toast };
