import React from 'react';

const pulseStyle = `
  @keyframes pulse-skeleton {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  .skeleton-anim {
    animation: pulse-skeleton 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    background-color: var(--line, #333);
    border-radius: 4px;
  }
`;

export const SkeletonLine = ({ width = '100%', height = '1rem', className = '', style = {} }) => (
  <>
    <style>{pulseStyle}</style>
    <div className={`skeleton-anim ${className}`} style={{ width, height, ...style }}></div>
  </>
);

export const StatsSkeleton = () => (
  <div className="card" style={{ backgroundColor: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '12px', minHeight: '120px', border: '1px solid var(--line)' }}>
    <style>{pulseStyle}</style>
    <div className="flex justify-between items-start mb-3">
      <SkeletonLine width="60%" height="1.2rem" />
      <SkeletonLine width="2.5rem" height="2.5rem" style={{ borderRadius: '8px' }} />
    </div>
    <SkeletonLine width="80%" height="2.5rem" style={{ margin: '0.75rem 0' }} />
    <SkeletonLine width="40%" height="0.875rem" />
  </div>
);

export const CardSkeleton = () => (
  <div style={{ backgroundColor: 'var(--bg-panel)', padding: '1rem', borderRadius: '8px' }}>
    <style>{pulseStyle}</style>
    <SkeletonLine width="40%" height="1.5rem" style={{ marginBottom: '1rem' }} />
    <SkeletonLine width="100%" height="1rem" style={{ marginBottom: '0.5rem' }} />
    <SkeletonLine width="90%" height="1rem" style={{ marginBottom: '0.5rem' }} />
    <SkeletonLine width="80%" height="1rem" />
  </div>
);

export const TasksSkeleton = () => (
  <div style={{ backgroundColor: 'var(--bg-panel)', padding: '1rem', borderRadius: '8px' }}>
    <style>{pulseStyle}</style>
    {[1, 2, 3].map(i => (
      <div key={i} className="flex items-center gap-3 mb-3 pb-3 border-b border-[var(--line)]">
        <SkeletonLine width="1.5rem" height="1.5rem" style={{ borderRadius: '50%' }} />
        <div style={{ flex: 1 }}>
          <SkeletonLine width="70%" height="1rem" style={{ marginBottom: '0.25rem' }} />
          <SkeletonLine width="30%" height="0.8rem" />
        </div>
      </div>
    ))}
  </div>
);

export const MeetingSkeleton = () => (
  <div style={{ backgroundColor: 'var(--bg-panel)', padding: '1rem', borderRadius: '8px', display: 'flex', gap: '1rem' }}>
    <style>{pulseStyle}</style>
    <div style={{ width: '60px' }}>
      <SkeletonLine width="100%" height="4rem" style={{ borderRadius: '8px' }} />
    </div>
    <div style={{ flex: 1 }}>
      <SkeletonLine width="50%" height="1.2rem" style={{ marginBottom: '0.5rem' }} />
      <SkeletonLine width="30%" height="0.8rem" style={{ marginBottom: '0.5rem' }} />
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <SkeletonLine width="4rem" height="1.5rem" style={{ borderRadius: '1rem' }} />
        <SkeletonLine width="4rem" height="1.5rem" style={{ borderRadius: '1rem' }} />
      </div>
    </div>
  </div>
);
