import { useEffect, useRef, useState } from "react";
import { Moon, RotateCcw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PersonColumn } from "@/components/chores/person-column";
import { EditPeople } from "@/components/chores/edit-people";
import { ResetConfirmDialog } from "@/components/chores/reset-confirm-dialog";
import type { UseChoresReturn } from "@/hooks/use-chores";

interface ChoresPageProps {
  onSleep: () => void;
  chores: UseChoresReturn;
}

export default function ChoresPage({ onSleep, chores }: ChoresPageProps) {
  const {
    people,
    isLoaded,
    doneTodayTotal,
    totalChoreCount,
    onToggleChore,
    onAddChore,
    onAddPerson,
    onRemovePerson,
    onRenamePerson,
    onSetPersonColor,
    onResetChores,
  } = chores;

  const [isSetup, setIsSetup] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  // Setup mode replaces the board when toggled AND is the automatic
  // first-run state once state has loaded and nobody has been added yet.
  // This only fires ONCE right after load — otherwise, adding the very
  // first person (people.length: 0 -> 1) would immediately compute
  // showSetup back to false and boot the user out mid-setup, before they
  // could add a second person or leave via "Done".
  const autoSetupChecked = useRef(false);
  useEffect(() => {
    if (isLoaded && !autoSetupChecked.current) {
      autoSetupChecked.current = true;
      if (people.length === 0) setIsSetup(true);
    }
  }, [isLoaded, people.length]);

  const showSetup = isSetup;

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--rb-canvas)" }}>
      <header
        className="bg-white px-7 py-3 flex items-center justify-between"
        style={{ boxShadow: "0 1px 0 rgba(0,0,0,.05)" }}
      >
        <div className="flex items-baseline gap-3">
          <h1 className="text-[30px] font-extrabold tracking-tight text-[#2b3038] leading-none">Chores</h1>
          <span style={{ fontSize: 20, fontWeight: 500, color: "var(--rb-muted)" }}>{dateLabel}</span>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2"
            style={{ background: "var(--rb-chip)", padding: "9px 18px", borderRadius: 999 }}
            data-testid="chip-progress"
          >
            <span className="rounded-full" style={{ width: 10, height: 10, background: "#16a34a" }} />
            <span style={{ fontSize: 17, fontWeight: 700, color: "#3a4049" }}>
              {doneTodayTotal} of {totalChoreCount} done today
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="touch-button h-[46px] px-5 rounded-full bg-[var(--rb-chip)] hover:bg-[var(--rb-chip-hover)] text-[#5b626d] text-base font-bold"
            onClick={() => setIsSetup(true)}
            data-testid="button-edit-people"
          >
            <Users className="mr-1.5" size={20} />
            Edit people
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="touch-button h-[46px] px-5 rounded-full bg-white hover:bg-[#fce4ea] text-base font-extrabold"
            style={{ boxShadow: "inset 0 0 0 2px #fce4ea", color: "#e11d48" }}
            onClick={() => setResetOpen(true)}
            data-testid="button-reset-chores"
          >
            <RotateCcw className="mr-1.5" size={19} />
            Reset chores
          </Button>

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
        </div>
      </header>

      {!isLoaded ? (
        <div className="flex-1 flex items-center justify-center">
          <span style={{ fontSize: 18, fontWeight: 600, color: "var(--rb-muted)" }}>
            Loading chores…
          </span>
        </div>
      ) : showSetup ? (
        <EditPeople
          people={people}
          onAddPerson={onAddPerson}
          onRemovePerson={onRemovePerson}
          onRenamePerson={onRenamePerson}
          onSetPersonColor={onSetPersonColor}
          onDone={() => setIsSetup(false)}
        />
      ) : (
        <div className="flex-1 flex overflow-hidden" style={{ gap: 16, padding: "22px 24px 24px" }}>
          {people.map((p) => (
            <PersonColumn
              key={p.id}
              person={p}
              onToggleChore={(choreId) => onToggleChore(p.id, choreId)}
              onAddChore={(title) => onAddChore(p.id, title)}
            />
          ))}
        </div>
      )}

      <ResetConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        onConfirm={() => {
          onResetChores();
          setResetOpen(false);
        }}
      />
    </div>
  );
}
