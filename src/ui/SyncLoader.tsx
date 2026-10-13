import React from 'react';

const SyncLoader = () => {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'repeating-linear-gradient(0deg, transparent 0 35px, rgba(23,28,26,.075) 35px 36px), #e7e1d5',
      overflow: 'hidden'
    }}>
      {/* Notebook margin line */}
      <div style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 'clamp(40px, 8vw, 100px)',
        width: 1,
        background: 'rgba(217,89,55,.28)'
      }} />

      <style>{`
        @keyframes doc-float {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-6px) rotate(4deg); }
        }
        @keyframes doc-float-alt {
          0%, 100% { transform: translateY(0) rotate(3deg); }
          50% { transform: translateY(5px) rotate(-3deg); }
        }
        .sync-doc-1 { animation: doc-float 2.5s ease-in-out infinite; }
        .sync-doc-2 { animation: doc-float-alt 3s ease-in-out infinite; }
        .sync-doc-3 { animation: doc-float 2.8s ease-in-out infinite; }
      `}</style>

      <svg viewBox="0 0 600 300" style={{ width: '100%', maxWidth: 700, height: 'auto', filter: 'drop-shadow(0 15px 9px rgba(23,28,26,.04))' }}>
        <defs>
          {/* Dashed trail */}
          <path id="sync-loop" 
                d="M 150 150 C 150 50, 450 50, 450 150 C 450 250, 150 250, 150 150 Z" />
        </defs>

        {/* Trail rendering */}
        <use href="#sync-loop" fill="none" stroke="#83877b" strokeWidth="2" strokeDasharray="8 10" strokeLinecap="round" />

        {/* Moving Documents */}
        <g>
          <animateMotion dur="6s" repeatCount="indefinite" begin="0s">
            <mpath href="#sync-loop" />
          </animateMotion>
          <g className="sync-doc-1" transform="translate(-15, -20)">
            {/* Simple ruled document */}
            <rect width="30" height="40" fill="#f4f1ea" stroke="#171c1a" strokeWidth="2.5" rx="2" />
            <line x1="6" y1="10" x2="24" y2="10" stroke="#171c1a" strokeWidth="2" strokeLinecap="round" />
            <line x1="6" y1="18" x2="18" y2="18" stroke="#171c1a" strokeWidth="2" strokeLinecap="round" />
            <line x1="6" y1="26" x2="24" y2="26" stroke="#171c1a" strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>

        <g>
          <animateMotion dur="6s" repeatCount="indefinite" begin="-2s">
            <mpath href="#sync-loop" />
          </animateMotion>
          <g className="sync-doc-2" transform="translate(-15, -20)">
            {/* Checklist document */}
            <rect width="30" height="40" fill="#f4f1ea" stroke="#171c1a" strokeWidth="2.5" rx="2" />
            <circle cx="10" cy="12" r="3.5" fill="#e88864" />
            <line x1="18" y1="12" x2="24" y2="12" stroke="#171c1a" strokeWidth="2" strokeLinecap="round" />
            <circle cx="10" cy="22" r="3.5" fill="#c7de5d" />
            <line x1="18" y1="22" x2="24" y2="22" stroke="#171c1a" strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>

        <g>
          <animateMotion dur="6s" repeatCount="indefinite" begin="-4s">
            <mpath href="#sync-loop" />
          </animateMotion>
          <g className="sync-doc-3" transform="translate(-15, -20)">
            {/* Grid/Table document */}
            <rect width="30" height="40" fill="#f4f1ea" stroke="#171c1a" strokeWidth="2.5" rx="2" />
            <rect x="6" y="8" width="18" height="24" fill="none" stroke="#171c1a" strokeWidth="2" rx="1" />
            <line x1="6" y1="16" x2="24" y2="16" stroke="#171c1a" strokeWidth="1.5" />
            <line x1="6" y1="24" x2="24" y2="24" stroke="#171c1a" strokeWidth="1.5" />
            <line x1="15" y1="8" x2="15" y2="32" stroke="#171c1a" strokeWidth="1.5" />
          </g>
        </g>

        {/* Local Source Node */}
        <g transform="translate(90, 115)">
           <rect x="-10" y="-10" width="80" height="80" fill="#e7e1d5" />
           {/* Folder/Binder graphic */}
           <path d="M5,15 L25,15 L35,25 L65,25 C67.761,25 70,27.239 70,30 L70,55 C70,57.761 67.761,60 65,60 L5,60 C2.239,60 0,57.761 0,55 L0,20 C0,17.239 2.239,15 5,15 Z" fill="#e88864" stroke="#171c1a" strokeWidth="2.5" strokeLinejoin="round" />
           <rect x="0" y="25" width="70" height="35" fill="#d95937" stroke="#171c1a" strokeWidth="2.5" rx="3" />
           {/* Label */}
           <rect x="20" y="38" width="30" height="10" fill="#f4f1ea" stroke="#171c1a" strokeWidth="2" rx="1" />
           <line x1="25" y1="43" x2="45" y2="43" stroke="#171c1a" strokeWidth="1.5" strokeLinecap="round" />
        </g>

        {/* Server Destination Node */}
        <g transform="translate(435, 105)">
           <rect x="-10" y="-10" width="80" height="100" fill="#e7e1d5" />
           {/* Server Rack graphic */}
           <rect x="5" y="10" width="60" height="70" fill="#c7de5d" stroke="#171c1a" strokeWidth="2.5" rx="4" />
           
           {/* Server Slot 1 */}
           <rect x="15" y="22" width="40" height="10" fill="#f4f1ea" stroke="#171c1a" strokeWidth="2" rx="2" />
           <circle cx="22" cy="27" r="2.5" fill="#d95937" />
           <line x1="32" y1="27" x2="48" y2="27" stroke="#171c1a" strokeWidth="1.5" strokeLinecap="round" />

           {/* Server Slot 2 */}
           <rect x="15" y="38" width="40" height="10" fill="#f4f1ea" stroke="#171c1a" strokeWidth="2" rx="2" />
           <circle cx="22" cy="43" r="2.5" fill="#171c1a" />
           <line x1="32" y1="43" x2="48" y2="43" stroke="#171c1a" strokeWidth="1.5" strokeLinecap="round" />

           {/* Server Slot 3 */}
           <rect x="15" y="54" width="40" height="10" fill="#f4f1ea" stroke="#171c1a" strokeWidth="2" rx="2" />
           <circle cx="22" cy="59" r="2.5" fill="#171c1a" />
           <line x1="32" y1="59" x2="48" y2="59" stroke="#171c1a" strokeWidth="1.5" strokeLinecap="round" />
        </g>

      </svg>
    </div>
  );
};

export default SyncLoader;
