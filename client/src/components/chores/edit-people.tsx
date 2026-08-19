import { useState } from "react";
import { Check, Pencil, Plus, X } from "lucide-react";
import { PERSON_PALETTE, type Person } from "@/lib/chores-state";

interface EditPeopleProps {
  people: Person[];
  onAddPerson: (name: string) => void;
  onRemovePerson: (personId: string) => void;
  onRenamePerson: (personId: string, name: string) => void;
  onSetPersonColor: (personId: string, colorIdx: number) => void;
  onDone: () => void;
}

/**
 * Setup mode: replaces the board with a centered card. Also the automatic
 * first-run state (rendered by chores.tsx when people.length === 0), per the
 * plan.
 */
export function EditPeople({ people, onAddPerson, onRemovePerson, onRenamePerson, onSetPersonColor, onDone }: EditPeopleProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [personDraft, setPersonDraft] = useState("");

  const startEdit = (p: Person) => {
    setEditingId(p.id);
    setNameDraft(p.name);
  };
  const saveEdit = () => {
    const trimmed = nameDraft.trim();
    if (editingId && trimmed) onRenamePerson(editingId, trimmed);
    setEditingId(null);
    setNameDraft("");
  };
  const cancelEdit = () => {
    setEditingId(null);
    setNameDraft("");
  };
  const addPerson = () => {
    const name = personDraft.trim();
    if (!name) return;
    onAddPerson(name);
    setPersonDraft("");
  };

  return (
    <div className="flex-1 flex items-start justify-center overflow-y-auto" style={{ paddingTop: 90, paddingBottom: 40 }}>
      <div className="bg-rb-surface" style={{ width: 720, maxWidth: "90vw", borderRadius: 22, boxShadow: "0 1px 3px var(--rb-shadow-card)", padding: "40px 44px" }} data-testid="edit-people-card">
        <h2 style={{ margin: "0 0 6px", fontSize: 34, fontWeight: 800, letterSpacing: "-.5px", color: "var(--rb-ink)" }}>
          Set up your chore crew
        </h2>
        <p style={{ margin: "0 0 28px", fontSize: 18, fontWeight: 500, color: "var(--rb-muted)" }}>
          Everyone you add gets their own column on the chore board.
        </p>

        <div className="flex flex-col gap-2.5" style={{ marginBottom: 22 }}>
          {people.map((p) => {
            const pal = PERSON_PALETTE[p.colorIdx % PERSON_PALETTE.length];
            const initials = p.name.slice(0, 2).toUpperCase();
            const isEditing = editingId === p.id;
            return (
              <div key={p.id} className="flex flex-col gap-3" style={{ background: pal.tint, borderRadius: 14, padding: "14px 16px" }} data-testid={`setup-person-${p.id}`}>
                <div className="flex items-center gap-3.5">
                  <span
                    className="flex items-center justify-center rounded-full text-rb-on-color-ink flex-shrink-0"
                    style={{ width: 40, height: 40, background: pal.color, fontSize: 16, fontWeight: 800 }}
                  >
                    {initials}
                  </span>

                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") cancelEdit();
                        }}
                        autoFocus
                        className="flex-1 min-w-0 outline-none bg-rb-surface"
                        style={{ height: 46, border: `2px solid ${pal.color}`, borderRadius: 12, padding: "0 14px", fontSize: 19, fontWeight: 700, color: "var(--rb-ink)" }}
                        data-testid={`input-person-name-${p.id}`}
                      />
                      <button
                        type="button"
                        onClick={saveEdit}
                        title="Save name"
                        className="touch-button flex-shrink-0 flex items-center justify-center text-rb-on-color-ink"
                        style={{ width: 46, height: 46, border: "none", background: pal.color, borderRadius: 12 }}
                        data-testid={`button-save-name-${p.id}`}
                      >
                        <Check size={20} strokeWidth={2.8} />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      title="Edit name"
                      className="flex-1 min-w-0 flex items-center gap-2 text-left rounded-[10px] hover:bg-rb-surface/55"
                      style={{ border: "none", background: "transparent", padding: "6px 8px", fontSize: 20, fontWeight: 800, color: pal.text }}
                      data-testid={`button-edit-name-${p.id}`}
                    >
                      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{p.name}</span>
                      <Pencil size={16} strokeWidth={2.2} className="flex-shrink-0 opacity-55" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onRemovePerson(p.id)}
                    title="Remove"
                    className="touch-button flex-shrink-0 flex items-center justify-center rounded-full hover:bg-rb-surface"
                    style={{ width: 40, height: 40, border: "none", background: "var(--rb-on-tint-fill)", color: pal.text }}
                    data-testid={`button-remove-person-${p.id}`}
                  >
                    <X size={18} strokeWidth={2.4} />
                  </button>
                </div>

                <div className="flex items-center gap-2.5" style={{ paddingLeft: 2 }}>
                  {PERSON_PALETTE.map((sw, si) => {
                    const selected = si === p.colorIdx;
                    return (
                      <button
                        key={si}
                        type="button"
                        onClick={() => onSetPersonColor(p.id, si)}
                        title="Pick color"
                        // 44px hit area around a 34px visual swatch (touch-target rule).
                        className="touch-button flex-shrink-0 flex items-center justify-center rounded-full"
                        style={{ width: 44, height: 44, border: "none", background: "transparent" }}
                        data-testid={`swatch-${p.id}-${si}`}
                      >
                        <span
                          className="rounded-full"
                          style={{
                            width: 34,
                            height: 34,
                            background: sw.color,
                            boxShadow: selected
                              ? `0 0 0 3px ${pal.tint}, 0 0 0 6px ${sw.color}`
                              : "0 0 0 2px var(--rb-on-tint-ring)",
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2.5" style={{ marginBottom: 30 }}>
          <input
            type="text"
            value={personDraft}
            onChange={(e) => setPersonDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addPerson();
            }}
            placeholder="Add a person…"
            className="flex-1 min-w-0 outline-none"
            style={{ height: 56, border: "2px solid var(--rb-field-border)", borderRadius: 14, padding: "0 18px", fontSize: 19, fontWeight: 600, color: "var(--rb-ink)", background: "var(--rb-surface-sunken)" }}
            data-testid="input-add-person"
          />
          <button
            type="button"
            onClick={addPerson}
            className="touch-button flex-shrink-0 flex items-center justify-center gap-2 text-rb-on-color-ink"
            style={{ height: 56, padding: "0 24px", border: "none", background: "var(--rb-btn-dark-bg)", borderRadius: 14, fontSize: 18, fontWeight: 700 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--rb-btn-dark-hover-bg)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--rb-btn-dark-bg)")}
            data-testid="button-add-person"
          >
            <Plus size={20} strokeWidth={2.6} />
            Add
          </button>
        </div>

        <button
          type="button"
          onClick={onDone}
          className="touch-button w-full text-rb-on-color-ink"
          style={{ height: 62, border: "none", background: "var(--rb-accent)", borderRadius: 999, fontSize: 21, fontWeight: 800, boxShadow: "0 2px 6px var(--rb-shadow-accent)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--rb-accent-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--rb-accent)")}
          data-testid="button-done-setup"
        >
          Done — go to the board
        </button>
      </div>
    </div>
  );
}
