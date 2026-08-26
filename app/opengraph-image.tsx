import { ImageResponse } from 'next/og';

export const alt = 'TDILEARNED — type any topic, get a researched mindmap';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#FFFFFF',
          padding: '72px 80px',
          border: '16px solid #000000',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 28, height: 28, backgroundColor: '#000000' }} />
          <div
            style={{
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: 8,
              color: '#000000',
            }}
          >
            TDILEARNED
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div
            style={{
              fontSize: 92,
              fontWeight: 800,
              lineHeight: 1.05,
              color: '#000000',
              maxWidth: 940,
            }}
          >
            Type any topic. Fall down the rabbit hole.
          </div>
          <div
            style={{
              fontSize: 34,
              color: '#525252',
              maxWidth: 880,
            }}
          >
            Researched mindmaps with real sources, key facts, and threads to pull.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            borderTop: '4px solid #000000',
            paddingTop: 24,
          }}
        >
          <div style={{ fontSize: 26, color: '#000000', letterSpacing: 4 }}>
            BORED? PICK A TOPIC.
          </div>
          <div style={{ fontSize: 26, color: '#9E9E9E', letterSpacing: 2 }}>
            til-seven.vercel.app
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
