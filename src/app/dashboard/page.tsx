"use client";

import { useState, useEffect } from "react";

interface UserData {
  balance: number;
  transactions: {
    id: string;
    amount: number;
    type: string;
    description: string;
    createdAt: string;
  }[];
}

interface AgentJob {
  id: string;
  type: string;
  status: string;
  model: string;
  creditsUsed: number;
  idea: { id: string; title: string };
  createdAt: string;
}

export default function DashboardPage() {
  const [credits, setCredits] = useState<UserData | null>(null);
  const [jobs, setJobs] = useState<AgentJob[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };

    fetch("/api/credits", { headers })
      .then((r) => r.json())
      .then(setCredits)
      .catch(console.error);

    fetch("/api/agents", { headers })
      .then((r) => r.json())
      .then((d) => setJobs(d.jobs || []))
      .catch(console.error);
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>

      {/* Credits overview */}
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-gray-500">Credit Balance</div>
          <div className="mt-2 text-4xl font-bold text-brand-600">
            ${credits?.balance?.toFixed(2) ?? "—"}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-gray-500">Active Agent Jobs</div>
          <div className="mt-2 text-4xl font-bold text-gray-900">
            {jobs.filter((j) => j.status === "RUNNING" || j.status === "QUEUED")
              .length}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-gray-500">Completed Jobs</div>
          <div className="mt-2 text-4xl font-bold text-green-600">
            {jobs.filter((j) => j.status === "COMPLETED").length}
          </div>
        </div>
      </div>

      {/* Agent jobs */}
      <div className="mt-12">
        <h2 className="text-xl font-semibold text-gray-900">
          Recent Agent Activity
        </h2>
        <div className="mt-4 space-y-3">
          {jobs.length === 0 && (
            <p className="text-gray-500">
              No agent jobs yet. Submit and validate an idea to get started.
            </p>
          )}
          {jobs.map((job) => (
            <div
              key={job.id}
              className="flex items-center justify-between rounded-xl border bg-white p-4"
            >
              <div className="flex items-center gap-4">
                <span
                  className={`h-3 w-3 rounded-full ${
                    job.status === "COMPLETED"
                      ? "bg-green-500"
                      : job.status === "RUNNING"
                        ? "bg-yellow-500 animate-pulse"
                        : job.status === "FAILED"
                          ? "bg-red-500"
                          : "bg-gray-300"
                  }`}
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {job.type.replace(/_/g, " ")}
                  </div>
                  <div className="text-xs text-gray-500">
                    <a
                      href={`/ideas/${job.idea.id}`}
                      className="hover:text-brand-600"
                    >
                      {job.idea.title}
                    </a>
                    {" · "}model: {job.model}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  {job.status}
                </div>
                <div className="text-xs text-gray-500">
                  ${job.creditsUsed.toFixed(2)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction history */}
      <div className="mt-12">
        <h2 className="text-xl font-semibold text-gray-900">
          Transaction History
        </h2>
        <div className="mt-4 overflow-hidden rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Type
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Description
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">
                  Amount
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {credits?.transactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="px-4 py-3 text-gray-700">
                    {tx.type.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {tx.description}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${
                      tx.amount > 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {tx.amount > 0 ? "+" : ""}${tx.amount.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {new Date(tx.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
