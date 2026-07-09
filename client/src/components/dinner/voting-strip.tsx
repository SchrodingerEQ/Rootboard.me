import { Crown, RotateCcw, ThumbsUp } from "lucide-react";
import { maxVoteCount, VOTE_SLOTS, type DinnerCandidate } from "@/lib/dinner-state";

interface VotingStripProps {
  candidates: DinnerCandidate[];
  cooldownActive: boolean;
  cooldownSeconds: number;
  onVote: (candidateId: string) => void;
  onAddSlot: () => void;
  onResetAsk: () => void;
}

/**
 * "VOTE ON UPCOMING DINNERS" — up to VOTE_SLOTS filled/empty slots plus a
 * fixed-width Reset Vote button. Layout/values per CHORES_DINNER_BUILD_PLAN.md
 * and mockups/Dinner Screen.dc.html.
 */
export function VotingStrip({ candidates, cooldownActive, cooldownSeconds, onVote, onAddSlot, onResetAsk }: VotingStripProps) {
  const leadingMax = maxVoteCount(candidates);
  const emptySlots = Math.max(0, VOTE_SLOTS - candidates.length);

  return (
    <div style={{ padding: "18px 24px 0" }}>
      <div className="flex items-baseline justify-between" style={{ padding: "0 4px 10px" }}>
        <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: ".8px", textTransform: "uppercase", color: "var(--rb-muted)" }}>
          Vote on upcoming dinners
        </span>
        {cooldownActive && (
          <span style={{ fontSize: 15, fontWeight: 700, color: "#b45309" }} data-testid="text-cooldown">
            You can vote again in {cooldownSeconds}s
          </span>
        )}
      </div>

      <div className="flex items-stretch" style={{ gap: 12 }}>
        {candidates.map((c) => {
          const isLeading = c.votes > 0 && c.votes === leadingMax;
          return (
            <div
              key={c.id}
              className="flex-1 min-w-0 flex flex-col"
              style={{
                background: "#ffffff",
                borderRadius: 16,
                border: `3px solid ${isLeading ? "#f2655a" : "transparent"}`,
                boxShadow: "0 1px 2px rgba(0,0,0,.05)",
                padding: "14px 14px 12px",
                gap: 10,
              }}
              data-testid={`vote-slot-${c.id}`}
            >
              <div className="flex items-center justify-between" style={{ gap: 8 }}>
                <span
                  className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
                  style={{ fontSize: 18, fontWeight: 800, color: "#2b3038" }}
                >
                  {c.title}
                </span>
                {isLeading && <Crown size={20} fill="#f2655a" color="#f2655a" strokeWidth={1.6} style={{ flexShrink: 0 }} />}
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--rb-muted)" }}>
                {c.votes === 1 ? "1 vote" : `${c.votes} votes`}
              </span>
              <button
                type="button"
                onClick={() => onVote(c.id)}
                disabled={cooldownActive}
                className="touch-button flex items-center justify-center"
                style={{
                  height: 46,
                  border: "none",
                  borderRadius: 999,
                  background: cooldownActive ? "#f1efea" : "#2b3038",
                  color: cooldownActive ? "#b8bcc4" : "#ffffff",
                  fontSize: 16,
                  fontWeight: 800,
                  cursor: cooldownActive ? "default" : "pointer",
                  gap: 7,
                  transition: "background .2s ease",
                }}
                data-testid={`button-vote-${c.id}`}
              >
                <ThumbsUp size={18} strokeWidth={2.4} />
                Vote
              </button>
            </div>
          );
        })}

        {Array.from({ length: emptySlots }).map((_, i) => (
          <button
            key={`empty-${i}`}
            type="button"
            onClick={onAddSlot}
            className="flex-1 min-w-0 flex flex-col items-center justify-center touch-button"
            style={{
              background: "transparent",
              border: "3px dashed #d9d5cc",
              borderRadius: 16,
              color: "var(--rb-muted)",
              gap: 8,
              padding: 14,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--rb-chip)";
              e.currentTarget.style.color = "#5b626d";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--rb-muted)";
            }}
            data-testid={`button-add-vote-slot-${i}`}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span style={{ fontSize: 15, fontWeight: 800 }}>Add meal</span>
          </button>
        ))}

        <button
          type="button"
          onClick={onResetAsk}
          className="flex-shrink-0 flex flex-col items-center justify-center touch-button"
          style={{ width: 120, background: "#ffffff", border: "3px solid #fce4ea", borderRadius: 16, color: "#e11d48", gap: 8 }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#fce4ea")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
          data-testid="button-reset-votes"
        >
          <RotateCcw size={24} strokeWidth={2.2} />
          <span style={{ fontSize: 15, fontWeight: 800 }}>Reset Vote</span>
        </button>
      </div>
    </div>
  );
}
