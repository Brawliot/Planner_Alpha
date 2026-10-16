"use client";

import { useState, type FormEvent } from "react";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function PromptForm() {
  const [text, setText] = useState("");
  const [sent, setSent] = useState<string | null>(null);

  const trimmed = text.trim();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;

    // TODO: conectar con Server Action (validar en servidor, requireUser)
    setSent(value);
    setText("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
      <Field
        label="Mensaje"
        name="mensaje"
        value={text}
        onChange={(e) => setText(e.target.value)}
        required
        maxLength={2000}
        autoComplete="off"
        className="w-full"
      />
      <Button type="submit" variant="primary" disabled={!trimmed} className="self-end">
        Enviar
      </Button>
      <p aria-live="polite" className="break-words text-sm">
        {sent !== null && <>Último envío: {sent}</>}
      </p>
    </form>
  );
}