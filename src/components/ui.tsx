"use client";

import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

export const BRAND = "#DC0000";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-gray-200 mb-1.5">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-gray-500 mt-1.5">{hint}</span> : null}
    </label>
  );
}

const inputBase =
  "w-full rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-colors placeholder:text-gray-600";

const inputStyle = {
  background: "#161616",
  border: "1px solid rgba(255,255,255,0.14)",
} as const;

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (
    <input
      {...rest}
      className={`${inputBase} ${className}`}
      style={inputStyle}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = BRAND;
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
        props.onBlur?.(e);
      }}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return (
    <textarea
      {...rest}
      className={`${inputBase} resize-y ${className}`}
      style={inputStyle}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = BRAND;
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
        props.onBlur?.(e);
      }}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl p-6 ${className}`}
      style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      {children}
    </div>
  );
}

export function SectionHeader({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl sm:text-3xl font-black text-white">{title}</h1>
      <p className="text-gray-400 text-sm mt-1.5">{blurb}</p>
    </div>
  );
}

export function IconBtn({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30"
      style={{
        background: "#1d1d1d",
        border: "1px solid rgba(255,255,255,0.12)",
        color: danger ? "#ff6b6b" : "#d1d5db",
      }}
    >
      {children}
    </button>
  );
}
