type PageSkeletonProps = { rows?: number; cards?: number };

/** A quiet content-shaped loading state used across the application. */
export default function PageSkeleton({ rows = 5, cards = 0 }: PageSkeletonProps) {
  return (
    <div className="sk" aria-label="Loading content" role="status">
      {cards > 0 && (
        <div className="sk-cards">
          {Array.from({ length: cards }).map((_, index) => (
            <div className="sk-card" key={index} />
          ))}
        </div>
      )}
      <div className="sk-panel">
        <div className="sk-line is-head" />
        {Array.from({ length: rows }).map((_, index) => (
          <div className="sk-line" key={index} />
        ))}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
