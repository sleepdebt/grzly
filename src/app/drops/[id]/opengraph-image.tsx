// Dynamic OG image for drop detail pages
// Renders as the og:image for /drops/[id]

import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          backgroundColor: '#0a0a0a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: '48px', color: '#c8ff00' }}>GRZLY</span>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
