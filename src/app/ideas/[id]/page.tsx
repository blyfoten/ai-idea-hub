"use client";

import { useState, useEffect } from "react";

interface AgentJob {
  id: string;
  type: string;
  status: string;
  model: string;
  result: unknown;
  creditsUsed: number;
  createdAt: string;
  completedAt: string | null;
}

interface IdeaDetail {
  id: string;
  title: string;
  description: string;
  tags: string[];
  status: string;
  totalInvested: number;
  marketResearch: Record<string, unknown> | null;
  competitors: Record<string, unknown> | null;
  technicalPlan: Record<string, unknown> | null;
  author: { id: string; name: string };
  investments: { id: string; amount: number; user: { name: string } }[];
  agentJobs: AgentJob[];
  _count: { investments: number; agentJobs: number };
  createdAt: string;
}

export default function IdeaDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [idea, setIdea] = useState<IdeaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [investAmount, setInvestAmount] = useState("1.00");
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    fetchIdea();
  }, [params.id]);

  async function fetchIdea() {
    try {
      const res = await fetch(`/api/ideas/${params.id}`);
      const data = await res.json();
      setIdea(data.idea);
    } catch {
      console.error("Failed to fetch idea");
    } finally {
      setLoading(false);
    }
  }

  async function handleValidate() {
    setValidating(true);
    try {
      const res = await fetch(`/api/ideas/${params.id}/validate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (res.ok) {
        // Poll for updates
        const interval = setInterval(async () => {
          await fetchIdea();
          if (idea?.status === "VALIDATED") clearInterval(interval);
        }, 3000);
        setTimeout(() => clearInterval(interval), 120000);
      }
    } finally {
      setValidating(false);
    }
  }

  async function handleInvest() {
    await fetch(`/api/ideas/${params.id}/invest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ amount: parseFloat(investAmount) }),
    });
    fetchIdea();
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-gray-500">Loading idea...</div>
    );
  }

  if (!idea) {
    return (
      <div className="py-20 text-center text-gray-500">Idea not found.</div>
    );
  }

  const tabs = ["overview", "market", "competitors", "technical", "agents"];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{idea.title}</h1>
          <div className="mt-2 flex items-center gap-3 text-sm text-gray-500">
            <span>by {idea.author.name}</span>
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
              {idea.status}
            </span>
            {idea.tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-gray-100 px-2 py-0.5 text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-brand-600">
            ${idea.totalInvested.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">
            {idea._count.investments} investors
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-4">
        {idea.status === "DRAFT" && (
          <button
            onClick={handleValidate}
            disabled={validating}
            className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {validating ? "Starting validation..." : "Validate with AI ($1.50)"}
          </button>
        )}
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={investAmount}
            onChange={(e) => setInvestAmount(e.target.value)}
            min="0.10"
            step="0.10"
            className="w-24 rounded-lg border px-3 py-2 text-sm"
          />
          <button
            onClick={handleInvest}
            className="rounded-lg border border-brand-600 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
          >
            Invest Credits
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-8 border-b">
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 pb-3 text-sm font-medium capitalize ${
                activeTab === tab
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-8">
        {activeTab === "overview" && (
          <div className="prose max-w-none">
            <p className="text-gray-700 whitespace-pre-wrap">
              {idea.description}
            </p>
          </div>
        )}

        {activeTab === "market" && (
          <div className="rounded-xl border bg-white p-6">
            {idea.marketResearch ? (
              <pre className="whitespace-pre-wrap text-sm text-gray-700">
                {JSON.stringify(idea.marketResearch, null, 2)}
              </pre>
            ) : (
              <p className="text-gray-500">
                No market research yet. Validate this idea to generate it.
              </p>
            )}
          </div>
        )}

        {activeTab === "competitors" && (
          <div className="rounded-xl border bg-white p-6">
            {idea.competitors ? (
              <pre className="whitespace-pre-wrap text-sm text-gray-700">
                {JSON.stringify(idea.competitors, null, 2)}
              </pre>
            ) : (
              <p className="text-gray-500">
                No competitor analysis yet. Validate to generate.
              </p>
            )}
          </div>
        )}

        {activeTab === "technical" && (
          <div className="rounded-xl border bg-white p-6">
            {idea.technicalPlan ? (
              <pre className="whitespace-pre-wrap text-sm text-gray-700">
                {JSON.stringify(idea.technicalPlan, null, 2)}
              </pre>
            ) : (
              <p className="text-gray-500">
                No technical roadmap yet. Validate to generate.
              </p>
            )}
          </div>
        )}

        {activeTab === "agents" && (
          <div className="space-y-4">
            {idea.agentJobs.length === 0 ? (
              <p className="text-gray-500">
                No agent jobs yet. Validate or invest to start AI work.
              </p>
            ) : (
              idea.agentJobs.map((job) => (
                <div
                  key={job.id}
                  className="rounded-xl border bg-white p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          job.status === "COMPLETED"
                            ? "bg-green-500"
                            : job.status === "RUNNING"
                              ? "bg-yellow-500 animate-pulse"
                              : job.status === "FAILED"
                                ? "bg-red-500"
                                : "bg-gray-400"
                        }`}
                      />
                      <span className="text-sm font-medium text-gray-900">
                        {job.type.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-gray-500">
                        model: {job.model}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      ${job.creditsUsed.toFixed(2)} credits
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
