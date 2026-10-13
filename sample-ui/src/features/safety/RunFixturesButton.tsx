/*
 * RunFixturesButton — iterates `SAFETY_FIXTURES` and fires every check.
 *
 * Each fixture returns a short status string. We accumulate them into a
 * local result list and show them next to the button so reviewers can
 * confirm every check actually ran without scrolling the main event feed.
 * Errors (e.g. the contraindication fixture throwing `SafetyBlockError`)
 * are caught per-fixture and surfaced as a red status — the next fixture
 * keeps running.
 *
 * The button only fires the fixtures on click; it does not auto-run.
 */

import { useState } from "react";
import { SAFETY_FIXTURES, type SafetyFixture } from "../../lib/safety/testFixtures";

interface FixtureResult {
  fixture: SafetyFixture;
  status: "ok" | "blocked" | "error";
  message: string;
}

export function RunFixturesButton() {
  const [results, setResults] = useState<FixtureResult[]>([]);
  const [running, setRunning] = useState(false);

  function handleRun() {
    setRunning(true);
    const next: FixtureResult[] = [];
    for (const fixture of SAFETY_FIXTURES) {
      try {
        const message = fixture.run();
        const blocked = /block/i.test(message);
        next.push({
          fixture,
          status: blocked ? "blocked" : "ok",
          message,
        });
      } catch (err) {
        next.push({
          fixture,
          status: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
    setResults(next);
    setRunning(false);
  }

  return (
    <section className="safety-run-fixtures" aria-label="Run safety fixtures">
      <header className="safety-run-fixtures__head">
        <div>
          <h3>Safety fixture deck</h3>
          <p className="safety-run-fixtures__blurb">
            Runs {SAFETY_FIXTURES.length} curated adversarial inputs through the F1 / F3 / F5
            guard stacks — one per failure mode. Every check should fire at least once and
            appear in the feed below.
          </p>
        </div>
        <button
          type="button"
          className="safety-run-fixtures-btn"
          onClick={handleRun}
          disabled={running}
        >
          {running ? "Running…" : "Run safety fixtures"}
        </button>
      </header>
      {results.length > 0 ? (
        <ol className="safety-run-fixtures__results">
          {results.map((r) => (
            <li
              key={r.fixture.id}
              className={`safety-run-fixtures__result safety-run-fixtures__result--${r.status}`}
            >
              <span className="safety-run-fixtures__fixture-id">{r.fixture.id}</span>
              <span className="safety-run-fixtures__fixture-mode">
                {r.fixture.mode.replace(/_/g, " ")}
              </span>
              <span className="safety-run-fixtures__fixture-desc">
                {r.fixture.description}
              </span>
              <span className="safety-run-fixtures__fixture-status">{r.message}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
