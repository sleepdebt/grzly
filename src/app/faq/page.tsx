import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FAQ — GRZLY',
  description: 'How GRZLY works, what the terminology means, and the lore behind the Bear Cult.',
}

interface QAProps {
  q: string
  children: React.ReactNode
}

function QA({ q, children }: QAProps) {
  return (
    <div className="py-5 border-b border-border last:border-b-0">
      <p className="text-[14px] font-semibold text-text mb-2">{q}</p>
      <div className="text-[13px] text-[#888] leading-[1.8]">{children}</div>
    </div>
  )
}

function Term({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="py-4 border-b border-border last:border-b-0 flex gap-5">
      <div className="w-[140px] flex-shrink-0">
        <span className="font-mono text-[12px] font-bold text-accent">{name}</span>
      </div>
      <p className="text-[13px] text-[#888] leading-[1.8] flex-1">{children}</p>
    </div>
  )
}

export default function FAQPage() {
  return (
    <div className="max-w-[760px] mx-auto px-6 py-10 pb-24">

      {/* Header */}
      <div className="mb-10">
        <h1 className="font-mono text-[26px] font-bold text-text mb-2">
          How <span className="text-accent">GRZLY</span> Works
        </h1>
        <p className="text-[14px] text-[#555] leading-relaxed">
          GRZLY is a public record of bearish conviction. Users publish theses on stocks, the community
          votes, and price data settles the argument. No trades, no recommendations — just conviction on record.
        </p>
      </div>

      {/* How it works */}
      <section className="mb-8">
        <div className="bg-surface border border-border rounded-[12px] px-[22px] py-[4px] mb-1">
          <h2 className="font-mono text-[11px] tracking-[0.14em] uppercase text-[#555] py-4 border-b border-border">
            How It Works
          </h2>
          <QA q="What is a Drop?">
            A Drop is a public bearish thesis on a stock. You pick a ticker, write your argument
            (minimum 200 characters), attach evidence, and set a time horizon. Once published, it's
            permanent — the thesis, the lore narrative, and the outcome are all public record.
          </QA>
          <QA q="How does resolution work?">
            At the horizon date, GRZLY automatically checks the stock price via Polygon.io and
            compares it to the baseline price at the time of publishing. If the stock declined,
            the Drop resolves <span className="text-correct font-semibold">Correct</span>. If it
            rose, it resolves <span className="text-hot font-semibold">Incorrect</span>. If data
            is unavailable, it resolves Inconclusive.
          </QA>
          <QA q="What counts as correct?">
            By default, any net decline from the baseline price at resolution counts as correct.
            When creating a Drop you can optionally set a specific target price — in that case,
            the stock must reach or fall below that price to resolve correctly.
          </QA>
          <QA q="What is evidence, and why is it required?">
            Every Drop must include at least one piece of supporting evidence: a financial metric
            (e.g. P/E of 120×), a news event (e.g. CFO departure), or a source link. This keeps
            GRZLY a research platform rather than a rumor mill.
          </QA>
          <QA q="How does voting work?">
            Any signed-in user can cast a vote on an active Drop — either <strong className="text-text">Bearish</strong>{' '}
            (you agree the thesis holds) or <strong className="text-text">Skeptical</strong>{' '}
            (you think it won't play out). Votes are permanent once cast. Your own accuracy score
            weights your vote's contribution to the Conviction Score.
          </QA>
          <QA q="Is GRZLY financial advice?">
            No. All content on GRZLY is general research and community opinion only. Nothing here
            constitutes a recommendation to buy, sell, or hold any security.
          </QA>
        </div>
      </section>

      {/* Terminology */}
      <section className="mb-8">
        <div className="bg-surface border border-border rounded-[12px] px-[22px] py-[4px]">
          <h2 className="font-mono text-[11px] tracking-[0.14em] uppercase text-[#555] py-4 border-b border-border">
            Terminology
          </h2>
          <Term name="Drop">
            A public bearish thesis on a stock. Requires evidence, a time horizon, and resolves
            automatically against price data. Once published, the thesis is immutable.
          </Term>
          <Term name="Vibelord">
            A GRZLY user with a public track record. Your accuracy score is displayed on your
            profile and follows your Drops — there's no hiding from the record.
          </Term>
          <Term name="Conviction Score">
            The accuracy-weighted percentage of bearish votes on a Drop. A higher score means
            experienced Vibelords (those with strong track records) agree with the thesis.
            Distinct from the raw vote percentage.
          </Term>
          <Term name="Accuracy Score">
            Your public track record: the percentage of your resolved, attributed Drops that were
            correct. Only displayed after 3 or more resolved Drops. Anonymous Drops don't count.
          </Term>
          <Term name="Horizon">
            The time window a Drop has to resolve — 7, 30, 90, or 180 days from publish.
            You get one SWAYZE extension before it closes.
          </Term>
          <Term name="Baseline Price">
            The stock price at the moment a Drop is published. This is the reference point used
            to determine the outcome at resolution.
          </Term>
          <Term name="SWAYZE">
            A one-time extension mechanic. If your catalyst is delayed or timing was off, you can
            invoke SWAYZE to double your horizon. Requires a reason. A correct call after SWAYZE
            is worth 0.85× instead of 1.0× accuracy weight.
          </Term>
          <Term name="Bear Book">
            The permanent public archive of all resolved Drops. Every entry includes the outcome,
            conviction data, and an AI-generated retrospective narrative.
          </Term>
          <Term name="The Prophecy">
            The AI-generated lore narrative created when a Drop goes live. Written in the voice
            of the Bear Cult. Immutable after publish — it stands with the thesis forever.
          </Term>
          <Term name="Creator Note">
            An optional plain-text annotation a Drop creator can add alongside their thesis —
            separate from the AI lore narrative, and written in the creator's own voice.
          </Term>
        </div>
      </section>

      {/* Lore */}
      <section className="mb-8">
        <div className="bg-surface border border-border rounded-[12px] px-[22px] py-[4px]">
          <h2 className="font-mono text-[11px] tracking-[0.14em] uppercase text-[#555] py-4 border-b border-border">
            Lore & Mechanics
          </h2>
          <QA q="What is the Bear Cult?">
            The GRZLY community. Bears who publish Drops, vote conviction, and maintain their
            track records in public. Membership is earned through the record — not claimed.
          </QA>
          <QA q="What is The Prophecy, exactly?">
            When you publish a Drop, an AI model (Claude) generates a short narrative framing
            your thesis in the mythic voice of the Bear Cult. It's flavour — not analysis — but
            it's permanent and public, tied to your Drop forever.
          </QA>
          <QA q="How does SWAYZE work?">
            As the Drop creator, you can invoke SWAYZE once on any of your active Drops before
            it resolves. You must choose a reason: <em>Catalyst delayed</em>, <em>Timing off —
            thesis intact</em>, or <em>New information extends timeline</em>. Your horizon doubles.
            The reason is permanent and public. If the Drop later resolves correctly, it counts
            at 0.85× accuracy weight instead of 1.0×, because an on-time correct call is worth more.
          </QA>
          <QA q="What is the Bear Book narrative?">
            When a Drop resolves, a second AI narrative is generated for the Bear Book — a
            retrospective on how the thesis played out. Correct calls get a different tone than
            incorrect ones.
          </QA>
          <QA q="Why does accuracy weighting matter?">
            Not all votes are equal. A Vibelord with a 90% accuracy score carries more weight
            than a new user who has never resolved a Drop. The Conviction Score reflects this —
            it's not just a headcount, it's weighted consensus.
          </QA>
        </div>
      </section>

      {/* Footer note */}
      <p className="text-[11px] text-[#555] text-center leading-relaxed">
        GRZLY is not a financial product. Content is general research and community opinion only.<br />
        Nothing on this platform constitutes investment advice or a recommendation to trade any security.
      </p>

    </div>
  )
}
