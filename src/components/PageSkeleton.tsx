import React from 'react';

type PageSkeletonProps = { rows?: number; cards?: number };

/** A quiet content-shaped loading state used across the application. */
export default function PageSkeleton({ rows = 5, cards = 0 }: PageSkeletonProps) {
  return (
    <div className="ui-skeleton" aria-label="Loading content" role="status">
      {cards > 0 && (
        <div className="ui-skeleton-cards">
          {Array.from({ length: cards }).map((_, index) => <div className="ui-skeleton-card" key={index} />)}
        </div>
      )}
      <div className="ui-skeleton-table">
        <div className="ui-skeleton-line heading" />
        {Array.from({ length: rows }).map((_, index) => <div className="ui-skeleton-line" key={index} />)}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
