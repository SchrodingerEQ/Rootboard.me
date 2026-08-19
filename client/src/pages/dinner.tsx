import { useEffect, useState } from "react";
import { List, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VotingStrip } from "@/components/dinner/voting-strip";
import { PlannerGrid } from "@/components/dinner/planner-grid";
import { MealPickerDialog } from "@/components/dinner/meal-picker-dialog";
import { MealListDialog } from "@/components/dinner/meal-list-dialog";
import { ResetVotesDialog } from "@/components/dinner/reset-votes-dialog";
import type { UseDinnerReturn } from "@/hooks/use-dinner";
import { dateKeyToDate, localDateKey } from "@/lib/dinner-state";

interface DinnerPageProps {
  onSleep: () => void;
  dinner: UseDinnerReturn;
}

type ActiveModal = { kind: "add-vote" } | { kind: "add-day"; dateKey: string } | null;
const DATE_TICK_MS = 60_000;

export default function DinnerPage({ onSleep, dinner }: DinnerPageProps) {
  const {
    isLoaded,
    candidates,
    savedMeals,
    dinners,
    cooldownActive,
    cooldownSeconds,
    onVote,
    onResetVotes,
    onAddCandidate,
    onAddSavedMeal,
    onRemoveSavedMeal,
    onSetDinner,
    onRemoveDinner,
  } = dinner;

  const [modal, setModal] = useState<ActiveModal>(null);
  const [listOpen, setListOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  // Sitting on the Dinner screen across midnight otherwise leaves the
  // "Today" ring on yesterday until something else happens to re-render
  // (the weekly purge tick deliberately returns the same reference most
  // days). Cheap 60s poll, only setState when the local date actually
  // changed, so this re-renders exactly once at midnight.
  const [todayKey, setTodayKey] = useState(() => localDateKey());
  useEffect(() => {
    const id = setInterval(() => {
      const next = localDateKey();
      setTodayKey((prev) => (prev === next ? prev : next));
    }, DATE_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const pickerTitle =
    modal?.kind === "add-day"
      ? (() => {
          const d = dateKeyToDate(modal.dateKey);
          return `Dinner for ${d.toLocaleDateString("en-US", { weekday: "short" })}, ${d.toLocaleDateString("en-US", { month: "short" })} ${d.getDate()}`;
        })()
      : "Add a meal for voting";
  const canRemoveDinner = modal?.kind === "add-day" && Boolean(dinners[modal.dateKey]);

  const handlePick = (title: string) => {
    if (modal?.kind === "add-vote") onAddCandidate(title);
    else if (modal?.kind === "add-day") onSetDinner(modal.dateKey, title);
  };

  const handleRemoveDinner = () => {
    if (modal?.kind === "add-day") onRemoveDinner(modal.dateKey);
  };

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--rb-canvas)" }}>
      <header
        className="bg-rb-surface flex items-center justify-between"
        style={{ padding: "18px 28px", boxShadow: "0 1px 0 var(--rb-shadow-soft)" }}
      >
        <div className="flex items-baseline gap-3">
          <h1 className="text-[30px] font-extrabold tracking-tight text-rb-ink leading-none">Dinner</h1>
          <span style={{ fontSize: 20, fontWeight: 500, color: "var(--rb-muted)" }}>{dateLabel}</span>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="touch-button h-[46px] px-5 rounded-full bg-[var(--rb-chip)] hover:bg-[var(--rb-chip-hover)] text-rb-ink-secondary text-base font-bold"
            onClick={() => setListOpen(true)}
            data-testid="button-edit-meal-list"
          >
            <List className="mr-1.5" size={20} />
            Edit meal list
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="touch-button h-[46px] px-5 rounded-full bg-[var(--rb-chip)] hover:bg-[var(--rb-chip-hover)] text-rb-ink-secondary text-base font-bold"
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
          <span style={{ fontSize: 18, fontWeight: 600, color: "var(--rb-muted)" }}>Loading dinner…</span>
        </div>
      ) : (
        <>
          <VotingStrip
            candidates={candidates}
            cooldownActive={cooldownActive}
            cooldownSeconds={cooldownSeconds}
            onVote={onVote}
            onAddSlot={() => setModal({ kind: "add-vote" })}
            onResetAsk={() => setResetOpen(true)}
          />
          <PlannerGrid todayKey={todayKey} dinners={dinners} onDayClick={(dateKey) => setModal({ kind: "add-day", dateKey })} />
        </>
      )}

      <MealPickerDialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
        title={pickerTitle}
        savedMeals={savedMeals}
        onPick={handlePick}
        canRemoveDinner={canRemoveDinner}
        onRemoveDinner={handleRemoveDinner}
      />

      <MealListDialog
        open={listOpen}
        onOpenChange={setListOpen}
        savedMeals={savedMeals}
        onAdd={onAddSavedMeal}
        onRemove={onRemoveSavedMeal}
      />

      <ResetVotesDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        onConfirm={() => {
          onResetVotes();
          setResetOpen(false);
        }}
      />
    </div>
  );
}
