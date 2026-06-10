import ThankYouPage from '@/components/ThankYouPage';
import { getWebinarConfig } from '@/lib/db';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const config = await getWebinarConfig();

  const copy = {
    heading: config.thankyouHeading,
    subCopy: config.thankyouSubcopy,
    confirmationTemplate: config.thankyouConfirmationTemplate,
    webinarTitlePersonal: config.thankyouWebinarTitlePersonal,
    webinarTitleDefault: config.thankyouWebinarTitleDefault,
    webinarBodyPersonal: config.thankyouWebinarBodyPersonal,
    webinarBodyDefault: config.thankyouWebinarBodyDefault,
    webinarCtaPersonal: config.thankyouWebinarCtaPersonal,
    webinarCtaDefault: config.thankyouWebinarCtaDefault,
    phoneTitle: config.thankyouPhoneTitle,
    phoneBody: config.thankyouPhoneBody,
    phoneCta: config.thankyouPhoneCta,
    phoneNumber: config.thankyouPhoneNumber,
    whatsappTitle: config.thankyouWhatsappTitle,
    whatsappBody: config.thankyouWhatsappBody,
    whatsappCta: config.thankyouWhatsappCta,
    whatsappNumber: config.thankyouWhatsappNumber,
    whatsappMessage: config.thankyouWhatsappMessage,
    footerText: config.thankyouFooterText,
    brochureUrl: config.genericBrochureUrl,
    brochureCta: config.genericBrochureCta,
    logoPath: config.logoPath,
  };

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ThankYouPage
        conversionId="AW-783236209/8w9vCIrelv4aEPH4vPUC"
        copy={copy}
      />
    </Suspense>
  );
}
