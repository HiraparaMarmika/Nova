"use client";

import { useId, useState } from "react";
import type { InputHTMLAttributes } from "react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  error?: string;
};

export function PasswordInput({ label, error, id, className, ...props }: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  return <div className={`field ${className ?? ""}`.trim()}>
    <label htmlFor={inputId}>{label}</label>
    <div className="password-control">
      <input {...props} id={inputId} type={visible ? "text" : "password"} aria-invalid={Boolean(error)} />
      <button type="button" className="password-toggle" onClick={() => setVisible(value => !value)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}>
        {visible ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 4.2A10.7 10.7 0 0112 4c5.5 0 9 5.5 9 5.5a16.8 16.8 0 01-2.3 2.8M6.2 6.2C4.2 7.5 3 9.5 3 9.5S6.5 15 12 15c1 0 1.9-.2 2.7-.4" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.5-5.5 9-5.5 9 5.5 9 5.5-3.5 5.5-9 5.5S3 12 3 12z" /><circle cx="12" cy="12" r="2.5" /></svg>}
      </button>
    </div>
    {error && <p className="field-error" role="alert">{error}</p>}
  </div>;
}
