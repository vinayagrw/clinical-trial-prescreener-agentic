import type {
  ApiEndpointContract,
  EntityContract,
  IntegrationFeed
} from "../types";

interface PlatformBlueprintPanelProps {
  endpoints: ApiEndpointContract[];
  entities: EntityContract[];
  feeds: IntegrationFeed[];
}

export function PlatformBlueprintPanel({
  endpoints,
  entities,
  feeds
}: PlatformBlueprintPanelProps) {
  return (
    <section className="surface">
      <div className="panel-heading">
        <div>
          <p className="eyebrow-label">Platform foundation</p>
          <h3>Working contracts behind the prototype</h3>
        </div>
      </div>

      <div className="platform-blueprint">
        <div className="platform-blueprint__section">
          <div className="panel-heading">
            <div>
              <p className="eyebrow-label">Public interfaces</p>
              <h4>API surface</h4>
            </div>
          </div>

          <div className="endpoint-stack">
            {endpoints.map((endpoint) => (
              <article key={`${endpoint.method}-${endpoint.path}`} className="endpoint-card">
                <div className="endpoint-card__top">
                  <strong>
                    {endpoint.method} {endpoint.path}
                  </strong>
                  <span>{endpoint.owner}</span>
                </div>
                <p>{endpoint.summary}</p>
                <div className="endpoint-card__detail">
                  <div>
                    <small>Request</small>
                    <p>{endpoint.requestShape}</p>
                  </div>
                  <div>
                    <small>Response</small>
                    <p>{endpoint.responseShape}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="platform-blueprint__section">
          <div className="panel-heading">
            <div>
              <p className="eyebrow-label">Core entities</p>
              <h4>Domain model</h4>
            </div>
          </div>

          <div className="entity-grid">
            {entities.map((entity) => (
              <article key={entity.name} className="entity-card">
                <strong>{entity.name}</strong>
                <p>{entity.purpose}</p>
                <ul className="entity-card__list">
                  {entity.keyFields.map((field) => (
                    <li key={field}>{field}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>

        <div className="platform-blueprint__section">
          <div className="panel-heading">
            <div>
              <p className="eyebrow-label">Mock-to-real adapters</p>
              <h4>Source feeds</h4>
            </div>
          </div>

          <div className="feed-stack">
            {feeds.map((feed) => (
              <article key={feed.name} className="feed-card">
                <strong>{feed.name}</strong>
                <p>{feed.role}</p>
                <div className="feed-card__meta">
                  <span>{feed.mode}</span>
                  <span>{feed.freshness}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
