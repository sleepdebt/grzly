// Drop creation page — client component (multi-step form with live ticker validation)
// Route: /drops/create

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Drop a Thesis',
  description: 'Publish a structured short thesis. Ticker, conviction, evidence.',
}

// The actual form is a client component (see drop_creation_ui.html for full spec)
// It handles: ticker search, 4-step validation, evidence requirement,
// lore generation preview, and anonymous toggle
import CreateDropForm from '@/components/drops/CreateDropForm'

export default function CreateDropPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-2">Drop a Thesis</h1>
        <p className="text-muted text-sm">
          Name the company. Make the case. The Bear Book remembers.
        </p>
      </div>
      <CreateDropForm />
    </div>
  )
}
