import { Check, Copy } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"

/** A read-only URL, its label inline before it and a Copy button after. */
export function CopyUrl({ label, url }: { label: string; url: string }) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // Clipboard blocked: select the URL so it can be copied by hand
      input.current?.select()
    }
  }

  return (
    <InputGroup className="max-w-2xl flex-1">
      <InputGroupAddon>
        <label htmlFor={id} className="font-semibold text-foreground">
          {label}
        </label>
      </InputGroupAddon>
      <InputGroupInput
        id={id}
        ref={input}
        readOnly
        value={url}
        onFocus={(event) => event.target.select()}
        className="font-mono"
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton onClick={copy}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
