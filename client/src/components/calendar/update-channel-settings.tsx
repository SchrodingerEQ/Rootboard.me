import { APP_VERSION } from "@shared/version";
import { isPrereleaseVersion, type UpdateChannel } from "@shared/release-version";
import { Button } from "@/components/ui/button";

interface UpdateChannelSettingsProps {
  /** The channel the server follows (dashboard.json `update`, else env, else
   *  stable). Undefined while unknown: nothing is shown as selected. */
  channel: UpdateChannel | undefined;
  onChange: (channel: UpdateChannel) => void;
}

const OPTIONS: { value: UpdateChannel; label: string }[] = [
  { value: "stable", label: "Stable" },
  { value: "beta", label: "Beta" },
];

/**
 * Settings → System → Updates (beta-launch brief 08, decision 0022): which
 * releases this kiosk updates to. Saved to data/config/dashboard.json, so
 * it survives updates. Switching to Stable never downgrades: a beta build
 * stays until a stable release is newer.
 */
export function UpdateChannelSettings({ channel, onChange }: UpdateChannelSettingsProps) {
  const onBetaBuild = isPrereleaseVersion(APP_VERSION);
  return (
    <div className="space-y-1.5 pt-1" data-testid="update-channel">
      <p className="text-xs text-rb-muted leading-snug">Release channel</p>
      {/* 44px-tall buttons: kiosk touch targets. */}
      <div className="flex gap-1.5">
        {OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            size="sm"
            variant={channel === opt.value ? "default" : "outline"}
            className="flex-1 h-11"
            aria-pressed={channel === opt.value}
            onClick={() => channel !== opt.value && onChange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-rb-faint leading-snug">
        Beta gets fixes a few days earlier and may have rough edges.
      </p>
      {channel === "stable" && onBetaBuild && (
        <p className="text-xs text-rb-muted leading-snug" data-testid="update-channel-beta-build">
          This kiosk is running beta {APP_VERSION}. It stays on it until a newer stable release comes out.
        </p>
      )}
    </div>
  );
}
