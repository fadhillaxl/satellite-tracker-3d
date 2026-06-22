'use client';

import LeoLayout from '@/components/leo/LeoLayout';

const CITATIONS = [
  {
    category: 'Orbital Mechanics',
    refs: [
      {
        num: 1,
        authors: 'Walker, J. G.',
        year: '1984',
        title: 'Satellite constellations',
        source: 'Journal of the British Interplanetary Society, 37, 559–572.',
        doi: null,
      },
      {
        num: 2,
        authors: 'Vallado, D. A., & McClain, W. D.',
        year: '2013',
        title: 'Fundamentals of Astrodynamics and Applications (4th ed.)',
        source: 'Microcosm Press.',
        doi: null,
      },
      {
        num: 3,
        authors: 'Larson, W. J., & Wertz, J. R. (Eds.)',
        year: '1999',
        title: 'Space Mission Engineering: The New SMAD',
        source: 'Microcosm Press.',
        doi: null,
      },
    ],
  },
  {
    category: 'ISL & Network Topology',
    refs: [
      {
        num: 4,
        authors: 'Del Portillo, I., Cameron, B. G., & Crawley, E. F.',
        year: '2019',
        title: 'A technical comparison of three LEO satellite networks with a focus on the Starlink, OneWeb, and Telesat systems',
        source: 'Acta Astronautica, 159, 123–135.',
        doi: 'https://doi.org/10.1016/j.actaastro.2019.03.040',
      },
      {
        num: 5,
        authors: 'Bhattacherjee, D., & Singla, A.',
        year: '2019',
        title: 'Network topology design at 27,000 km/hour',
        source: 'Proc. ACM CoNEXT 2019.',
        doi: 'https://doi.org/10.1145/3359989.3365407',
      },
      {
        num: 6,
        authors: 'Handley, M.',
        year: '2018',
        title: 'Delay is Not an Option: Low Latency Routing in Space',
        source: 'Proc. ACM HotNets 2018.',
        doi: 'https://doi.org/10.1145/3286062.3286075',
      },
    ],
  },
  {
    category: 'Link Budget & RF Analysis',
    refs: [
      {
        num: 7,
        authors: 'Pratt, T., Bostian, C., & Allnutt, J.',
        year: '2003',
        title: 'Satellite Communications (2nd ed.)',
        source: 'Wiley.',
        doi: null,
      },
      {
        num: 8,
        authors: 'Roddy, D.',
        year: '2006',
        title: 'Satellite Communications (4th ed.)',
        source: 'McGraw-Hill.',
        doi: null,
      },
      {
        num: 9,
        authors: 'ITU-R Recommendation P.618-13',
        year: '2017',
        title: 'Propagation data and prediction methods required for the design of Earth-space telecommunication systems',
        source: 'International Telecommunication Union.',
        doi: null,
      },
    ],
  },
  {
    category: 'Coverage & Capacity',
    refs: [
      {
        num: 10,
        authors: 'Vatalaro, F., Corazza, G. E., Caini, C., & Ferrarelli, C.',
        year: '1995',
        title: 'Analysis of LEO, MEO, and GEO global mobile satellite systems in the presence of interference and fading',
        source: 'IEEE Journal on Selected Areas in Communications, 13(2), 291–300.',
        doi: 'https://doi.org/10.1109/49.345879',
      },
      {
        num: 11,
        authors: 'Starlink Team, SpaceX',
        year: '2020',
        title: 'SpaceX Starlink — FCC Application for Modification of Authorization (Attachment A)',
        source: 'Federal Communications Commission (public filing).',
        doi: null,
      },
    ],
  },
  {
    category: 'Visualization & Software',
    refs: [
      {
        num: 12,
        authors: 'Cabello, R. et al.',
        year: '2024',
        title: 'Three.js — JavaScript 3D Library (r168)',
        source: 'GitHub: mrdoob/three.js.',
        doi: 'https://threejs.org',
      },
      {
        num: 13,
        authors: 'Verhoeven, G. J. J.',
        year: '2011',
        title: 'Taking computer vision aloft — archaeological three-dimensional reconstructions from aerial photographs with PhotoScan',
        source: 'Archaeological Prospection, 18(1), 67–73.',
        doi: null,
      },
    ],
  },
];

export default function CitationsPage() {
  return (
    <LeoLayout>
      <div style={{ height: '100%', overflowY: 'auto', padding: '32px 48px', maxWidth: 860, margin: '0 auto' }}>
        <h1 style={{ fontSize: 20, fontFamily: "'Orbitron',monospace", fontWeight: 700, color: '#fff', marginBottom: 8, letterSpacing: '0.06em' }}>
          REFERENCES
        </h1>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 36, lineHeight: 1.6 }}>
          Academic and technical references underpinning the orbital mechanics, ISL algorithms, link budget models, and coverage analysis implemented in this suite.
        </p>

        {CITATIONS.map(cat => (
          <div key={cat.category} style={{ marginBottom: 36 }}>
            <div style={{
              fontSize: 10, fontFamily: "'Orbitron',monospace", fontWeight: 600,
              letterSpacing: '0.12em', color: 'rgba(34,211,238,0.7)',
              marginBottom: 14, paddingBottom: 6,
              borderBottom: '1px solid rgba(34,211,238,0.15)',
            }}>
              {cat.category}
            </div>
            {cat.refs.map(ref => (
              <div
                key={ref.num}
                style={{
                  display: 'flex', gap: 16, marginBottom: 14,
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 8,
                  transition: 'border-color 0.2s',
                }}
                onMouseOver={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.12)'; }}
                onMouseOut={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.06)'; }}
              >
                <span style={{ fontSize: 11, fontFamily: "'Share Tech Mono',monospace", color: 'rgba(34,211,238,0.5)', flexShrink: 0, minWidth: 20 }}>
                  [{ref.num}]
                </span>
                <div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 3, lineHeight: 1.5 }}>
                    <span style={{ color: 'rgba(255,255,255,0.45)' }}>{ref.authors}</span>
                    {' '}<span style={{ color: 'rgba(255,255,255,0.25)' }}>({ref.year})</span>
                    {'. '}
                    <em style={{ color: '#fff', fontStyle: 'italic' }}>{ref.title}</em>
                    {'. '}{ref.source}
                  </div>
                  {ref.doi && (
                    <a href={ref.doi} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 10, color: '#22d3ee', textDecoration: 'none', fontFamily: "'Share Tech Mono',monospace", letterSpacing: '0.03em', opacity: 0.7 }}>
                      {ref.doi} ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </LeoLayout>
  );
}
