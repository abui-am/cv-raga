"use client";
import {
  cloneElement,
  isValidElement,
  useId,
  type ComponentProps,
  type ReactNode,
} from "react";
import { AlertCircle, ArrowUpRight, LoaderCircle, Plus } from "lucide-react";

export const buttonClass =
  "inline-flex min-h-control items-center justify-center gap-2 rounded-control px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
export function Button({
  variant = "primary",
  busy,
  className = "",
  children,
  ...props
}: ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "quiet" | "danger";
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || busy}
      className={`${buttonClass} ${variant === "primary" ? "bg-primary text-primary-foreground hover:bg-primary-hover" : variant === "secondary" ? "border border-border bg-card hover:bg-muted" : variant === "danger" ? "text-destructive hover:bg-destructive/5" : "text-muted-foreground hover:bg-muted hover:text-foreground"} ${className}`}
    >
      {busy && (
        <LoaderCircle
          aria-hidden="true"
          size={16}
          className="animate-spin motion-reduce:animate-none"
        />
      )}
      {children}
    </button>
  );
}
export const inputClass =
  "min-h-control w-full rounded-control border border-input bg-card px-3 py-2 text-base text-foreground placeholder:text-muted-foreground/80 disabled:bg-muted";
export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${inputClass} ${className}`} {...props} />;
}
export function Textarea({
  className = "",
  ...props
}: ComponentProps<"textarea">) {
  return (
    <textarea
      rows={4}
      className={`${inputClass} leading-relaxed ${className}`}
      {...props}
    />
  );
}
export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select className={`${inputClass} ${className}`} {...props} />;
}
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  const generatedId = useId();
  type ControlProps = {
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  };
  if (!isValidElement<ControlProps>(children))
    throw new Error("Field requires one form control");
  const id = children.props.id || generatedId;
  const describedBy =
    [
      children.props["aria-describedby"],
      hint ? `${id}-hint` : "",
      error ? `${id}-error` : "",
    ]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div className="flex min-w-0 flex-col gap-2 text-sm font-medium">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {hint && (
        <span
          id={`${id}-hint`}
          className="text-xs font-normal leading-relaxed text-muted-foreground"
        >
          {hint}
        </span>
      )}
      {error && (
        <span
          id={`${id}-error`}
          role="alert"
          className="text-sm font-normal text-destructive"
        >
          {error}
        </span>
      )}
    </div>
  );
}
export function Panel({
  children,
  className = "",
  ...props
}: ComponentProps<"section">) {
  return (
    <section
      className={`rounded-panel border border-border bg-card p-5 md:p-6 ${className}`}
      {...props}
    >
      {children}
    </section>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warning";
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${tone === "good" ? "bg-success text-success-foreground" : tone === "warning" ? "bg-warning text-warning-foreground" : "bg-muted text-muted-foreground"}`}
    >
      {children}
    </span>
  );
}
export function ErrorNotice({ error }: { error?: Error | null }) {
  return error ? (
    <div
      role="alert"
      className="my-4 flex items-start gap-3 rounded-control border border-destructive/25 bg-destructive/5 p-4 text-sm leading-relaxed text-destructive"
    >
      <AlertCircle size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span>{error.message}</span>
    </div>
  ) : null;
}
export function Loading({
  label = "Loading your workspace…",
}: {
  label?: string;
}) {
  return (
    <div
      role="status"
      className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted-foreground"
    >
      <LoaderCircle
        size={18}
        aria-hidden="true"
        className="animate-spin motion-reduce:animate-none"
      />
      {label}
    </div>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-panel border border-dashed border-border bg-card px-6 py-12 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-panel bg-accent text-primary">
        <Plus aria-hidden="true" size={22} />
      </div>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          {eyebrow}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
export function RowArrow() {
  return (
    <ArrowUpRight
      size={18}
      aria-hidden="true"
      className="shrink-0 text-muted-foreground"
    />
  );
}
export function Saved({ show }: { show: boolean }) {
  return show ? (
    <p role="status" className="text-sm text-primary">
      Saved to your workspace.
    </p>
  ) : null;
}
