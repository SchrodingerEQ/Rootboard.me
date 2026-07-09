import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { CHORE_CAP, PERSON_PALETTE, type Person } from "@/lib/chores-state";
import { ChoreCardStack } from "./chore-card-stack";

interface PersonColumnProps {
  person: Person;
  onToggleChore: (choreId: string) => void;
  onAddChore: (title: string) => void;
}

export function PersonColumn({ person, onToggleChore, onAddChore }: PersonColumnProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const pal = PERSON_PALETTE[person.colorIdx % PERSON_PALETTE.length];
  const initials = person.name.slice(0, 2).toUpperCase();
  const activeCount = person.chores.filter((c) => !c.done).length;
  const countLabel = activeCount === 0 ? "All done!" : `${activeCount} left`;
  const atCap = person.chores.length >= CHORE_CAP;

  const confirmAdd = () => {
    const title = draft.trim();
    if (!title) return;
    onAddChore(title);
    setDraft("");
    setIsAdding(false);
  };

  return (
    <div
      className="flex-1 min-w-0 flex flex-col overflow-hidden"
      style={{ background: pal.tint, borderRadius: 20, padding: "18px 16px 16px" }}
      data-testid={`chores-column-${person.id}`}
    >
      <div className="flex items-center gap-3" style={{ padding: "0 6px 16px" }}>
        <span
          className="flex items-center justify-center rounded-full text-white flex-shrink-0"
          style={{ width: 44, height: 44, background: pal.color, fontSize: 17, fontWeight: 800 }}
        >
          {initials}
        </span>
        <span
          className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
          style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.3px", color: pal.text }}
        >
          {person.name}
        </span>
        <div className="flex flex-col items-end gap-1">
          <span
            className="whitespace-nowrap rounded-full"
            style={{ fontSize: 15, fontWeight: 800, color: pal.text, background: "rgba(255,255,255,.6)", padding: "4px 13px" }}
            data-testid={`chip-left-${person.id}`}
          >
            {countLabel}
          </span>
          <span
            className="flex items-center gap-1.5 whitespace-nowrap rounded-full text-white"
            style={{ fontSize: 14, fontWeight: 800, background: pal.color, padding: "4px 13px" }}
            data-testid={`chip-done-today-${person.id}`}
          >
            <Check size={13} strokeWidth={3.2} />
            {person.doneToday} today
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <ChoreCardStack chores={person.chores} color={pal.color} onToggle={onToggleChore} />

        {atCap ? (
          <div
            className="w-full flex items-center justify-center"
            style={{ marginTop: 4, height: 50, fontSize: 16, fontWeight: 700, color: pal.text, opacity: 0.55 }}
            data-testid={`hint-chore-cap-${person.id}`}
          >
            {CHORE_CAP} chores max — use Reset chores to clear the list
          </div>
        ) : isAdding ? (
          <div className="flex gap-2" style={{ marginTop: 4 }}>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmAdd();
                if (e.key === "Escape") {
                  setIsAdding(false);
                  setDraft("");
                }
              }}
              autoFocus
              placeholder="New chore…"
              className="flex-1 min-w-0 outline-none bg-white"
              style={{ height: 54, border: "2px solid rgba(255,255,255,.9)", borderRadius: 14, padding: "0 16px", fontSize: 18, fontWeight: 600, color: "#2b3038" }}
              data-testid={`input-new-chore-${person.id}`}
            />
            <button
              type="button"
              onClick={confirmAdd}
              className="touch-button flex-shrink-0 flex items-center justify-center text-white"
              style={{ width: 54, height: 54, border: "none", borderRadius: 14, background: pal.color }}
              data-testid={`button-confirm-chore-${person.id}`}
            >
              <Check size={22} strokeWidth={2.8} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="touch-button w-full flex items-center justify-center gap-2 opacity-65 hover:opacity-100 hover:bg-white/50"
            style={{ marginTop: 4, height: 50, border: "none", background: "transparent", borderRadius: 14, fontSize: 17, fontWeight: 800, color: pal.text }}
            data-testid={`button-add-chore-${person.id}`}
          >
            <Plus size={18} strokeWidth={2.8} />
            Add chore
          </button>
        )}
      </div>
    </div>
  );
}
