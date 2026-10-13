import React from "react";
import { useNavigate } from "react-router-dom";
import { getPatient, getTrial } from "../../data/index";
import type { DemoStory } from "../../types/extended";

interface DemoStoryBoardProps {
  stories: DemoStory[];
  activeStoryId?: string;
}

/**
 * Curated narrative proof-point deck that sits below the TaskBoard on Mission
 * Control. Each card is clickable and deep-links into Deep Review so a sales
 * demo can jump to a pre-staged story with one click. Ported from
 * sample-ui/src/components/DemoStoryBoard.tsx, with the cards wired
 * as real <button>s for keyboard access and navigation.
 */
export function DemoStoryBoard({ stories, activeStoryId }: DemoStoryBoardProps) {
  const navigate = useNavigate();

  if (stories.length === 0) return null;

  return (
    <section className="story-board-section glass-surface glass-surface--card">
      <div className="story-board-section__header">
        <p className="story-board-section__eyebrow">Curated proof</p>
        <h3 className="story-board-section__title">Demo stories that show the product depth</h3>
      </div>

      <div className="story-board">
        {stories.map((story) => {
          const patient = getPatient(story.patientId);
          const trial = getTrial(story.trialId);

          return (
            <button
              type="button"
              key={story.id}
              className={`story-card ${
                story.id === activeStoryId ? "story-card--active" : ""
              }`}
              onClick={() => navigate(`/review/${story.matchId}`)}
              aria-label={`Open demo story: ${story.title}`}
            >
              <span className="story-card__category">{story.category}</span>
              <strong className="story-card__title">{story.title}</strong>
              <p className="story-card__wow">{story.wowFactor}</p>

              <div className="story-card__meta">
                <div>
                  <small>Patient</small>
                  <strong>{patient?.name ?? "Unknown patient"}</strong>
                </div>
                <div>
                  <small>Trial</small>
                  <strong>{trial?.shortCode ?? "Unknown trial"}</strong>
                </div>
              </div>

              <div className="story-card__stack">
                <div>
                  <small>Visible blocker</small>
                  <p>{story.visibleBlocker}</p>
                </div>
                <div>
                  <small>Next action</small>
                  <p>{story.nextAction}</p>
                </div>
                <div>
                  <small>Manager metric</small>
                  <p>{story.managerMetric}</p>
                </div>
                <div>
                  <small>Product promise</small>
                  <p>{story.promise}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
