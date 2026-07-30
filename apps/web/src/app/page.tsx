import { LandingHeader } from '@/components/landing/landing-header';
import { HeroSection } from '@/components/landing/hero-section';
import { LogoCloudSection } from '@/components/landing/logo-cloud-section';
import { HowItWorksSection } from '@/components/landing/how-it-works-section';
import { FeaturesBentoSection } from '@/components/landing/features-bento-section';
import { ScoringExplainerSection } from '@/components/landing/scoring-explainer-section';
import { ResourcesSection } from '@/components/landing/resources-section';
import { PricingSection } from '@/components/landing/pricing-section';
import { FaqSection } from '@/components/landing/faq-section';
import { LandingFooter } from '@/components/landing/landing-footer';
import { buildHomepageJsonLd } from '@/lib/json-ld';

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      {buildHomepageJsonLd().map((schema) => (
        <script
          key={schema['@type'] as string}
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      <LandingHeader />

      <main>
        <HeroSection />
        <LogoCloudSection />
        <HowItWorksSection />
        <FeaturesBentoSection />
        <ScoringExplainerSection />
        <ResourcesSection />
        <PricingSection />
        <FaqSection />
      </main>

      <LandingFooter />
    </div>
  );
}
