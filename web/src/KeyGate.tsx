import {
  Button,
  Description,
  FieldError,
  Input,
  Label,
  TextField,
} from "@heroui/react";
import { useState, type FormEvent } from "react";
import { saveApiKey } from "./api";
import { Shell } from "./Shell";

interface Props {
  onSaved: () => void;
  onBrowseSample: () => void;
  sampleBusy: boolean;
}

export function KeyGate({ onSaved, onBrowseSample, sampleBusy }: Props) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveApiKey(key);
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save the key. Check it and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell centered plate="Setup">
      <div className="enter text-center">
        <h1 className="mt-0 mb-3 text-[clamp(2rem,5vw,2.75rem)] leading-[1.1] font-semibold tracking-tight">
          <span className="text-accent">OpenReach</span>
        </h1>
        <p className="text-muted mx-auto mb-8 max-w-md text-pretty">
          Reach for papers that weren’t there before. Paste your TypeSafe key to
          rank by meaning. We do not store the key on our servers — it stays on
          this device.
        </p>
      </div>

      <div className="enter enter-1 search-shell p-5">
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <TextField
            autoFocus
            className="w-full"
            fullWidth
            isInvalid={Boolean(error)}
            name="typesafe-key"
            type="password"
            value={key}
            onChange={setKey}
          >
            <Label>TypeSafe key</Label>
            <Input
              autoComplete="off"
              className="min-w-0"
              placeholder="Paste your TypeSafe key"
              spellCheck={false}
            />
            <Description>
              Saved in this browser only. Short fragments are rejected. Use the
              full key from the TypeSafe console.
            </Description>
            {error ? <FieldError>{error}</FieldError> : null}
          </TextField>
          <div className="keygate-actions flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <Button className="pressable min-h-11 w-full sm:flex-1" isPending={busy} type="submit">
              {busy ? "Saving key…" : "Continue"}
            </Button>
            <Button
              className="pressable min-h-11 w-full sm:flex-1"
              isDisabled={sampleBusy}
              isPending={sampleBusy}
              type="button"
              variant="outline"
              onPress={() => onBrowseSample()}
            >
              {sampleBusy ? "Loading sample…" : "Browse sample results"}
            </Button>
          </div>
        </form>
        <p className="text-muted mt-5 mb-0 text-center text-sm text-pretty">
          Don’t have a key yet?{" "}
          <a
            className="text-accent underline-offset-2 hover:underline"
            href="https://console.typesafe.ai/settings/keys"
            rel="noreferrer"
            target="_blank"
          >
            Get a TypeSafe key
          </a>{" "}
          from the console.
        </p>
      </div>
    </Shell>
  );
}
