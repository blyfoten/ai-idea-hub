"use client";

import { useState, useEffect } from "react";

interface Idea {
  id: string;
  title: string;
  description: string;
  tags: string[];
  status: string;
  totalInvested: number;
  author: { id: string; name: string };
  _count: { investments: number; agentJobs: number };
  createdAt: string;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchIdeas("");
  }, []);

  async function fetchIdeas(q: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/ideas?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setIdeas(data.ideas || []);
    } catch {
      console.error("Failed to fetch ideas");
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchIdeas(query);
  }

  const statusColors: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700",
    VALIDATING: "bg-yellow-100 text-yellow-700",
    VALIDATED: "bg-green-100 text-green-700",
    IN_PROGRESS: "bg-blue-100 text-blue-700",
    COMPLETED: "bg-purple-100 text-purple-700",
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900">Explore Ideas</h1>
      <p className="mt-2 text-gray-600">
        Discover ideas, invest credits, and help bring them to life.
      </p>

      {/* Search */}
      <form onSubmit={handleSearch} className="mt-8">
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ideas by keyword, topic, or tag..."
            className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-6 py-3 text-sm font-medium text-white hover:bg-brand-700"
          >
            Search
          </button>
        </div>
      </form>

      {/* Results */}
      <div className="mt-8 space-y-4">
        {loading && (
          <div className="py-12 text-center text-gray-500">Searching...</div>
        )}

        {!loading && ideas.length === 0 && (
          <div className="rounded-xl border bg-white p-12 text-center">
            <p className="text-gray-500">No ideas found. Be the first!</p>
            <a
              href="/ideas/new"
              className="mt-4 inline-block rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Submit an Idea
            </a>
          </div>
        )}

        {ideas.map((idea) => (
          <a
            key={idea.id}
            href={`/ideas/${idea.id}`}
            className="block rounded-xl border bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {idea.title}
                  </h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[idea.status] || "bg-gray-100"}`}
                  >
                    {idea.status}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                  {idea.description}
                </p>
                <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                  <span>by {idea.author.name}</span>
                  <span>{idea._count.investments} investors</span>
                  <span>{idea._count.agentJobs} agent jobs</span>
                  {idea.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-gray-100 px-2 py-0.5"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="ml-6 text-right">
                <div className="text-2xl font-bold text-brand-600">
                  ${idea.totalInvested.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">invested</div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
