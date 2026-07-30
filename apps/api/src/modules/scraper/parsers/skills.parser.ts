/**
 * Dictionary-based skill and benefit extraction.
 *
 * A curated dictionary beats free-form keyword extraction here: it yields
 * canonical labels ("Node.js", not "nodejs"/"node") that filters and, later,
 * AI matching can rely on. Extend SKILL_DICTIONARY to broaden coverage.
 */

type SkillEntry = [canonical: string, aliases: string[]];

const SKILL_DICTIONARY: SkillEntry[] = [
  ['JavaScript', ['javascript', 'js', 'es6']],
  ['TypeScript', ['typescript', 'ts']],
  ['React', ['react', 'react.js', 'reactjs']],
  ['Next.js', ['next.js', 'nextjs']],
  ['Vue', ['vue', 'vue.js', 'vuejs']],
  ['Angular', ['angular', 'angularjs']],
  ['Svelte', ['svelte', 'sveltekit']],
  ['Node.js', ['node.js', 'nodejs', 'node']],
  ['NestJS', ['nestjs', 'nest.js']],
  ['Express', ['express', 'express.js']],
  ['Python', ['python']],
  ['Django', ['django']],
  ['FastAPI', ['fastapi']],
  ['Flask', ['flask']],
  ['Java', ['java']],
  ['Spring Boot', ['spring boot', 'springboot', 'spring']],
  ['Kotlin', ['kotlin']],
  ['Go', ['golang', 'go lang']],
  ['Rust', ['rust']],
  ['C#', ['c#', 'csharp', '.net', 'dotnet', 'asp.net']],
  ['C++', ['c++', 'cpp']],
  ['PHP', ['php']],
  ['Laravel', ['laravel']],
  ['Ruby', ['ruby']],
  ['Ruby on Rails', ['ruby on rails', 'rails']],
  ['Swift', ['swift']],
  ['Objective-C', ['objective-c', 'objc']],
  ['Flutter', ['flutter']],
  ['React Native', ['react native']],
  ['SQL', ['sql']],
  ['PostgreSQL', ['postgresql', 'postgres']],
  ['MySQL', ['mysql', 'mariadb']],
  ['MongoDB', ['mongodb', 'mongo']],
  ['Redis', ['redis']],
  ['Elasticsearch', ['elasticsearch', 'opensearch']],
  ['GraphQL', ['graphql', 'apollo']],
  ['REST API', ['rest api', 'restful', 'rest apis']],
  ['gRPC', ['grpc']],
  ['Prisma', ['prisma']],
  ['Docker', ['docker']],
  ['Kubernetes', ['kubernetes', 'k8s']],
  ['Terraform', ['terraform']],
  ['AWS', ['aws', 'amazon web services']],
  ['Azure', ['azure']],
  ['GCP', ['gcp', 'google cloud']],
  ['CI/CD', ['ci/cd', 'cicd', 'continuous integration']],
  ['GitHub Actions', ['github actions']],
  ['Linux', ['linux', 'unix']],
  ['Kafka', ['kafka']],
  ['RabbitMQ', ['rabbitmq']],
  ['Spark', ['spark', 'pyspark']],
  ['Airflow', ['airflow']],
  ['dbt', ['dbt']],
  ['Snowflake', ['snowflake']],
  ['Tableau', ['tableau']],
  ['Power BI', ['power bi', 'powerbi']],
  ['Machine Learning', ['machine learning', 'ml']],
  ['Deep Learning', ['deep learning']],
  ['PyTorch', ['pytorch']],
  ['TensorFlow', ['tensorflow']],
  ['NLP', ['nlp', 'natural language processing']],
  ['LLM', ['llm', 'large language model', 'genai', 'generative ai']],
  ['Pandas', ['pandas']],
  ['NumPy', ['numpy']],
  ['Tailwind CSS', ['tailwind', 'tailwindcss']],
  ['HTML', ['html', 'html5']],
  ['CSS', ['css', 'css3', 'sass', 'scss']],
  ['Figma', ['figma']],
  ['Jest', ['jest']],
  ['Cypress', ['cypress']],
  ['Playwright', ['playwright']],
  ['Selenium', ['selenium']],
  ['Agile', ['agile', 'scrum', 'kanban']],
  ['Jira', ['jira']],
  ['Git', ['git']],
  ['Product Management', ['product management', 'product manager']],
  ['SEO', ['seo']],
  ['Salesforce', ['salesforce']],
  ['Excel', ['excel']],
];

const BENEFIT_PATTERNS: Array<[string, RegExp]> = [
  ['Health insurance', /\b(health|medical|dental|vision)\s+(insurance|coverage|plan)|healthcare\b/i],
  ['Remote work', /\b(fully remote|remote[- ]first|work from anywhere|remote work)\b/i],
  ['Flexible hours', /\b(flexible (working )?(hours|schedule)|flextime|flexible time)\b/i],
  ['Equity', /\b(equity|stock options|rsus?|share options)\b/i],
  ['401(k)', /\b401\s?\(?k\)?\b/i],
  ['Pension', /\b(pension|retirement plan)\b/i],
  ['Paid time off', /\b(pto|paid time off|unlimited vacation|paid vacation|annual leave)\b/i],
  ['Parental leave', /\b(parental|maternity|paternity)\s+leave\b/i],
  ['Learning budget', /\b(learning|training|education|development)\s+(budget|stipend|allowance)\b/i],
  ['Home office budget', /\b(home office|equipment|wfh)\s+(budget|stipend|allowance)\b/i],
  ['Wellness stipend', /\b(wellness|gym|fitness)\s+(stipend|budget|membership|allowance)\b/i],
  ['Visa sponsorship', /\b(visa sponsorship|relocation (support|package|assistance))\b/i],
];

const VISA_POSITIVE = /\b(visa sponsorship( is)? (available|provided|offered)|we sponsor|sponsorship available|will sponsor)\b/i;
const VISA_NEGATIVE = /\b(no visa sponsorship|cannot sponsor|unable to sponsor|not able to sponsor|sponsorship (is )?not available|must (already )?(be authorized|have the right to work))\b/i;

/** Word-boundary-safe alias matching (avoids "go" inside "google", "R" everywhere). */
function containsAlias(haystack: string, alias: string): boolean {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const needsBoundary = /^[a-z0-9]/i.test(alias);
  const pattern = needsBoundary
    ? new RegExp(`(^|[^a-z0-9+#.])${escaped}($|[^a-z0-9+#])`, 'i')
    : new RegExp(escaped, 'i');
  return pattern.test(haystack);
}

export function extractSkills(
  parts: { title?: string | null; description?: string | null; tags?: string[] },
  limit = 20,
): string[] {
  const haystack = [parts.title ?? '', parts.description ?? '', (parts.tags ?? []).join(' ')]
    .join(' \n ')
    .toLowerCase();

  if (!haystack.trim()) {
    return [];
  }

  const found: string[] = [];
  for (const [canonical, aliases] of SKILL_DICTIONARY) {
    if (aliases.some((alias) => containsAlias(haystack, alias))) {
      found.push(canonical);
    }
    if (found.length >= limit) {
      break;
    }
  }
  return found;
}

export function extractBenefits(description?: string | null): string[] {
  if (!description) {
    return [];
  }
  return BENEFIT_PATTERNS.filter(([, pattern]) => pattern.test(description)).map(([label]) => label);
}

/** Tri-state: true/false when stated explicitly, null when the posting is silent. */
export function detectVisaSponsorship(description?: string | null): boolean | null {
  if (!description) {
    return null;
  }
  if (VISA_NEGATIVE.test(description)) {
    return false;
  }
  if (VISA_POSITIVE.test(description)) {
    return true;
  }
  return null;
}
