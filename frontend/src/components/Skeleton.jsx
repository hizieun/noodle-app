// --- Skeleton Loading ---
export const SkeletonCard = () => (
  <div className="skeleton-card">
    <div className="skeleton-bar title-bar"></div>
    <div className="skeleton-bar address-bar"></div>
    <div className="skeleton-bar footer-bar"></div>
  </div>
);

export const SkeletonGrid = () => (
  <div className="skeleton-screen">
    <div className="skeleton-logo-bar skeleton-bar"></div>
    <div className="restaurant-grid" style={{ marginTop: '1.5rem' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  </div>
);
