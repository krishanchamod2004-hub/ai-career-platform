import {
  canonicalizeCompanyName,
  cleanUrl,
  htmlToText,
  slugify,
} from '../src/modules/scraper/parsers/text.util';
import {
  detectVisaSponsorship,
  extractBenefits,
  extractSkills,
} from '../src/modules/scraper/parsers/skills.parser';
import { decodeHtmlEntities } from '../src/modules/scraper/adapters/greenhouse.adapter';

describe('htmlToText', () => {
  it('converts block markup into readable text', () => {
    const html = '<h2>About</h2><p>We build <strong>APIs</strong>.</p><ul><li>Node.js</li><li>SQL</li></ul>';
    expect(htmlToText(html)).toBe('About\nWe build APIs.\n• Node.js\n• SQL');
  });

  it('drops scripts and styles', () => {
    const html = '<p>Hello</p><script>alert(1)</script><style>p{color:red}</style>';
    expect(htmlToText(html)).toBe('Hello');
  });

  it('decodes HTML entities', () => {
    expect(htmlToText('<p>R&amp;D &mdash; 100&nbsp;engineers</p>')).toBe('R&D — 100 engineers');
  });
});

describe('decodeHtmlEntities', () => {
  it('unescapes the double-encoded markup Greenhouse returns', () => {
    expect(decodeHtmlEntities('&lt;p&gt;Hello &amp;amp; welcome&lt;/p&gt;')).toBe(
      '<p>Hello &amp; welcome</p>',
    );
  });
});

describe('slugify and canonicalizeCompanyName', () => {
  it('produces url-safe slugs', () => {
    expect(slugify('Senior Node.js Engineer (Remote!)')).toBe('senior-node-js-engineer-remote');
  });

  it('strips legal suffixes so the same company matches across sources', () => {
    expect(canonicalizeCompanyName('Acme Inc.')).toBe('acme');
    expect(canonicalizeCompanyName('Acme GmbH')).toBe('acme');
    expect(canonicalizeCompanyName('ACME, LLC')).toBe('acme');
  });
});

describe('cleanUrl', () => {
  it('removes tracking parameters', () => {
    expect(cleanUrl('https://jobs.example.com/1?utm_source=x&gh_src=y&id=7#apply')).toBe(
      'https://jobs.example.com/1?id=7',
    );
  });

  it('returns the input unchanged when it is not a valid url', () => {
    expect(cleanUrl('not a url')).toBe('not a url');
  });
});

describe('extractSkills', () => {
  it('returns canonical labels from the description and tags', () => {
    const skills = extractSkills({
      title: 'Senior Backend Engineer',
      description: 'You will use nodejs, postgres and k8s daily. Experience with TS preferred.',
      tags: ['docker'],
    });

    expect(skills).toContain('Node.js');
    expect(skills).toContain('PostgreSQL');
    expect(skills).toContain('Kubernetes');
    expect(skills).toContain('TypeScript');
    expect(skills).toContain('Docker');
  });

  it('does not match aliases inside unrelated words', () => {
    const skills = extractSkills({ description: 'We use Google Workspace and Goodreads.' });
    expect(skills).not.toContain('Go');
  });

  it('returns an empty array with no input', () => {
    expect(extractSkills({})).toEqual([]);
  });
});

describe('extractBenefits and detectVisaSponsorship', () => {
  it('detects common benefits', () => {
    const benefits = extractBenefits(
      'We offer health insurance, unlimited vacation, stock options, and a learning budget.',
    );
    expect(benefits).toEqual(
      expect.arrayContaining(['Health insurance', 'Paid time off', 'Equity', 'Learning budget']),
    );
  });

  it('is tri-state about visa sponsorship', () => {
    expect(detectVisaSponsorship('Visa sponsorship is available for this role.')).toBe(true);
    expect(detectVisaSponsorship('We are unable to sponsor visas at this time.')).toBe(false);
    expect(detectVisaSponsorship('Great team, great mission.')).toBeNull();
  });
});
