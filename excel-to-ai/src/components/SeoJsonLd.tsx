import type { Faq, SpeakerSettings } from '@/lib/db';

type Props = {
  siteUrl: string;
  speaker: SpeakerSettings;
  faqs: Faq[];
};

export default function SeoJsonLd({ siteUrl, speaker, faqs }: Props) {
  const speakerImage = speaker.speakerImage?.startsWith('http')
    ? speaker.speakerImage
    : `${siteUrl}${speaker.speakerImage || ''}`;

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'AnalytixLabs',
    url: 'https://www.analytixlabs.co.in',
    logo: 'https://www.analytixlabs.co.in/wp-content/uploads/2025/03/analytixlabs-logo.webp',
    sameAs: [
      'https://www.linkedin.com/school/analytixlabs',
      'https://www.youtube.com/@analytixlabs',
    ],
  };

  const person = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: speaker.speakerName,
    jobTitle: speaker.speakerTitle,
    description: speaker.speakerBio,
    image: speakerImage,
    worksFor: { '@type': 'Organization', name: 'AnalytixLabs' },
  };

  const event = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: 'From Excel to AI — Inside the Data Analyst & Data Scientist Workflow',
    description:
      'Free 90-minute live masterclass on how data analysts and data scientists work in 2026 — covering Excel, SQL, Python, and AI co-pilots.',
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    location: {
      '@type': 'VirtualLocation',
      url: siteUrl,
    },
    organizer: organization,
    performer: person,
    isAccessibleForFree: true,
    inLanguage: 'en',
    audience: {
      '@type': 'Audience',
      audienceType: 'Freshers and working professionals from tech and non-tech backgrounds',
    },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'INR',
      availability: 'https://schema.org/InStock',
      url: siteUrl,
      validFrom: new Date().toISOString(),
    },
  };

  const faqPage = faqs.length === 0 ? null : {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.a,
      },
    })),
  };

  const blocks = [organization, person, event, faqPage].filter(Boolean);

  return (
    <>
      {blocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
    </>
  );
}
