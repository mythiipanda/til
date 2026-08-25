import { ImageResponse } from 'next/og';
import { getSharedMindMap } from './data';

export const alt = 'TDILEARNED shared mindmap';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export default async function OpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const mindmap = await getSharedMindMap(slug);
  const title = truncate(mindmap?.title || 'Map not found', 60);

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
          border: '4px solid #000000',
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          <div
            style={{
              fontSize: 84,
              fontWeight: 800,
              lineHeight: 1.05,
              color: '#000000',
              maxWidth: 980,
            }}
          >
            {title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#000000',
                color: '#FFFFFF',
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: 4,
                padding: '10px 20px',
              }}
            >
              {(mindmap?.category || 'General').toUpperCase()}
            </div>
            <div style={{ fontSize: 26, color: '#525252', letterSpacing: 4 }}>
              {mindmap ? `${mindmap.nodeCount} NODES RESEARCHED` : 'SHARED KNOWLEDGE MAP'}
            </div>
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
            INTERACTIVE SPATIAL KNOWLEDGE MAP
          </div>
          <div style={{ fontSize: 26, color: '#9E9E9E', letterSpacing: 2 }}>til-seven.vercel.app</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
