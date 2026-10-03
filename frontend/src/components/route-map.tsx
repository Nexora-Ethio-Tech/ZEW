import { Icon } from './icon';

export function RouteMap({
  origin,
  destination,
  corridor,
  reverse = false,
}: {
  origin: string;
  destination: string;
  corridor: string;
  reverse?: boolean;
}) {
  return (
    <div className="route-map">
      <div className="map-caption">
        <span className="live-dot" /> Explore your corridor{' '}
        <span className="map-chip">ADDIS ABABA</span>
      </div>
      <svg
        className="map-art"
        viewBox="0 0 720 420"
        role="img"
        aria-label={`Illustrative route from ${origin} to ${destination}; not a navigation map`}
      >
        <defs>
          <pattern
            id="blocks"
            width="120"
            height="94"
            patternTransform="rotate(-24)"
            patternUnits="userSpaceOnUse"
          >
            <rect x="8" y="8" width="102" height="74" rx="6" fill="#e7e9dc" />
            <path d="M0 0h120v94" fill="none" stroke="#fffef7" strokeWidth="12" />
            <path d="M60 8v74M8 46h102" stroke="#f8f8ee" strokeWidth="5" />
          </pattern>
          <filter id="mapShadow">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodOpacity=".12" />
          </filter>
        </defs>
        <rect width="720" height="420" fill="#f1f1e6" />
        <rect width="720" height="420" fill="url(#blocks)" />
        <path d="M-10 310Q120 275 170 390L220 420H-10zM530 0l55 110 135 15V0z" fill="#d4dfc7" />
        <path
          d="M-30 135 200 150 385 70 760 100M80-20 215 145 295 300 310 450M-30 390 285 300 510 190 750 220M460-20 480 125 625 330 650 450"
          fill="none"
          stroke="#daddcf"
          strokeWidth="25"
        />
        <path
          d="M-30 135 200 150 385 70 760 100M80-20 215 145 295 300 310 450M-30 390 285 300 510 190 750 220M460-20 480 125 625 330 650 450"
          fill="none"
          stroke="#fffdf6"
          strokeWidth="19"
        />
        <g fill="#99a18e" fontFamily="Arial" fontSize="11" letterSpacing="2">
          <text x="62" y="95">
            KIRKOS
          </text>
          <text x="500" y="365">
            BOLE
          </text>
          <text x="420" y="55">
            ADDIS ABABA
          </text>
          <text x="44" y="365" fontSize="9">
            GREEN SPACE
          </text>
        </g>
        <path
          d="M155 145 215 148 294 300 410 245 512 195 596 206"
          fill="none"
          stroke="#b2cbaa"
          strokeWidth="17"
          strokeLinecap="round"
        />
        <path
          d="M155 145 215 148 294 300 410 245 512 195 596 206"
          fill="none"
          stroke="#2e6650"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path d="m359 261 8 7-2-11m113-41 8 7-2-11" fill="none" stroke="#fff" strokeWidth="2.5" />
        <circle cx="410" cy="245" r="6" fill="#fff" stroke="#2e6650" strokeWidth="3" />
        <g filter="url(#mapShadow)">
          <rect x="92" y="85" width="150" height="38" rx="9" fill="#fff" />
          <text x="105" y="109" fill="#284635" fontSize="12" fontFamily="Arial">
            {(reverse ? origin : destination).slice(0, 23)}
          </text>
          <rect x="499" y="145" width="174" height="38" rx="9" fill="#fff" />
          <text x="512" y="169" fill="#284635" fontSize="12" fontFamily="Arial">
            {(reverse ? destination : origin).slice(0, 23)}
          </text>
        </g>
        <circle cx="155" cy="145" r="12" fill="#fff" stroke="#2e6650" strokeWidth="4" />
        <circle cx="155" cy="145" r="4" fill="#2e6650" />
        <circle cx="596" cy="206" r="12" fill="#2e6650" stroke="#fff" strokeWidth="4" />
        <g transform="translate(322 260) rotate(-26)" filter="url(#mapShadow)">
          <rect width="34" height="19" rx="6" fill="#fff" stroke="#286149" strokeWidth="2" />
          <rect x="10" y="3" width="12" height="13" rx="3" fill="#a5bda7" />
        </g>
      </svg>
      <div className="map-bottom">
        <div>
          <Icon name="route" />
          <span>
            <strong>{corridor}</strong>
            <small>Same direction. Shared journey.</small>
          </span>
        </div>
        <span className="schematic">Illustrative map</span>
      </div>
    </div>
  );
}
