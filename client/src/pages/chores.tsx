import { Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChoresPageProps {
  onSleep: () => void;
}

export default function ChoresPage({ onSleep }: ChoresPageProps) {
  return (
    <div className="h-full flex flex-col" style={{ background: "var(--rb-canvas)" }}>
      <header className="bg-white px-7 py-3 flex items-center justify-between">
        <h1 className="text-[30px] font-extrabold tracking-tight text-[#2b3038] leading-none">Chores</h1>
        <Button
          variant="ghost"
          size="sm"
          className="touch-button h-[46px] px-5 rounded-full bg-[var(--rb-chip)] hover:bg-[var(--rb-chip-hover)] text-[#5b626d] text-base font-bold"
          onClick={onSleep}
          data-testid="button-sleep"
        >
          <Moon className="mr-1.5" size={20} />
          Sleep
        </Button>
      </header>

      <div className="flex-1 flex items-center justify-center">
        <p className="text-base font-semibold text-[var(--rb-muted)]">
          Chores are coming soon — designs in progress
        </p>
      </div>
    </div>
  );
}
