import { getPatient, getTrial } from "../data/mockData";
import type { DemoStory } from "../types";

interface DemoStoryBoardProps {
  stories: DemoStory[];
  activeStoryId?: string;
}

export function DemoStoryBoard({
  stories,
  activeStoryId
}: DemoStoryBoardProps) {
  return (
    <section className="surface">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Curated proof</p>
          <h3>Demo stories that show the product depth</h3>
        </div>
      </div>

      <div className="story-board">
        {stories.map((story) => {
          const patient = getPatient(story.patientId);
          const trial = getTrial(story.trialId);
          if (!patient || !trial) {
            return null;
          }

          return (
            <article
              key={story.id}
              className={`story-card ${
                story.id === activeStoryId ? "story-card--active" : ""
              }`}
            >
              <span>{story.category}</span>
              <strong>{story.title}</strong>
              <p>{story.wowFactor}</p>

              <div className="story-card__meta">
                <div>
                  <small>Patient</small>
                  <strong>{patient.name}</strong>
                </div>
                <div>
                  <small>Trial</small>
                  <strong>{trial.shortCode}</strong>
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
            </article>
          );
        })}
      </div>
    </section>
  );
}
