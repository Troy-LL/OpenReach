import { choice, noul, TypeSafeClient } from "@typesafe-ai/sdk";
import { getApiKey } from "./keys.js";
import type { Intent, TopicCandidate } from "./types.js";

export function createClient(): TypeSafeClient {
  return new TypeSafeClient({
    apiKey: getApiKey() || undefined,
    timeout: 30_000,
  });
}

export async function classifyIntent(
  client: TypeSafeClient,
  question: string,
): Promise<Intent> {
  const { answers } = await client.systemOne({
    state: { question },
    questions: {
      field: choice(
        "Which research field does the user's question primarily belong to?",
        {
          cs: "Computer science, AI, ML, software, systems, HCI",
          biomed: "Biology, medicine, clinical, life sciences",
          physics: "Physics, astronomy, materials, chemistry-heavy physical science",
          social: "Social science, economics, psychology, education, policy",
          other: "None of the above, or genuinely unclear / cross-cutting",
        },
      ),
      wants_review: noul(
        "Is the user primarily looking for a survey, review, or overview paper?",
        {
          true: "They want a review, survey, meta-analysis, or broad overview",
          false: "They want a specific empirical method, system, or result paper",
        },
      ),
      wants_empirical: noul(
        "Is the user primarily looking for empirical or experimental research?",
        {
          true: "They want experiments, measurements, datasets, or evaluated systems",
          false: "They want theory, surveys, opinion, or non-empirical work",
        },
      ),
    },
  });

  return {
    field: answers.field.choice,
    wantsReview: answers.wants_review.noul,
    wantsEmpirical: answers.wants_empirical.noul,
  };
}

export async function filterRelevantTopics(
  client: TypeSafeClient,
  question: string,
  topics: TopicCandidate[],
): Promise<TopicCandidate[]> {
  if (topics.length === 0) return [];

  const questions: Record<
    string,
    ReturnType<typeof noul>
  > = {};

  for (const [i, topic] of topics.entries()) {
    questions[`t${i}`] = noul(
      {
        task: "Decide whether this OpenAlex research topic is relevant to the user's information need.",
        note: "Match on meaning, not shared keywords. Nearby but different topics should be no.",
        user_question: question,
        topic_name: topic.displayName,
        topic_description: topic.description || "(no description)",
      },
      {
        true: "Papers under this topic would likely help answer the user's need",
        false: "This topic is only loosely related or about a different problem",
      },
    );
  }

  const { answers } = await client.systemOne({
    state: {
      question,
      topics: topics.map((t) => ({
        id: t.id,
        displayName: t.displayName,
        description: t.description,
      })),
    },
    questions,
  });

  return topics.filter((_, i) => {
    const key = `t${i}`;
    const a = answers[key as keyof typeof answers] as { noul: number };
    return a.noul >= 0.55;
  });
}
