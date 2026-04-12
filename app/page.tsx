'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const EditorApp = dynamic(() => import('@/components/EditorApp'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      加载中...
    </div>
  ),
})

export default function Home() {
  return <EditorApp />
}
