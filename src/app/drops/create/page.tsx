import type { Metadata } from 'next'
import CreateDropForm from '@/components/drops/CreateDropForm'

export const metadata: Metadata = {
  title: 'Create a Drop — GRZLY',
  description: 'Publish a structured short thesis. Ticker, conviction, evidence.',
}

export default function CreateDropPage() {
  return (
    <div className="max-w-[760px] mx-auto px-6 py-12 pb-20">
      <div className="mb-10">
        <h1 className="font-mono text-[28px] font-bold text-text mb-2">
          Create a <span className="text-accent">Drop</span>
        </h1>
        <p className="text-dim text-sm leading-relaxed">
          A Drop is your public conviction on record. Evidence is required. Your track record follows you.
        </p>
      </div>
      <CreateDropForm />
    </div>
  )
}
