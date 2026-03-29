export default function HomePage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="gradient-dark py-24 text-white">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
            Ideas deserve to be{" "}
            <span className="text-brand-300">executed</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-300">
            Submit your idea, get $5 in free AI credits, and let autonomous
            agents validate your concept with market research, competitor
            analysis, and a technical roadmap — all in minutes.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <a
              href="/ideas/new"
              className="rounded-lg bg-brand-500 px-8 py-3 text-lg font-semibold text-white hover:bg-brand-600"
            >
              Submit Your Idea
            </a>
            <a
              href="/search"
              className="rounded-lg border border-gray-500 px-8 py-3 text-lg font-semibold text-gray-300 hover:border-white hover:text-white"
            >
              Explore Ideas
            </a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-center text-3xl font-bold text-gray-900">
            How It Works
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-4">
            {[
              {
                step: "1",
                title: "Submit Your Idea",
                desc: "Describe your concept. If it's unique, you get $5 in free AI credits.",
              },
              {
                step: "2",
                title: "AI Validates It",
                desc: "Agents research the market, analyze competitors, and build a technical plan.",
              },
              {
                step: "3",
                title: "Community Invests",
                desc: "Others discover your idea and invest credits to fuel further development.",
              },
              {
                step: "4",
                title: "Agents Build It",
                desc: "AI agents generate code, prototypes, docs, and tests in sandboxed environments.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-xl border bg-white p-6 shadow-sm"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold">
                  {item.step}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t bg-white py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid gap-8 text-center md:grid-cols-3">
            <div>
              <div className="text-4xl font-bold text-brand-600">$5</div>
              <div className="mt-2 text-sm text-gray-600">
                Free credits per unique idea
              </div>
            </div>
            <div>
              <div className="text-4xl font-bold text-brand-600">10%</div>
              <div className="mt-2 text-sm text-gray-600">
                Of purchases fund new innovators
              </div>
            </div>
            <div>
              <div className="text-4xl font-bold text-brand-600">&infin;</div>
              <div className="mt-2 text-sm text-gray-600">
                Open-source models, no vendor lock-in
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-gray-500">
        <p>AI Idea Hub — Where ideas get built, not just discussed.</p>
      </footer>
    </div>
  );
}
