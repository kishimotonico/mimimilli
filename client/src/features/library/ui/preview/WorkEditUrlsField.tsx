import type { UrlEntry } from "@mimimilli/shared";
import Button from "../../../../shared/ui/Button";
import IconButton from "../../../../shared/ui/IconButton";
import { I } from "../../../../shared/ui/Icon";
import TextInput from "../../../../shared/ui/TextInput";

interface WorkEditUrlsFieldProps {
  urls: UrlEntry[];
  disabled: boolean;
  firstInputRef: React.Ref<HTMLInputElement>;
  onChange: (urls: UrlEntry[]) => void;
}

export function WorkEditUrlsField({
  urls,
  disabled,
  firstInputRef,
  onChange,
}: WorkEditUrlsFieldProps) {
  const updateEntry = (index: number, patch: Partial<UrlEntry>) =>
    onChange(urls.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <>
      {urls.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <TextInput
            ref={index === 0 ? firstInputRef : undefined}
            font="jp"
            value={entry.label}
            aria-label={`URLラベル ${index + 1}`}
            placeholder="ラベル"
            disabled={disabled}
            onChange={(event) => updateEntry(index, { label: event.target.value })}
          />
          <TextInput
            font="mono"
            value={entry.url}
            aria-label={`URL ${index + 1}`}
            placeholder="https://"
            disabled={disabled}
            onChange={(event) => updateEntry(index, { url: event.target.value })}
          />
          <IconButton
            icon={I.x}
            label={`URL ${index + 1} を削除`}
            size="xs"
            disabled={disabled}
            onClick={() => onChange(urls.filter((_, i) => i !== index))}
          />
        </div>
      ))}
      <div>
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          onClick={() => onChange([...urls, { label: "", url: "" }])}
        >
          URLを追加
        </Button>
      </div>
    </>
  );
}
